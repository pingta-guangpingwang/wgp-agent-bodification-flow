"""Validate the published WGP-ABF PDF editions.

SPDX-License-Identifier: Apache-2.0
"""

from __future__ import annotations

from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
EDITIONS = (
    (
        "zh-CN",
        ROOT / "output" / "pdf" / "WGP-ABF-Whitepaper-v0.4.0-zh-CN.pdf",
        21,
        ("WGP-ABF", "RecipeDiff", "Replay", "王广平"),
    ),
    (
        "en",
        ROOT / "output" / "pdf" / "WGP-ABF-Whitepaper-v0.4.0-en.pdf",
        24,
        ("WGP-ABF", "RecipeDiff", "Replay", "Wang Guangping"),
    ),
)


def main() -> None:
    """Reject missing, blank, misnumbered, or incorrectly attributed PDFs."""

    failures: list[str] = []
    for language, path, expected_pages, required_terms in EDITIONS:
        if not path.is_file():
            failures.append(f"{language}: missing {path}")
            continue

        reader = PdfReader(path)
        texts = [page.extract_text() or "" for page in reader.pages]
        short_pages = [
            page_number
            for page_number, text in enumerate(texts[1:], start=2)
            if len(text.strip()) < 120
        ]
        joined = "\n".join(texts)
        missing_terms = [term for term in required_terms if term not in joined]
        metadata = reader.metadata or {}
        author = str(metadata.get("/Author", ""))

        edition_failures: list[str] = []
        if len(reader.pages) != expected_pages:
            edition_failures.append(f"pages={len(reader.pages)}, expected={expected_pages}")
        if short_pages:
            edition_failures.append(f"short non-cover pages={short_pages}")
        if missing_terms:
            edition_failures.append(f"missing terms={missing_terms}")
        if "Wang Guangping" not in author:
            edition_failures.append(f"unexpected author={author!r}")

        if edition_failures:
            failures.append(f"{language}: " + "; ".join(edition_failures))
        else:
            print(
                f"{language}: {len(reader.pages)} pages, {path.stat().st_size} bytes, "
                f"author={author!r}"
            )

    if failures:
        raise SystemExit("PDF validation failed:\n- " + "\n- ".join(failures))
    print("PDF validation passed.")


if __name__ == "__main__":
    main()
