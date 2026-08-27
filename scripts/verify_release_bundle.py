# SPDX-License-Identifier: Apache-2.0
"""Verify a WGP-ABF bundle offline and optionally against a local Git index."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import stat
import sys
import unicodedata
from zipfile import ZIP_STORED, BadZipFile, ZipFile, ZipInfo


VERSION = "0.6.0"
BUNDLE_NAME = f"WGP-ABF-Spec-Bundle-v{VERSION}.zip"
ARCHIVE_ROOT = f"wgp-abf-spec-bundle-v{VERSION}"
MANIFEST_NAME = "WGP-ABF-BUNDLE-MANIFEST.json"
MANIFEST_FORMAT = "wgp-abf-release-manifest/1"
FIXED_ZIP_TIME = (2026, 8, 27, 0, 0, 0)
EXPECTED_EXTERNAL_ATTR = 0o100644 << 16
LOCAL_ROOT = Path(__file__).resolve().parents[1]
SHA256 = re.compile(r"[0-9a-f]{64}\Z")
WINDOWS_RESERVED_BASENAMES = frozenset(
    {
        "aux",
        "clock$",
        "con",
        "conin$",
        "conout$",
        "nul",
        "prn",
        *(f"com{number}" for number in range(1, 10)),
        *(f"lpt{number}" for number in range(1, 10)),
        *(f"com{number}" for number in "¹²³"),
        *(f"lpt{number}" for number in "¹²³"),
    }
)
TEXT_SUFFIXES = frozenset(
    {".cff", ".css", ".html", ".js", ".json", ".jsonl", ".md", ".mjs", ".py", ".sh", ".ts", ".txt", ".yaml", ".yml"}
)
TEXT_NAMES = frozenset({"LICENSE", "NOTICE"})
SECRET_PATTERNS = (
    ("GitHub token", re.compile(rb"gh(?:p|o|u|s|r)_[A-Za-z0-9]{20,}")),
    ("GitHub fine-grained token", re.compile(rb"github_pat_[A-Za-z0-9_]{20,}")),
    ("AWS access key", re.compile(rb"(?:AKIA|ASIA)[0-9A-Z]{16}")),
    ("Aliyun access key", re.compile(rb"LTAI[0-9A-Za-z]{16,}")),
    ("API secret", re.compile(rb"sk-[A-Za-z0-9_-]{20,}")),
    ("private key", re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
    ("DeepSeek API key assignment", re.compile(rb"DEEPSEEK_API_KEY\s*=\s*[^\s<>{}$]+")),
)


def _validated_relative_path(value: str) -> str:
    """Return one normalized portable relative path or raise ``ValueError``."""

    if not value or "\\" in value or any(unicodedata.category(character).startswith("C") for character in value):
        raise ValueError(f"Bundle path contains an unsafe character: {value!r}")
    segments = value.split("/")
    if any(not segment or segment in {".", ".."} for segment in segments):
        raise ValueError(f"Bundle path is not normalized: {value!r}")
    for segment in segments:
        if ":" in segment or segment.endswith((".", " ")):
            raise ValueError(f"Bundle path is not Windows-portable: {value!r}")
        if segment.split(".", 1)[0].casefold() in WINDOWS_RESERVED_BASENAMES:
            raise ValueError(f"Bundle path uses a Windows reserved name: {value!r}")
    relative = PurePosixPath(value)
    if relative.is_absolute() or relative.as_posix() != value:
        raise ValueError(f"Bundle path is not relative: {value!r}")
    return value


def _validated_member_name(info: ZipInfo) -> str:
    """Return a normalized safe ZIP member name or raise ``ValueError``."""

    name = info.filename
    original_name = info.orig_filename
    if not original_name or original_name != name or name.endswith("/"):
        raise ValueError(f"ZIP contains an invalid file path: {original_name!r}")
    _validated_relative_path(name)
    member = PurePosixPath(name)
    if member.parts[0] != ARCHIVE_ROOT:
        raise ValueError(f"ZIP member is outside the release root: {name!r}")

    mode = (info.external_attr >> 16) & 0xFFFF
    if stat.S_ISLNK(mode):
        raise ValueError(f"ZIP contains a symbolic link: {name}")
    if mode and not stat.S_ISREG(mode):
        raise ValueError(f"ZIP contains a non-regular filesystem entry: {name}")
    if info.flag_bits & 0x1:
        raise ValueError(f"ZIP contains an encrypted member: {name}")
    return name


def _validate_reproducible_metadata(info: ZipInfo) -> None:
    """Reject ZIP metadata that differs from the canonical bundle writer."""

    expected_flag_bits = 0 if info.filename.isascii() else 0x800
    expected = {
        "timestamp": (info.date_time, FIXED_ZIP_TIME),
        "compression": (info.compress_type, ZIP_STORED),
        "creator system": (info.create_system, 3),
        "creator version": (info.create_version, 20),
        "extractor version": (info.extract_version, 20),
        "general-purpose flags": (info.flag_bits, expected_flag_bits),
        "internal attributes": (info.internal_attr, 0),
        "external attributes": (info.external_attr, EXPECTED_EXTERNAL_ATTR),
    }
    for label, (actual, canonical) in expected.items():
        if actual != canonical:
            raise ValueError(f"ZIP member has non-canonical {label}: {info.filename}")
    if info.extra or info.comment:
        raise ValueError(f"ZIP member has non-canonical extra metadata: {info.filename}")


def _scan_member_for_secrets(relative: str, payload: bytes) -> None:
    """Reject credential-like content in one textual release member."""

    path = PurePosixPath(relative)
    if path.suffix.lower() not in TEXT_SUFFIXES and path.name not in TEXT_NAMES:
        return
    for label, pattern in SECRET_PATTERNS:
        if pattern.search(payload):
            raise ValueError(f"ZIP text member contains a credential-like value ({label}): {relative}")


def _validate_archive_layout(archive: ZipFile, infos: list[ZipInfo], archive_size: int) -> None:
    """Reject bytes hidden before, between, or after canonical ZIP records."""

    expected_offset = 0
    central_directory_size = 0
    for info in infos:
        encoded_name = info.filename.encode("ascii" if info.filename.isascii() else "utf-8")
        if info.header_offset != expected_offset:
            raise ValueError(f"ZIP has a non-canonical local-header offset: {info.filename}")
        expected_offset += 30 + len(encoded_name) + len(info.extra) + info.compress_size
        central_directory_size += 46 + len(encoded_name) + len(info.extra) + len(info.comment)
    if expected_offset != archive.start_dir:
        raise ValueError("ZIP has hidden bytes before its central directory")
    expected_size = archive.start_dir + central_directory_size + 22 + len(archive.comment)
    if expected_size != archive_size:
        raise ValueError("ZIP has hidden bytes after its end record")


def _canonical_manifest_bytes(document: object) -> bytes:
    """Serialize one manifest document in the required canonical JSON form."""

    return json.dumps(document, ensure_ascii=True, sort_keys=True, separators=(",", ":")).encode("utf-8") + b"\n"


def _parse_manifest(payload: bytes) -> tuple[tuple[str, int, str], ...]:
    """Validate canonical manifest JSON and return its ordered file records."""

    try:
        document = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("Bundle manifest is not valid UTF-8 JSON") from error
    if _canonical_manifest_bytes(document) != payload:
        raise ValueError("Bundle manifest is not canonical JSON")
    if not isinstance(document, dict) or set(document) != {"archiveRoot", "files", "format", "version"}:
        raise ValueError("Bundle manifest has unexpected top-level fields")
    if (
        document["archiveRoot"] != ARCHIVE_ROOT
        or document["format"] != MANIFEST_FORMAT
        or document["version"] != VERSION
    ):
        raise ValueError("Bundle manifest identifies an unexpected release format or version")
    if not isinstance(document["files"], list) or not document["files"]:
        raise ValueError("Bundle manifest must list at least one file")

    records: list[tuple[str, int, str]] = []
    for record in document["files"]:
        if not isinstance(record, dict) or set(record) != {"path", "sha256", "size"}:
            raise ValueError("Bundle manifest contains an invalid file record")
        relative, size, digest = record["path"], record["size"], record["sha256"]
        if not isinstance(relative, str):
            raise ValueError("Bundle manifest file path is not a string")
        _validated_relative_path(relative)
        if relative == MANIFEST_NAME:
            raise ValueError("Bundle manifest must not list itself")
        if type(size) is not int or size < 0:
            raise ValueError(f"Bundle manifest has an invalid file size: {relative}")
        if not isinstance(digest, str) or not SHA256.fullmatch(digest):
            raise ValueError(f"Bundle manifest has an invalid SHA-256 digest: {relative}")
        records.append((relative, size, digest))

    paths = [record[0] for record in records]
    if paths != sorted(paths) or len(paths) != len(set(paths)):
        raise ValueError("Bundle manifest paths are not unique canonical order")
    return tuple(records)


def _verify_against_local_index(
    records: tuple[tuple[str, int, str], ...],
    payloads: dict[str, bytes],
) -> None:
    """Compare the archive with immutable stage-zero Git index blobs."""

    sys.dont_write_bytecode = True
    sys.path.insert(0, str(LOCAL_ROOT / "scripts"))
    try:
        from build_release import read_index_blob, release_index_entries
    finally:
        sys.path.pop(0)

    index_entries = release_index_entries(check_worktree=False)
    expected_paths = tuple(entry.path for entry in index_entries)
    actual_paths = tuple(record[0] for record in records)
    if actual_paths != expected_paths:
        missing = sorted(set(expected_paths).difference(actual_paths))
        unexpected = sorted(set(actual_paths).difference(expected_paths))
        if missing:
            raise ValueError(f"Bundle manifest omits local release-index path: {missing[0]}")
        if unexpected:
            raise ValueError(f"Bundle manifest contains a path outside the local release index: {unexpected[0]}")
        raise ValueError("Bundle manifest order differs from the local release index")

    blobs: dict[str, bytes] = {}
    for entry in index_entries:
        if entry.oid not in blobs:
            blobs[entry.oid] = read_index_blob(entry.oid)
        if payloads[entry.path] != blobs[entry.oid]:
            raise ValueError(f"ZIP member bytes differ from the staged Git index: {entry.path}")


def verify_bundle(bundle: Path, *, local_index: bool = False) -> None:
    """Verify an offline manifest and optionally compare it with the Git index."""

    manifest_member = f"{ARCHIVE_ROOT}/{MANIFEST_NAME}"
    try:
        with ZipFile(bundle, "r") as archive:
            if archive.comment:
                raise ValueError("ZIP has a non-canonical archive comment")
            infos = archive.infolist()
            names = [_validated_member_name(info) for info in infos]
            if len(names) != len(set(names)):
                raise ValueError("ZIP contains duplicate member paths")
            roots = {PurePosixPath(name).parts[0] for name in names}
            if roots != {ARCHIVE_ROOT}:
                raise ValueError(f"ZIP does not have exactly one expected root directory: {sorted(roots)}")
            if not names or names[0] != manifest_member:
                raise ValueError("ZIP does not begin with the canonical bundle manifest")

            info_by_name = {info.filename: info for info in infos}
            for info in infos:
                _validate_reproducible_metadata(info)
            _validate_archive_layout(archive, infos, bundle.stat().st_size)
            manifest_payload = archive.read(info_by_name[manifest_member])
            records = _parse_manifest(manifest_payload)
            _scan_member_for_secrets(MANIFEST_NAME, manifest_payload)
            expected_names = [manifest_member, *(f"{ARCHIVE_ROOT}/{record[0]}" for record in records)]
            if names != expected_names:
                actual = set(names)
                expected = set(expected_names)
                missing = sorted(expected.difference(actual))
                unexpected = sorted(actual.difference(expected))
                if missing:
                    raise ValueError(f"ZIP omits bundle-manifest member: {missing[0]}")
                if unexpected:
                    raise ValueError(f"ZIP contains a member outside the bundle manifest: {unexpected[0]}")
                raise ValueError("ZIP members are not in canonical manifest order")

            payloads: dict[str, bytes] = {}
            total_bytes = 0
            for relative, expected_size, expected_digest in records:
                info = info_by_name[f"{ARCHIVE_ROOT}/{relative}"]
                if info.file_size != expected_size:
                    raise ValueError(f"ZIP member size differs from the bundle manifest: {relative}")
                payload = archive.read(info)
                if len(payload) != expected_size or hashlib.sha256(payload).hexdigest() != expected_digest:
                    raise ValueError(f"ZIP member payload differs from the bundle manifest: {relative}")
                _scan_member_for_secrets(relative, payload)
                payloads[relative] = payload
                total_bytes += len(payload)
    except (BadZipFile, KeyError) as error:
        raise ValueError(f"Release bundle is not a structurally valid ZIP: {bundle}") from error

    if local_index:
        _verify_against_local_index(records, payloads)
    print(
        f"PASS {bundle}: {len(records)} manifest files, {total_bytes} source bytes"
        f" ({'local-index' if local_index else 'offline'})"
    )


def main() -> None:
    """Verify the selected v0.6 release bundle."""

    parser = argparse.ArgumentParser()
    parser.add_argument("--bundle", type=Path, default=LOCAL_ROOT / "output" / "release" / BUNDLE_NAME)
    parser.add_argument(
        "--local-index",
        action="store_true",
        help="also compare every member with the stage-zero local Git index",
    )
    args = parser.parse_args()
    bundle = args.bundle.resolve()
    if not bundle.is_file():
        raise FileNotFoundError(f"Missing release bundle: {bundle}")
    verify_bundle(bundle, local_index=args.local_index)


if __name__ == "__main__":
    main()
