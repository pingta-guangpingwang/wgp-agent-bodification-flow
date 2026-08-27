# SPDX-License-Identifier: Apache-2.0
"""Run release-bundle security acceptance tests with synthetic archives."""

from __future__ import annotations

import hashlib
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile
from unittest import mock
import warnings
from zipfile import ZIP_STORED, ZipFile, ZipInfo

import build_release
import verify_release_bundle as verifier


def _run_git(repository: Path, *arguments: str) -> None:
    """Run one quiet Git command in an isolated test repository."""

    subprocess.run(
        ["git", *arguments],
        cwd=repository,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def _test_index_snapshot_and_intent_to_add(directory: Path) -> None:
    """Prove dirty worktree bytes cannot replace an index blob and add-N fails."""

    repository = directory / "index-repository"
    repository.mkdir()
    _run_git(repository, "init", "--quiet")
    source = repository / "source.txt"
    source.write_bytes(b"staged-A\n")
    _run_git(repository, "add", "source.txt")

    original_root = build_release.ROOT
    build_release.ROOT = repository
    try:
        entry = build_release._git_cached_entries()["source.txt"]
        source.write_bytes(b"dirty-B\n")
        if build_release.read_index_blob(entry.oid) != b"staged-A\n":
            raise AssertionError("dirty worktree bytes replaced the staged index blob")
        dirty_bundle = directory / "dirty-index.zip"
        staged_payload = b"staged-A\n"
        _write_fixture(
            dirty_bundle,
            [_record("source.txt", staged_payload)],
            [("source.txt", staged_payload, False, False)],
        )
        with mock.patch.object(build_release, "release_index_entries", return_value=(entry,)):
            verifier.verify_bundle(dirty_bundle, local_index=True)

        intent = repository / "intent.txt"
        intent.write_bytes(b"not staged\n")
        _run_git(repository, "add", "--intent-to-add", "intent.txt")
        try:
            build_release._git_cached_entries()
        except ValueError as error:
            if "intent-to-add" not in str(error):
                raise
        else:
            raise AssertionError("intent-to-add entry was accepted")
    finally:
        build_release.ROOT = original_root

    zero_oid = b"0" * 40
    fake_index = subprocess.CompletedProcess(
        args=["git"],
        returncode=0,
        stdout=b"100644 " + zero_oid + b" 0\tzero.txt\0",
    )
    with mock.patch.object(build_release.subprocess, "run", return_value=fake_index):
        try:
            build_release._git_cached_entries()
        except ValueError as error:
            if "zero object id" not in str(error):
                raise
        else:
            raise AssertionError("zero Git object id was accepted")


def _record(relative: str, payload: bytes) -> dict[str, object]:
    """Return one canonical synthetic manifest record."""

    return {
        "path": relative,
        "sha256": hashlib.sha256(payload).hexdigest(),
        "size": len(payload),
    }


def _manifest(records: list[dict[str, object]]) -> bytes:
    """Return a canonical synthetic bundle manifest."""

    return verifier._canonical_manifest_bytes(
        {
            "archiveRoot": verifier.ARCHIVE_ROOT,
            "files": records,
            "format": verifier.MANIFEST_FORMAT,
            "version": verifier.VERSION,
        }
    )


def _member_info(relative: str, *, symlink: bool = False, wrong_metadata: bool = False) -> ZipInfo:
    """Return canonical or intentionally invalid ZIP metadata."""

    timestamp = (2025, 1, 1, 0, 0, 0) if wrong_metadata else verifier.FIXED_ZIP_TIME
    info = ZipInfo(f"{verifier.ARCHIVE_ROOT}/{relative}", timestamp)
    info.compress_type = ZIP_STORED
    info.create_system = 3
    info.external_attr = (
        (stat.S_IFLNK | 0o777) << 16 if symlink else verifier.EXPECTED_EXTERNAL_ATTR
    )
    return info


def _write_fixture(
    destination: Path,
    records: list[dict[str, object]],
    members: list[tuple[str, bytes, bool, bool]],
    *,
    manifest_payload: bytes | None = None,
) -> None:
    """Write one synthetic canonical or malicious release archive."""

    with ZipFile(destination, "w", compression=ZIP_STORED) as archive:
        manifest_info = _member_info(verifier.MANIFEST_NAME)
        archive.writestr(
            manifest_info,
            manifest_payload if manifest_payload is not None else _manifest(records),
            compress_type=ZIP_STORED,
        )
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            for relative, payload, symlink, wrong_metadata in members:
                archive.writestr(
                    _member_info(relative, symlink=symlink, wrong_metadata=wrong_metadata),
                    payload,
                    compress_type=ZIP_STORED,
                )


def _expect_failure(label: str, bundle: Path, expected_fragment: str) -> None:
    """Require one malicious bundle to fail verification."""

    try:
        verifier.verify_bundle(bundle)
    except ValueError as error:
        if expected_fragment not in str(error):
            raise AssertionError(f"{label} failed for an unexpected reason: {error}") from error
        return
    raise AssertionError(f"{label} bundle was accepted")


def _test_offline_bundle_failures(directory: Path) -> None:
    """Exercise exact-set, path, link, payload, manifest, and metadata failures."""

    alpha = b"alpha\n"
    beta = b"bravo\n"
    alpha_record = _record("README.md", alpha)
    beta_record = _record("LICENSE", beta)

    safe = directory / "safe.zip"
    _write_fixture(safe, [alpha_record], [("README.md", alpha, False, False)])
    verifier.verify_bundle(safe)
    trailing = directory / "trailing.zip"
    shutil.copyfile(safe, trailing)
    with trailing.open("ab") as stream:
        stream.write(b"hidden")
    _expect_failure("trailing data", trailing, "hidden bytes after")

    cases: list[
        tuple[str, str, list[dict[str, object]], list[tuple[str, bytes, bool, bool]], bytes | None]
    ] = [
        (
            "extra",
            "outside the bundle manifest",
            [alpha_record],
            [("README.md", alpha, False, False), ("EXTRA.md", beta, False, False)],
            None,
        ),
        (
            "missing",
            "omits bundle-manifest member",
            [beta_record, alpha_record],
            [("LICENSE", beta, False, False)],
            None,
        ),
        (
            "order",
            "canonical manifest order",
            [beta_record, alpha_record],
            [("README.md", alpha, False, False), ("LICENSE", beta, False, False)],
            None,
        ),
        (
            "duplicate",
            "duplicate member paths",
            [alpha_record],
            [("README.md", alpha, False, False), ("README.md", alpha, False, False)],
            None,
        ),
        (
            "traversal",
            "not normalized",
            [alpha_record],
            [("README.md", alpha, False, False), ("../escape", beta, False, False)],
            None,
        ),
        ("symlink", "symbolic link", [alpha_record], [("README.md", alpha, True, False)], None),
        ("payload", "payload differs", [alpha_record], [("README.md", b"omega\n", False, False)], None),
        (
            "manifest",
            "not canonical JSON",
            [alpha_record],
            [("README.md", alpha, False, False)],
            _manifest([alpha_record])[:-1] + b" \n",
        ),
        ("metadata", "non-canonical timestamp", [alpha_record], [("README.md", alpha, False, True)], None),
    ]
    for label, expected_fragment, records, members, manifest_payload in cases:
        bundle = directory / f"{label}.zip"
        _write_fixture(bundle, records, members, manifest_payload=manifest_payload)
        _expect_failure(label, bundle, expected_fragment)

    for invalid_path in (
        "../escape",
        "/absolute",
        "C:/absolute",
        "dir\\backslash",
        "dir/control\x01.txt",
        "dir/name:stream",
        "dir/CON.txt",
        "dir/trailing.",
        "dir/trailing ",
    ):
        for validator in (verifier._validated_relative_path, build_release._normalize_relative_path):
            try:
                validator(invalid_path)
            except ValueError:
                continue
            raise AssertionError(f"unsafe portable path was accepted: {invalid_path!r}")

    credential = b"github" + b"_pat_" + (b"A" * 24)
    try:
        verifier._scan_member_for_secrets("README.md", credential)
    except ValueError:
        pass
    else:
        raise AssertionError("credential-like ZIP text was accepted")


def main() -> None:
    """Run all release security acceptance tests."""

    with tempfile.TemporaryDirectory(prefix="wgp-abf-release-tests-") as temporary:
        directory = Path(temporary)
        _test_index_snapshot_and_intent_to_add(directory)
        _test_offline_bundle_failures(directory)
    print("PASS release bundle security acceptance tests")


if __name__ == "__main__":
    main()
