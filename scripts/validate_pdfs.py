"""Validate the publication and provenance properties of WGP-ABF PDFs.

SPDX-License-Identifier: Apache-2.0
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Iterable

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
MIGRATION_URL = (
    "https://github.com/pingta-guangpingwang/wgp-agent-bodification-flow/"
    "blob/v0.6.0/MIGRATION-v0.5-to-v0.6.md"
)
EDITIONS = (
    {
        "language": "zh-CN",
        "path": ROOT / "output" / "pdf" / "WGP-ABF-Whitepaper-v0.6.0-zh-CN.pdf",
        "expected_pages": 35,
        "title": "WGP 智能体机体化流程（WGP-ABF）：模块数据契约、智能体工程图纸与证据化演进框架",
        "subject_term": "模块数据契约、智能体工程图纸与证据化演进框架",
        "required_terms": (
            "WGP-ABF",
            "ModuleDataContract",
            "StandardPartDescriptor",
            "InterchangeabilityAssessment",
            "EvidenceStatusRecord",
            "RecipeDiff",
            "Replay",
            "王广平",
            "图 1",
            "图 2",
            "图 3",
            "图 4",
            "图 5",
            "图 6",
        ),
    },
    {
        "language": "en-US",
        "path": ROOT / "output" / "pdf" / "WGP-ABF-Whitepaper-v0.6.0-en.pdf",
        "expected_pages": 40,
        "title": (
            "WGP Agent Bodification Flow (WGP-ABF): Module Data Contracts, "
            "Agent Engineering Blueprints, and Evidence-Governed Evolution"
        ),
        "subject_term": "Module Data Contracts, Agent Engineering Blueprints, and Evidence-Governed Evolution",
        "required_terms": (
            "WGP-ABF",
            "ModuleDataContract",
            "StandardPartDescriptor",
            "InterchangeabilityAssessment",
            "EvidenceStatusRecord",
            "RecipeDiff",
            "Replay",
            "Wang Guangping",
            "Figure 1",
            "Figure 2",
            "Figure 3",
            "Figure 4",
            "Figure 5",
            "Figure 6",
        ),
    },
)


def resolved(value: Any) -> Any:
    """Resolve a pypdf indirect object when needed."""

    return value.get_object() if hasattr(value, "get_object") else value


def leaf_fonts(font: Any) -> Iterable[tuple[str, bool]]:
    """Yield base names and embedding status for leaf PDF fonts."""

    font = resolved(font)
    descendants = resolved(font.get("/DescendantFonts", []))
    if descendants:
        for descendant in descendants:
            yield from leaf_fonts(descendant)
        return
    descriptor = resolved(font.get("/FontDescriptor", {}))
    embedded = any(name in descriptor for name in ("/FontFile", "/FontFile2", "/FontFile3"))
    yield str(font.get("/BaseFont", "")), embedded


def page_fonts(page: Any) -> list[tuple[str, bool]]:
    """Return all leaf fonts reachable from one page resource dictionary."""

    resources = resolved(page.get("/Resources", {}))
    fonts = resolved(resources.get("/Font", {}))
    return [record for font in fonts.values() for record in leaf_fonts(font)]


def outline_count(items: Iterable[Any]) -> int:
    """Count destinations in pypdf's nested outline representation."""

    total = 0
    for item in items:
        if isinstance(item, list):
            total += outline_count(item)
        else:
            total += 1
    return total


def uri_annotations(reader: PdfReader) -> list[str]:
    """Collect URI link annotations from every page."""

    uris: list[str] = []
    for page in reader.pages:
        for reference in resolved(page.get("/Annots", [])):
            annotation = resolved(reference)
            action = resolved(annotation.get("/A", {}))
            if str(action.get("/S", "")) == "/URI":
                uris.append(str(action.get("/URI", "")))
    return uris


