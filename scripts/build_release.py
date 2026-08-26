# SPDX-License-Identifier: Apache-2.0
"""Build the deterministic WGP-ABF specification bundle and release hashes."""

from __future__ import annotations

import hashlib
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.4.0"
BUNDLE_NAME = f"WGP-ABF-Spec-Bundle-v{VERSION}.zip"
ARCHIVE_ROOT = f"wgp-abf-spec-bundle-v{VERSION}"
FIXED_ZIP_TIME = (2026, 8, 26, 0, 0, 0)

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
INCLUDED_TREES = ("LICENSES", "spec", "examples", "whitepaper", "assets", "archive", "governance", "output/pdf")
PDF_NAMES = (
    "WGP-ABF-Whitepaper-v0.4.0-zh-CN.pdf",
    "WGP-ABF-Whitepaper-v0.4.0-en.pdf",
)


def sha256(path: Path) -> str:
    """Return the lowercase SHA-256 digest for one file."""

    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def bundle_files() -> list[Path]:
    """Return the sorted repository-relative files included in the bundle."""

    files = [ROOT / name for name in INCLUDED_ROOT_FILES]
    files.extend(path for path in (ROOT / "scripts").glob("*") if path.suffix in {".mjs", ".py"})
    for tree in INCLUDED_TREES:
        files.extend(path for path in (ROOT / tree).rglob("*") if path.is_file())
    missing = [path for path in files if not path.is_file()]
    if missing:
        raise FileNotFoundError(f"Missing release input: {missing[0]}")
    return sorted(set(files), key=lambda path: path.relative_to(ROOT).as_posix())


def write_bundle(destination: Path) -> None:
    """Write a reproducible ZIP archive to ``destination``."""

    with ZipFile(destination, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for source in bundle_files():
            relative = source.relative_to(ROOT).as_posix()
            info = ZipInfo(f"{ARCHIVE_ROOT}/{relative}", FIXED_ZIP_TIME)
            info.compress_type = ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            archive.writestr(info, source.read_bytes(), compress_type=ZIP_DEFLATED, compresslevel=9)


def main() -> None:
    """Build the bundle and SHA256SUMS file."""

    output = ROOT / "output" / "release"
    output.mkdir(parents=True, exist_ok=True)
    bundle = output / BUNDLE_NAME
    write_bundle(bundle)

    release_files = [ROOT / "output" / "pdf" / name for name in PDF_NAMES]
    release_files.append(bundle)
    missing = [path for path in release_files if not path.is_file()]
    if missing:
        raise FileNotFoundError(f"Missing release artifact: {missing[0]}")

    checksums = "\n".join(f"{sha256(path)}  {path.name}" for path in release_files) + "\n"
    checksum_path = output / "SHA256SUMS.txt"
    checksum_path.write_text(checksums, encoding="utf-8", newline="\n")

    print(f"PASS {bundle.relative_to(ROOT)}")
    print(f"PASS {checksum_path.relative_to(ROOT)}")
    for path in release_files:
        print(f"SHA256 {sha256(path)}  {path.name}")


if __name__ == "__main__":
    main()
