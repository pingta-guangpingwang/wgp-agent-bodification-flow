# SPDX-License-Identifier: Apache-2.0
"""Build the deterministic WGP-ABF specification bundle and release hashes."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tempfile
import unicodedata
from zipfile import ZIP_STORED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.6.0"
BUNDLE_NAME = f"WGP-ABF-Spec-Bundle-v{VERSION}.zip"
CHECKSUM_NAME = f"WGP-ABF-v{VERSION}-SHA256SUMS.txt"
ARCHIVE_ROOT = f"wgp-abf-spec-bundle-v{VERSION}"
MANIFEST_NAME = "WGP-ABF-BUNDLE-MANIFEST.json"
MANIFEST_FORMAT = "wgp-abf-release-manifest/1"
FIXED_ZIP_TIME = (2026, 8, 27, 0, 0, 0)
REGULAR_INDEX_MODES = frozenset({"100644", "100755"})
OBJECT_ID = re.compile(r"(?:[0-9a-f]{40}|[0-9a-f]{64})\Z")
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

INCLUDED_ROOT_FILES = (
    "README.md",
    "README.zh-CN.md",
    "README.en.md",
    "BUILDING.md",
    "CHANGELOG.md",
    "ROADMAP.md",
    "CONTRIBUTING.md",
    "CODE_OF_CONDUCT.md",
    "GOVERNANCE.md",
    "LANGUAGE_POLICY.md",
    "MIGRATION-v0.5-to-v0.6.md",
    "LICENSE",
    "NOTICE",
    "AUTHORS.md",
    "CITATION.cff",
    "STATUS.md",
    "SECURITY.md",
    "TRADEMARKS.md",
    "requirements-build.txt",
    "package.json",
    "pnpm-lock.yaml",
)
INCLUDED_WHITEPAPER_FILES = (
    "whitepaper/GLOSSARY.md",
    "whitepaper/WGP-ABF_Whitepaper_v0.6.zh-CN.md",
    "whitepaper/WGP-ABF_Whitepaper_v0.6.en.md",
)
INCLUDED_ASSET_FILES = (
    "assets/PROVENANCE.yml",
    "assets/THIRD_PARTY_NOTICES.md",
    "assets/images/wgp-abf-cover-art-v0.4.png",
    "assets/diagrams/wgp-abf-evolution-loop.png",
    "assets/diagrams/wgp-abf-fidelity-matrix.png",
    "assets/diagrams/wgp-abf-nine-stage-flow.png",
    "assets/diagrams/wgp-abf-standard-parts.png",
    "assets/diagrams/wgp-abf-system-map.png",
    "assets/diagrams/wgp-abf-data-contract-chain-v0.6.png",
    "assets/diagrams/wgp-abf-evolution-loop-v0.6.png",
    "assets/diagrams/wgp-abf-fidelity-matrix-v0.6.png",
    "assets/diagrams/wgp-abf-nine-stage-flow-v0.6.png",
    "assets/diagrams/wgp-abf-standard-parts-v0.6.png",
    "assets/diagrams/wgp-abf-system-map-v0.6.png",
)
INCLUDED_LICENSE_FILES = (
    "LICENSES/Apache-2.0.txt",
    "LICENSES/CC-BY-4.0.txt",
    "LICENSES/SIL-OFL-1.1.txt",
)
INCLUDED_SPEC_FILES = (
    "spec/README.md",
    "spec/abir.schema.json",
    "spec/assembly-recipe.schema.json",
    "spec/evaluation.schema.json",
    "spec/module-data-contract.schema.json",
    "spec/recipe-diff.schema.json",
    "spec/runtime-event.schema.json",
    "spec/standard-part-descriptor.schema.json",
)
INCLUDED_GOVERNANCE_FILES = ("governance/README.md",)
INCLUDED_SCRIPT_FILES = (
    "scripts/build_pdfs.py",
    "scripts/build_release.py",
    "scripts/font_paths.py",
    "scripts/lib/canonical-json.mjs",
    "scripts/make_pdf_contact_sheets.py",
    "scripts/render_diagrams.py",
    "scripts/test_release_bundle.py",
    "scripts/update_example_hashes.mjs",
    "scripts/validate_examples.mjs",
    "scripts/validate_pdfs.py",
    "scripts/validate_repository.mjs",
    "scripts/validate_v06_closure.mjs",
    "scripts/verify_release_bundle.py",
)
INCLUDED_TREE_SUFFIXES = {
    "examples": frozenset({".json", ".jsonl", ".md", ".mjs", ".txt"}),
}
PDF_NAMES = (
    "WGP-ABF-Whitepaper-v0.6.0-zh-CN.pdf",
    "WGP-ABF-Whitepaper-v0.6.0-en.pdf",
)
INCLUDED_PDF_FILES = tuple(f"output/pdf/{name}" for name in PDF_NAMES)
SCANNED_DIRECTORIES = (
    "LICENSES",
    "spec",
    "examples",
    "assets",
    "governance",
    "scripts",
    "whitepaper",
    "output/pdf",
)
EXCLUDED_HISTORICAL_FILES = frozenset(
    {
        "whitepaper/WGP-ABF_Whitepaper_v0.4.zh-CN.md",
        "whitepaper/WGP-ABF_Whitepaper_v0.4.en.md",
        "whitepaper/WGP-ABF_Whitepaper_v0.5.zh-CN.md",
        "whitepaper/WGP-ABF_Whitepaper_v0.5.en.md",
        "output/pdf/WGP-ABF-Whitepaper-v0.4.0-zh-CN.pdf",
        "output/pdf/WGP-ABF-Whitepaper-v0.4.0-en.pdf",
        "output/pdf/WGP-ABF-Whitepaper-v0.5.0-zh-CN.pdf",
        "output/pdf/WGP-ABF-Whitepaper-v0.5.0-en.pdf",
    }
)


@dataclass(frozen=True)
class IndexEntry:
    """One regular stage-zero Git index entry selected for release."""

    path: str
    mode: str
    oid: str


@dataclass(frozen=True)
class ReleaseSource:
    """One immutable index blob and its release metadata."""

    entry: IndexEntry
    payload: bytes
    sha256: str


def sha256(path: Path) -> str:
    """Return the lowercase SHA-256 digest for one file."""

    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _normalize_relative_path(value: str) -> str:
    """Return one validated repository-relative portable path."""

    if not value or "\\" in value or any(unicodedata.category(character).startswith("C") for character in value):
        raise ValueError(f"Release path contains an unsafe character: {value!r}")
    segments = value.split("/")
    if any(not segment or segment in {".", ".."} for segment in segments):
        raise ValueError(f"Release path is not normalized: {value!r}")
    for segment in segments:
        if ":" in segment or segment.endswith((".", " ")):
            raise ValueError(f"Release path is not Windows-portable: {value!r}")
        if segment.split(".", 1)[0].casefold() in WINDOWS_RESERVED_BASENAMES:
            raise ValueError(f"Release path uses a Windows reserved name: {value!r}")
    relative = PurePosixPath(value)
    if relative.is_absolute() or relative.as_posix() != value:
        raise ValueError(f"Release path is not repository-relative: {value!r}")
    return value


def _is_zero_oid(value: str) -> bool:
    """Return whether an object id contains only zeroes."""

    return bool(value) and not value.strip("0")


def _intent_to_add_paths(index_paths: set[str]) -> set[str]:
    """Return index paths represented only by intent-to-add entries."""

    result = subprocess.run(
        ["git", "status", "--porcelain=v2", "-z", "--untracked-files=no"],
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE,
    )
    intent_to_add: set[str] = set()
    records = result.stdout.split(b"\0")
    position = 0
    while position < len(records):
        raw = records[position]
        position += 1
        if not raw:
            continue
        if raw.startswith(b"1 "):
            fields = raw.split(b" ", 8)
            if len(fields) != 9:
                raise ValueError("Git returned a malformed status entry")
            raw_index_oid, raw_path = fields[7], fields[8]
        elif raw.startswith(b"2 "):
            fields = raw.split(b" ", 9)
            if len(fields) != 10 or position >= len(records):
                raise ValueError("Git returned a malformed rename status entry")
            raw_index_oid, raw_path = fields[7], fields[9]
            position += 1
        else:
            continue
        relative = _normalize_relative_path(raw_path.decode("utf-8", "surrogateescape"))
        index_oid = raw_index_oid.decode("ascii")
        if relative in index_paths and _is_zero_oid(index_oid):
            intent_to_add.add(relative)
    return intent_to_add


def _git_cached_entries() -> dict[str, IndexEntry]:
    """Return normalized stage-zero entries from the Git index."""

    result = subprocess.run(
        ["git", "ls-files", "--stage", "-z"],
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE,
    )
    entries: dict[str, IndexEntry] = {}
    for raw in result.stdout.split(b"\0"):
        if not raw:
            continue
        metadata, separator, raw_path = raw.partition(b"\t")
        fields = metadata.split()
        if not separator or len(fields) != 3:
            raise ValueError("Git returned a malformed release-source index entry")
        raw_mode, raw_oid, raw_stage = fields
        relative = _normalize_relative_path(raw_path.decode("utf-8", "surrogateescape"))
        mode = raw_mode.decode("ascii")
        oid = raw_oid.decode("ascii")
        if raw_stage != b"0":
            raise ValueError(f"Release source has an unresolved index stage: {relative}")
        if relative in entries:
            raise ValueError(f"Release source has duplicate Git index entries: {relative}")
        if not OBJECT_ID.fullmatch(oid) or _is_zero_oid(oid):
            raise ValueError(f"Release source has an invalid or zero object id: {relative}")
        entries[relative] = IndexEntry(relative, mode, oid)

    intent_to_add = sorted(_intent_to_add_paths(set(entries)))
    if intent_to_add:
        raise ValueError(f"Release source is only intent-to-add, not staged: {intent_to_add[0]}")
    return entries


def _walk_without_links(directory: Path) -> tuple[set[str], list[str]]:
    """Return regular files below ``directory`` without following links."""

    files: set[str] = set()
    violations: list[str] = []
    if directory.is_symlink():
        violations.append(f"release source is a symbolic link: {directory.relative_to(ROOT).as_posix()}")
        return files, violations
    if not directory.is_dir():
        violations.append(f"missing release source directory: {directory.relative_to(ROOT).as_posix()}")
        return files, violations

    pending = [directory]
    while pending:
        current = pending.pop()
        for child in current.iterdir():
            relative = child.relative_to(ROOT).as_posix()
            if child.is_symlink():
                violations.append(f"release source is a symbolic link: {relative}")
                continue
            if child.is_dir():
                pending.append(child)
                continue
            if child.is_file():
                files.add(_normalize_relative_path(relative))
                continue
            violations.append(f"release source is not a regular file: {relative}")
    return files, violations


def _is_included(relative: str) -> bool:
    """Return whether one tracked path belongs to the v0.6 release allowlist."""

    if (
        relative in INCLUDED_ROOT_FILES
        or relative in INCLUDED_WHITEPAPER_FILES
        or relative in INCLUDED_ASSET_FILES
        or relative in INCLUDED_LICENSE_FILES
        or relative in INCLUDED_SPEC_FILES
        or relative in INCLUDED_GOVERNANCE_FILES
        or relative in INCLUDED_SCRIPT_FILES
        or relative in INCLUDED_PDF_FILES
    ):
        return True
    path = PurePosixPath(relative)
    for tree, suffixes in INCLUDED_TREE_SUFFIXES.items():
        if path.parts[0] == tree and path.suffix.lower() in suffixes:
            return True
    return False


def _is_in_scanned_directory(relative: str) -> bool:
    """Return whether an index path belongs to a release-source directory."""

    path_parts = PurePosixPath(relative).parts
    return any(
        path_parts[: len(directory_parts)] == directory_parts
        for directory_parts in (PurePosixPath(directory).parts for directory in SCANNED_DIRECTORIES)
    )


def release_index_entries(*, check_worktree: bool = True) -> tuple[IndexEntry, ...]:
    """Return the exact regular stage-zero Git index manifest for the bundle."""

    index_entries = _git_cached_entries()
    tracked = set(index_entries)
    required = (
        set(INCLUDED_ROOT_FILES)
        | set(INCLUDED_WHITEPAPER_FILES)
        | set(INCLUDED_ASSET_FILES)
        | set(INCLUDED_LICENSE_FILES)
        | set(INCLUDED_SPEC_FILES)
        | set(INCLUDED_GOVERNANCE_FILES)
        | set(INCLUDED_SCRIPT_FILES)
        | set(INCLUDED_PDF_FILES)
    )
    missing_from_index = sorted(required.difference(tracked))
    if missing_from_index:
        raise ValueError(
            "Release inputs must have stage-zero entries before packaging; missing from index: "
            f"{missing_from_index[0]}"
        )

    violations: list[str] = []
    allowed = set(required)
    allowed.update(relative for relative in tracked if _is_included(relative))
    if check_worktree:
        physical: set[str] = set()
        for relative in SCANNED_DIRECTORIES:
            discovered, directory_violations = _walk_without_links(ROOT / PurePosixPath(relative))
            physical.update(discovered)
            violations.extend(directory_violations)

        untracked = sorted(physical.difference(tracked))
        if untracked:
            violations.append(
                "release source directories contain an untracked or ignored file: "
                f"{untracked[0]}"
            )

        missing_from_worktree = sorted(
            relative for relative in allowed if not (ROOT / PurePosixPath(relative)).is_file()
        )
        if missing_from_worktree:
            violations.append(f"release input is missing from the worktree: {missing_from_worktree[0]}")

        linked = sorted(relative for relative in allowed if (ROOT / PurePosixPath(relative)).is_symlink())
        if linked:
            violations.append(f"release input is a symbolic link: {linked[0]}")

    source_scope = allowed | {relative for relative in tracked if _is_in_scanned_directory(relative)}
    non_regular_index_entries = sorted(
        relative for relative in source_scope if index_entries[relative].mode not in REGULAR_INDEX_MODES
    )
    if non_regular_index_entries:
        relative = non_regular_index_entries[0]
        violations.append(
            "release source is not a regular Git index entry: "
            f"{relative} ({index_entries[relative].mode})"
        )

    disallowed_tracked = sorted(
        relative
        for relative in tracked
        if _is_in_scanned_directory(relative)
        if not _is_included(relative) and relative not in EXCLUDED_HISTORICAL_FILES
    )
    if disallowed_tracked:
        violations.append(f"tracked release-tree file is outside the allowlist: {disallowed_tracked[0]}")

    if violations:
        raise ValueError("; ".join(violations))
    return tuple(index_entries[relative] for relative in sorted(allowed))


def release_relative_files() -> tuple[str, ...]:
    """Return the exact sorted repository-relative release paths."""

    return tuple(entry.path for entry in release_index_entries())


def read_index_blob(oid: str) -> bytes:
    """Read one immutable blob by object id through Git."""

    if not OBJECT_ID.fullmatch(oid) or _is_zero_oid(oid):
        raise ValueError("Cannot read an invalid or zero Git object id")
    result = subprocess.run(
        ["git", "cat-file", "blob", oid],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if result.returncode != 0:
        raise ValueError(f"Git could not read release blob {oid}")
    return result.stdout


def release_sources(entries: tuple[IndexEntry, ...] | None = None) -> tuple[ReleaseSource, ...]:
    """Read the selected release payloads only from immutable index objects."""

    selected = entries if entries is not None else release_index_entries()
    blobs: dict[str, bytes] = {}
    sources: list[ReleaseSource] = []
    for entry in selected:
        if entry.oid not in blobs:
            blobs[entry.oid] = read_index_blob(entry.oid)
        payload = blobs[entry.oid]
        sources.append(ReleaseSource(entry, payload, hashlib.sha256(payload).hexdigest()))
    return tuple(sources)


def _canonical_manifest_bytes(sources: tuple[ReleaseSource, ...]) -> bytes:
    """Return the canonical self-describing bundle manifest."""

    document = {
        "archiveRoot": ARCHIVE_ROOT,
        "files": [
            {"path": source.entry.path, "size": len(source.payload), "sha256": source.sha256}
            for source in sources
        ],
        "format": MANIFEST_FORMAT,
        "version": VERSION,
    }
    return json.dumps(document, ensure_ascii=True, sort_keys=True, separators=(",", ":")).encode("utf-8") + b"\n"


def _write_member(archive: ZipFile, name: str, payload: bytes) -> None:
    """Write one member with canonical cross-platform metadata."""

    # Stored entries avoid platform-zlib differences; bundled PDFs and PNGs are already compressed.
    info = ZipInfo(name, FIXED_ZIP_TIME)
    info.compress_type = ZIP_STORED
    info.create_system = 3
    info.external_attr = 0o100644 << 16
    archive.writestr(info, payload, compress_type=ZIP_STORED)


def write_bundle(
    destination: Path,
    sources: tuple[ReleaseSource, ...] | None = None,
) -> tuple[ReleaseSource, ...]:
    """Write a reproducible ZIP archive from one immutable index snapshot."""

    selected = sources if sources is not None else release_sources()
    with ZipFile(destination, "w", compression=ZIP_STORED) as archive:
        _write_member(archive, f"{ARCHIVE_ROOT}/{MANIFEST_NAME}", _canonical_manifest_bytes(selected))
        for source in selected:
            _write_member(archive, f"{ARCHIVE_ROOT}/{source.entry.path}", source.payload)
    return selected


def verify_written_bundle(bundle: Path) -> None:
    """Run the independent release-bundle verifier against the Git index."""

    subprocess.run(
        [
            sys.executable,
            "-B",
            str(ROOT / "scripts" / "verify_release_bundle.py"),
            "--bundle",
            str(bundle),
            "--local-index",
        ],
        cwd=ROOT,
        check=True,
    )


def main() -> None:
    """Build the bundle and versioned SHA-256 manifest."""

    output = ROOT / "output" / "release"
    output.mkdir(parents=True, exist_ok=True)
    sources = release_sources()
    source_by_path = {source.entry.path: source for source in sources}
    release_hashes: list[tuple[str, str]] = []
    bundle = output / BUNDLE_NAME
    with tempfile.NamedTemporaryFile(prefix=f".{BUNDLE_NAME}.", suffix=".tmp", dir=output, delete=False) as stream:
        temporary_bundle = Path(stream.name)
    try:
        write_bundle(temporary_bundle, sources)
        verify_written_bundle(temporary_bundle)
        for name in PDF_NAMES:
            relative = f"output/pdf/{name}"
            source = source_by_path[relative]
            artifact = ROOT / PurePosixPath(relative)
            if sha256(artifact) != source.sha256:
                raise ValueError(f"Release PDF worktree bytes differ from the staged index: {relative}")
            release_hashes.append((name, source.sha256))
        temporary_bundle.replace(bundle)
    finally:
        temporary_bundle.unlink(missing_ok=True)

    release_hashes.append((bundle.name, sha256(bundle)))

    checksums = "\n".join(f"{digest}  {name}" for name, digest in release_hashes) + "\n"
    checksum_path = output / CHECKSUM_NAME
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        newline="\n",
        prefix=f".{CHECKSUM_NAME}.",
        suffix=".tmp",
        dir=output,
        delete=False,
    ) as stream:
        temporary_checksum = Path(stream.name)
        stream.write(checksums)
    try:
        temporary_checksum.replace(checksum_path)
    finally:
        temporary_checksum.unlink(missing_ok=True)

    print(f"PASS {bundle.relative_to(ROOT)}")
    print(f"PASS {checksum_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