def main() -> None:
    """Reject incomplete, non-A4, unlicensed-font, or malformed editions."""

    failures: list[str] = []
    for edition in EDITIONS:
        language = str(edition["language"])
        path = Path(edition["path"])
        if not path.is_file():
            failures.append(f"{language}: missing {path}")
            continue

        reader = PdfReader(path)
        texts = [page.extract_text() or "" for page in reader.pages]
        joined = "\n".join(texts)
        metadata = reader.metadata or {}
        edition_failures: list[str] = []

        if reader.is_encrypted:
            edition_failures.append("PDF is encrypted")
        expected_pages = int(edition["expected_pages"])
        if len(reader.pages) != expected_pages:
            edition_failures.append(f"pages={len(reader.pages)}, expected={expected_pages}")
        short_pages = [
            number
            for number, text in enumerate(texts[1:], start=2)
            if len(text.strip()) < 120
        ]
        if short_pages:
            edition_failures.append(f"short non-cover pages={short_pages}")
        missing_terms = [term for term in edition["required_terms"] if term not in joined]
        if missing_terms:
            edition_failures.append(f"missing terms={missing_terms}")
        if "](" in joined:
            edition_failures.append("raw Markdown link syntax appears in extracted text")

        if str(metadata.get("/Title", "")) != edition["title"]:
            edition_failures.append(f"unexpected title={metadata.get('/Title', '')!r}")
        if "Wang Guangping" not in str(metadata.get("/Author", "")):
            edition_failures.append(f"unexpected author={metadata.get('/Author', '')!r}")
        if edition["subject_term"] not in str(metadata.get("/Subject", "")):
            edition_failures.append(f"unexpected subject={metadata.get('/Subject', '')!r}")
        if str(metadata.get("/Creator", "")) != "WGP-ABF deterministic PDF builder":
            edition_failures.append(f"unexpected creator={metadata.get('/Creator', '')!r}")
        for date_name in ("/CreationDate", "/ModDate"):
            if "20000101" not in str(metadata.get(date_name, "")):
                edition_failures.append(f"non-invariant {date_name}={metadata.get(date_name, '')!r}")

        root = resolved(reader.trailer["/Root"])
        if str(root.get("/Lang", "")) != language:
            edition_failures.append(f"unexpected document language={root.get('/Lang', '')!r}")
        if outline_count(reader.outline) < 12:
            edition_failures.append("fewer than 12 outline destinations")

        uris = uri_annotations(reader)
        if MIGRATION_URL not in uris:
            edition_failures.append("tag-pinned migration URI annotation is missing")
        invalid_uris = [uri for uri in uris if not uri.startswith("https://")]
        if invalid_uris:
            edition_failures.append(f"non-HTTPS URI annotations={invalid_uris}")

        fonts = sorted(set(record for page in reader.pages for record in page_fonts(page)))
        if not fonts:
            edition_failures.append("no page fonts found")
        for base_name, embedded in fonts:
            if not embedded:
                edition_failures.append(f"font is not embedded: {base_name}")
            if "NotoSansSC" not in base_name.replace(" ", ""):
                edition_failures.append(f"font is not approved Noto Sans SC: {base_name}")

        for number, page in enumerate(reader.pages, start=1):
            width = float(page.mediabox.width)
            height = float(page.mediabox.height)
            if abs(width - 595.2756) > 0.75 or abs(height - 841.8898) > 0.75:
                edition_failures.append(f"page {number} is not A4: {width:.2f}x{height:.2f}")

        if edition_failures:
            failures.append(f"{language}: " + "; ".join(edition_failures))
        else:
            print(
                f"{language}: {len(reader.pages)} A4 pages, {path.stat().st_size} bytes, "
                f"{len(uris)} URI links, fonts={fonts}"
            )

    if failures:
        raise SystemExit("PDF validation failed:\n- " + "\n- ".join(failures))
    print("PDF validation passed.")


if __name__ == "__main__":
    main()
