"""Build the bilingual WGP-ABF whitepapers as publication-ready PDFs.

SPDX-License-Identifier: Apache-2.0
"""

from __future__ import annotations

import argparse
import html
import re
from pathlib import Path
from typing import Iterable

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    CondPageBreak,
    Flowable,
    Frame,
    Image,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

from font_paths import publication_fonts


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf"
PAGE_WIDTH, PAGE_HEIGHT = A4
NAVY = colors.HexColor("#061b2e")
PANEL = colors.HexColor("#0d3655")
CYAN = colors.HexColor("#2bd2ff")
BLUE = colors.HexColor("#337dff")
INK = colors.HexColor("#13283a")
MUTED = colors.HexColor("#5e7080")
LIGHT = colors.HexColor("#edf4f8")
GRID = colors.HexColor("#c9d7e1")
AMBER = colors.HexColor("#ffb838")


def register_fonts() -> tuple[Path, Path, Path]:
    """Register the open fonts used by both editions and return their paths."""

    regular, bold, monospace = publication_fonts()
    pdfmetrics.registerFont(TTFont("WGPBody", str(regular)))
    pdfmetrics.registerFont(TTFont("WGPBold", str(bold)))
    pdfmetrics.registerFont(TTFont("WGPMono", str(monospace)))
    pdfmetrics.registerFontFamily(
        "WGPBody",
        normal="WGPBody",
        bold="WGPBold",
        italic="WGPBody",
        boldItalic="WGPBold",
    )
    return regular, bold, monospace


class Rule(Flowable):
    """A compact cyan rule used between major blocks."""

    def __init__(self, width: float, thickness: float = 1.2) -> None:
        super().__init__()
        self.width = width
        self.height = 5 * mm
        self.thickness = thickness

    def draw(self) -> None:
        self.canv.setStrokeColor(CYAN)
        self.canv.setLineWidth(self.thickness)
        self.canv.line(0, 2 * mm, self.width, 2 * mm)


class WhitepaperDocument(BaseDocTemplate):
    """Document template with a generated table of contents."""

    def __init__(self, filename: str, *, language: str, **kwargs: object) -> None:
        super().__init__(filename, **kwargs)
        self.language = language
        self._bookmark_counter = 0

    def beforeDocument(self) -> None:  # noqa: N802
        """Reset deterministic bookmark ids at the start of each TOC pass."""

        self._bookmark_counter = 0

    def afterFlowable(self, flowable: Flowable) -> None:  # noqa: N802
        """Collect heading entries for the table of contents."""

        if not isinstance(flowable, Paragraph):
            return
        style_name = flowable.style.name
        if style_name not in {"WGPHeading1", "WGPHeading2"}:
            return
        level = 0 if style_name == "WGPHeading1" else 1
        text = flowable.getPlainText()
        key = f"heading-{self._bookmark_counter}"
        self._bookmark_counter += 1
        self.canv.bookmarkPage(key)
        self.canv.addOutlineEntry(text, key, level=level, closed=False)
        self.notify("TOCEntry", (level, text, self.page, key))


def make_styles(language: str) -> dict[str, ParagraphStyle]:
    """Return the document style system."""

    sample = getSampleStyleSheet()
    body_size = 10.2 if language == "zh" else 10.4
    body_leading = 17 if language == "zh" else 15.5
    common = {
        "fontName": "WGPBody",
        "textColor": INK,
        "wordWrap": "CJK" if language == "zh" else None,
    }
    return {
        "body": ParagraphStyle(
            "WGPBodyText",
            parent=sample["BodyText"],
            fontSize=body_size,
            leading=body_leading,
            alignment=TA_JUSTIFY,
            spaceAfter=3.2 * mm,
            allowWidows=0,
            allowOrphans=0,
            **common,
        ),
        "lead": ParagraphStyle(
            "WGPLead",
            parent=sample["BodyText"],
            fontName="WGPBody",
            fontSize=13,
            leading=21,
            textColor=PANEL,
            borderColor=CYAN,
            borderWidth=0,
            borderPadding=(3 * mm, 4 * mm, 3 * mm, 4 * mm),
            backColor=LIGHT,
            leftIndent=0,
            rightIndent=0,
            spaceBefore=2 * mm,
            spaceAfter=6 * mm,
            wordWrap="CJK" if language == "zh" else None,
        ),
        "h1": ParagraphStyle(
            "WGPHeading1",
            parent=sample["Heading1"],
            fontName="WGPBold",
            fontSize=22,
            leading=29,
            textColor=NAVY,
            spaceBefore=3 * mm,
            spaceAfter=5 * mm,
            keepWithNext=True,
            wordWrap="CJK" if language == "zh" else None,
        ),
        "h2": ParagraphStyle(
            "WGPHeading2",
            parent=sample["Heading2"],
            fontName="WGPBold",
            fontSize=15.5,
            leading=21,
            textColor=PANEL,
            spaceBefore=5 * mm,
            spaceAfter=3 * mm,
            keepWithNext=False,
            wordWrap="CJK" if language == "zh" else None,
        ),
        "h3": ParagraphStyle(
            "WGPHeading3",
            parent=sample["Heading3"],
            fontName="WGPBold",
            fontSize=12,
            leading=17,
            textColor=BLUE,
            spaceBefore=4 * mm,
            spaceAfter=2 * mm,
            keepWithNext=True,
            wordWrap="CJK" if language == "zh" else None,
        ),
        "caption": ParagraphStyle(
            "WGPCaption",
            parent=sample["BodyText"],
            fontName="WGPBody",
            fontSize=8.5,
            leading=12.5,
            textColor=MUTED,
            alignment=TA_CENTER,
            spaceBefore=2 * mm,
            spaceAfter=5 * mm,
            wordWrap="CJK" if language == "zh" else None,
        ),
        "table_header": ParagraphStyle(
            "WGPTableHeader",
            parent=sample["BodyText"],
            fontName="WGPBold",
            fontSize=8.6,
            leading=12,
            textColor=colors.white,
            wordWrap="CJK" if language == "zh" else None,
        ),
        "table_cell": ParagraphStyle(
            "WGPTableCell",
            parent=sample["BodyText"],
            fontName="WGPBody",
            fontSize=8.3,
            leading=11.5,
            textColor=INK,
            alignment=TA_LEFT,
            spaceAfter=0,
            wordWrap="CJK" if language == "zh" else None,
        ),
        "part": ParagraphStyle(
            "WGPPart",
            parent=sample["Heading2"],
            fontName="WGPBold",
            fontSize=10,
            leading=14,
            textColor=BLUE,
            spaceBefore=5 * mm,
            spaceAfter=4 * mm,
            keepWithNext=False,
        ),
        "quote": ParagraphStyle(
            "WGPQuote",
            parent=sample["BodyText"],
            fontName="WGPBody",
            fontSize=11.5,
            leading=18,
            textColor=PANEL,
            leftIndent=7 * mm,
            rightIndent=4 * mm,
            borderColor=CYAN,
            borderWidth=0,
            borderPadding=(2 * mm, 3 * mm, 2 * mm, 4 * mm),
            backColor=LIGHT,
            spaceAfter=5 * mm,
            wordWrap="CJK" if language == "zh" else None,
        ),
        "bullet": ParagraphStyle(
            "WGPBullet",
            parent=sample["BodyText"],
            fontName="WGPBody",
            fontSize=body_size,
            leading=body_leading,
            textColor=INK,
            leftIndent=5 * mm,
            firstLineIndent=0,
            spaceAfter=1.8 * mm,
            wordWrap="CJK" if language == "zh" else None,
        ),
        "code": ParagraphStyle(
            "WGPCode",
            parent=sample["Code"],
            fontName="WGPMono",
            fontSize=7.6,
            leading=11,
            textColor=colors.HexColor("#0b4161"),
            backColor=LIGHT,
            borderColor=GRID,
            borderWidth=0.5,
            borderPadding=4 * mm,
            leftIndent=0,
            rightIndent=0,
            spaceBefore=2 * mm,
            spaceAfter=5 * mm,
        ),
        "toc_title": ParagraphStyle(
            "WGPTocTitle",
            parent=sample["Heading1"],
            fontName="WGPBold",
            fontSize=24,
            leading=30,
            textColor=NAVY,
            spaceAfter=8 * mm,
        ),
    }


def inline_markup(text: str) -> str:
    """Convert the small Markdown inline subset used by the whitepaper."""

    value = html.escape(text, quote=False)
    value = re.sub(
        r"\[([^\]]+)\]\((https?://[^)]+)\)",
        lambda match: f'<link href="{html.escape(match.group(2), quote=True)}" color="#176b9b">{match.group(1)}</link>',
        value,
    )
    value = re.sub(r"`([^`]+)`", r'<font name="WGPMono" color="#0b5c86">\1</font>', value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"\*([^*]+)\*", r"<i>\1</i>", value)
    return value


def split_markdown_row(line: str) -> list[str]:
    """Split a Markdown table row without treating code-span pipes as separators."""

    value = line.strip().strip("|")
    cells: list[str] = []
    cell: list[str] = []
    in_code = False
    escaped = False
    for character in value:
        if escaped:
            cell.append(character)
            escaped = False
            continue
        if character == "\\":
            escaped = True
            cell.append(character)
            continue
        if character == "`":
            in_code = not in_code
            cell.append(character)
            continue
        if character == "|" and not in_code:
            cells.append("".join(cell).strip())
            cell.clear()
            continue
        cell.append(character)
    cells.append("".join(cell).strip())
    return cells


def table_from_markdown(lines: list[str], styles: dict[str, ParagraphStyle], available_width: float) -> Table:
    """Create a styled table from contiguous pipe-delimited Markdown rows."""

    rows: list[list[Paragraph]] = []
    for index, line in enumerate(lines):
        cells = split_markdown_row(line)
        if index == 1 and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells):
            continue
        cell_style = styles["table_header"] if index == 0 else styles["table_cell"]
        rows.append([Paragraph(inline_markup(cell), cell_style) for cell in cells])
    columns = max(len(row) for row in rows)
    for row in rows:
        row.extend([Paragraph("", styles["body"])] * (columns - len(row)))
    col_width = available_width / columns
    table = Table(rows, colWidths=[col_width] * columns, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), PANEL),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, -1), "WGPBody"),
                ("FONTNAME", (0, 0), (-1, 0), "WGPBold"),
                ("GRID", (0, 0), (-1, -1), 0.55, GRID),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 2.2 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2.2 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 2.4 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.4 * mm),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
            ]
        )
    )
    return table


def image_flowable(source: Path, available_width: float) -> Image:
    """Fit a source image within a page-safe diagram box."""

    image = Image(str(source))
    max_width = available_width
    max_height = 108 * mm
    scale = min(max_width / image.imageWidth, max_height / image.imageHeight)
    image.drawWidth = image.imageWidth * scale
    image.drawHeight = image.imageHeight * scale
    image.hAlign = "CENTER"
    return image


def markdown_story(path: Path, styles: dict[str, ParagraphStyle], available_width: float, language: str) -> list[Flowable]:
    """Parse the project's controlled Markdown subset into Platypus flowables."""

    lines = path.read_text(encoding="utf-8").splitlines()
    story: list[Flowable] = []
    paragraph: list[str] = []
    bullets: list[tuple[int, str]] = []
    in_code = False
    code_lines: list[str] = []
    started = False

    def flush_paragraph() -> None:
        if paragraph:
            text = " ".join(item.strip() for item in paragraph).strip()
            if text:
                style = styles["caption"] if re.match(r"^(\*?Figure|\*?图\s*\d+|\*\*Figure|\*\*图\s*\d+)", text) else styles["body"]
                story.append(Paragraph(inline_markup(text), style))
            paragraph.clear()

    def flush_bullets() -> None:
        if not bullets:
            return
        ordered = all(number > 0 for number, _ in bullets)
        for number, text in bullets:
            label = f"{number}." if ordered else "—"
            story.append(
                Paragraph(
                    f'<font name="WGPBold" color="#337dff">{label}</font>&nbsp;&nbsp;{inline_markup(text)}',
                    styles["bullet"],
                )
            )
        story.append(Spacer(1, 1.5 * mm))
        bullets.clear()

    index = 0
    while index < len(lines):
        line = lines[index]
        stripped = line.strip()

        if not started:
            target = "## 摘要" if language == "zh" else "## Abstract"
            if stripped == target:
                started = True
            else:
                index += 1
                continue

        if stripped.startswith("```"):
            flush_paragraph()
            flush_bullets()
            if in_code:
                story.append(
                    KeepTogether(
                        [Preformatted("\n".join(code_lines), styles["code"], maxLineLength=104)]
                    )
                )
                code_lines.clear()
                in_code = False
            else:
                in_code = True
            index += 1
            continue
        if in_code:
            code_lines.append(line)
            index += 1
            continue

        if stripped.startswith("|") and index + 1 < len(lines) and lines[index + 1].strip().startswith("|"):
            flush_paragraph()
            flush_bullets()
            table_lines = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                table_lines.append(lines[index])
                index += 1
            story.append(table_from_markdown(table_lines, styles, available_width))
            story.append(Spacer(1, 5 * mm))
            continue

        image_match = re.fullmatch(r"!\[([^\]]*)\]\(([^)]+)\)", stripped)
        if image_match:
            flush_paragraph()
            flush_bullets()
            relative = image_match.group(2)
            if "cover-art" not in relative:
                image_path = (path.parent / relative).resolve()
                figure: list[Flowable] = [Spacer(1, 2 * mm), image_flowable(image_path, available_width)]
                caption_index = index + 1
                while caption_index < len(lines) and not lines[caption_index].strip():
                    caption_index += 1
                if caption_index < len(lines) and re.match(
                    r"^\*\*(?:Figure|图\s*\d+)", lines[caption_index].strip()
                ):
                    figure.append(Paragraph(inline_markup(lines[caption_index].strip()), styles["caption"]))
                    index = caption_index
                story.append(KeepTogether(figure))
            index += 1
            continue

        heading = re.match(r"^(#{1,4})\s+(.+)$", stripped)
        if heading:
            flush_paragraph()
            flush_bullets()
            hashes, title = heading.groups()
            if len(hashes) == 1:
                if title.startswith("Part "):
                    story.append(CondPageBreak(32 * mm))
                    story.append(Paragraph(inline_markup(title), styles["part"]))
                else:
                    story.append(CondPageBreak(62 * mm))
                    story.append(Paragraph(inline_markup(title), styles["h1"]))
                    story.append(Rule(available_width * 0.23))
            elif len(hashes) == 2:
                if story and re.match(r"^(\d+\.|Appendix|附录|References|参考资料|Revision|修订|Version History)", title):
                    story.append(CondPageBreak(62 * mm))
                story.append(Paragraph(inline_markup(title), styles["h1"]))
                story.append(Rule(available_width * 0.23))
            elif len(hashes) == 3:
                story.append(CondPageBreak(34 * mm))
                story.append(Paragraph(inline_markup(title), styles["h2"]))
            else:
                story.append(Paragraph(inline_markup(title), styles["h3"]))
            index += 1
            continue

        list_match = re.match(r"^(?:[-*]|(\d+)\.)\s+(.+)$", stripped)
        if list_match:
            flush_paragraph()
            number = int(list_match.group(1)) if list_match.group(1) else 0
            bullets.append((number, list_match.group(2)))
            index += 1
            continue

        if stripped.startswith(">"):
            flush_paragraph()
            flush_bullets()
            quote_lines = []
            while index < len(lines) and lines[index].strip().startswith(">"):
                quote_lines.append(lines[index].strip().lstrip(">").strip())
                index += 1
            story.append(Paragraph(inline_markup(" ".join(quote_lines)), styles["quote"]))
            continue

        if stripped in {"---", "***"}:
            flush_paragraph()
            flush_bullets()
            story.append(Spacer(1, 3 * mm))
            index += 1
            continue

        if not stripped:
            flush_paragraph()
            flush_bullets()
        else:
            paragraph.append(stripped)
        index += 1

    flush_paragraph()
    flush_bullets()
    return story


def draw_cover(canvas, doc: WhitepaperDocument, *, language: str) -> None:
    """Draw the cover page behind an empty first-page frame."""

    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, stroke=0, fill=1)
    cover = ROOT / "assets" / "images" / "wgp-abf-cover-art-v0.4.png"
    canvas.drawImage(str(cover), 0, 0, PAGE_WIDTH, 194 * mm, preserveAspectRatio=False, mask="auto")
    canvas.setFillColor(colors.Color(0.02, 0.10, 0.17, alpha=0.86))
    canvas.rect(0, 194 * mm, PAGE_WIDTH, PAGE_HEIGHT - 194 * mm, stroke=0, fill=1)
    canvas.setFillColor(CYAN)
    canvas.rect(18 * mm, PAGE_HEIGHT - 25 * mm, 27 * mm, 1.4 * mm, stroke=0, fill=1)
    canvas.setFont("WGPBold", 20)
    canvas.setFillColor(colors.white)
    canvas.drawString(18 * mm, PAGE_HEIGHT - 41 * mm, "WGP AGENT BODIFICATION FLOW")
    if language == "zh":
        title = "WGP 智能体机体化流程（WGP-ABF）"
        subtitle = "关键模块数据契约、智能体工程图纸与证据化标准件替换框架"
        edition = "版本 0.6 · 中英双语图解公开草案"
        author = "概念提出者与主要作者：王广平"
    else:
        title = "WGP Agent Bodification Flow (WGP-ABF)"
        subtitle = "Module Data Contracts, Agent Engineering Blueprints, and Evidence-Governed Evolution"
        edition = "Version 0.6 · Bilingual Illustrated Public Draft"
        author = "Originator and Principal Author: Wang Guangping"
    canvas.setFont("WGPBold", 25 if language == "zh" else 23)
    canvas.drawString(18 * mm, PAGE_HEIGHT - 57 * mm, title)
    canvas.setFont("WGPBody", 12.5 if language == "zh" else 10.5)
    canvas.setFillColor(colors.HexColor("#c5ddeb"))
    canvas.drawString(18 * mm, PAGE_HEIGHT - 68 * mm, subtitle)
    canvas.setFont("WGPBold", 10)
    canvas.setFillColor(CYAN)
    canvas.drawString(18 * mm, PAGE_HEIGHT - 79 * mm, edition)
    canvas.setFont("WGPBody", 9.5)
    canvas.setFillColor(colors.white)
    canvas.drawString(18 * mm, PAGE_HEIGHT - 88 * mm, author)
    canvas.restoreState()


def draw_body_page(canvas, doc: WhitepaperDocument, *, language: str) -> None:
    """Draw a restrained running header and page footer."""

    canvas.saveState()
    canvas.setStrokeColor(GRID)
    canvas.setLineWidth(0.5)
    canvas.line(20 * mm, PAGE_HEIGHT - 16 * mm, PAGE_WIDTH - 20 * mm, PAGE_HEIGHT - 16 * mm)
    canvas.setFont("WGPBold", 7.8)
    canvas.setFillColor(MUTED)
    canvas.drawString(20 * mm, PAGE_HEIGHT - 12.3 * mm, "WGP-ABF · PUBLIC DRAFT 0.6")
    right = "中文图解版" if language == "zh" else "English illustrated edition"
    canvas.drawRightString(PAGE_WIDTH - 20 * mm, PAGE_HEIGHT - 12.3 * mm, right)
    canvas.line(20 * mm, 15 * mm, PAGE_WIDTH - 20 * mm, 15 * mm)
    canvas.setFont("WGPBody", 7.5)
    canvas.drawString(20 * mm, 10.5 * mm, "CC BY 4.0 · Wang Guangping / 王广平 · 2026")
    canvas.setFont("WGPBold", 8)
    canvas.setFillColor(PANEL)
    canvas.drawRightString(PAGE_WIDTH - 20 * mm, 10.5 * mm, str(doc.page))
    canvas.restoreState()


def build_one(*, language: str, source: Path, destination: Path) -> None:
    """Build one language edition."""

    styles = make_styles(language)
    left = right = 20 * mm
    top = 22 * mm
    bottom = 20 * mm
    frame = Frame(left, bottom, PAGE_WIDTH - left - right, PAGE_HEIGHT - top - bottom, id="body-frame")
    cover_frame = Frame(0, 0, PAGE_WIDTH, PAGE_HEIGHT, id="cover-frame", showBoundary=0)
    document = WhitepaperDocument(
        str(destination),
        language=language,
        pagesize=A4,
        leftMargin=left,
        rightMargin=right,
        topMargin=top,
        bottomMargin=bottom,
        title=(
            "WGP 智能体机体化流程（WGP-ABF）：模块数据契约、智能体工程图纸与证据化演进框架"
            if language == "zh"
            else "WGP Agent Bodification Flow (WGP-ABF): Module Data Contracts, "
            "Agent Engineering Blueprints, and Evidence-Governed Evolution"
        ),
        author="Wang Guangping / 王广平",
        subject=(
            "模块数据契约、智能体工程图纸与证据化演进框架；版本 0.6.0 公开草案"
            if language == "zh"
            else "Module Data Contracts, Agent Engineering Blueprints, and Evidence-Governed Evolution; "
            "version 0.6.0 public draft"
        ),
        creator="WGP-ABF deterministic PDF builder",
        invariant=1,
        pageCompression=1,
        lang="zh-CN" if language == "zh" else "en-US",
        displayDocTitle=True,
        initialFontName="WGPBody",
        initialFontSize=10,
        initialLeading=15,
    )
    document.addPageTemplates(
        [
            PageTemplate(id="cover", frames=[cover_frame], onPage=lambda c, d: draw_cover(c, d, language=language)),
            PageTemplate(id="body", frames=[frame], onPageEnd=lambda c, d: draw_body_page(c, d, language=language)),
        ]
    )

    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle(
            "TOC1",
            fontName="WGPBold",
            fontSize=10 if language == "zh" else 9.5,
            leading=15 if language == "zh" else 14,
            textColor=PANEL,
            leftIndent=0,
            firstLineIndent=0,
            spaceBefore=(2 if language == "zh" else 1.2) * mm,
        ),
        ParagraphStyle(
            "TOC2",
            fontName="WGPBody",
            fontSize=8.5 if language == "zh" else 8.2,
            leading=13 if language == "zh" else 12,
            textColor=MUTED,
            leftIndent=7 * mm,
            firstLineIndent=0,
        ),
    ]
    toc.dotsMinLevel = 0
    toc.tableStyle = TableStyle([("FONTNAME", (0, 0), (-1, -1), "WGPBody")])
    toc_title = "目录" if language == "zh" else "Contents"
    note = (
        "本版为公开草案。机器语义以仓库中的 Schema 与一致性测试为准。"
        if language == "zh"
        else "This edition is a public draft. Repository schemas and conformance tests define machine-readable semantics."
    )
    available_width = PAGE_WIDTH - left - right
    story: list[Flowable] = [
        NextPageTemplate("body"),
        PageBreak(),
        Paragraph(toc_title, styles["toc_title"]),
        Paragraph(note, styles["lead"]),
        toc,
        PageBreak(),
    ]
    story.extend(markdown_story(source, styles, available_width, language))
    document.multiBuild(story)


def main() -> None:
    """Build selected or both editions."""

    parser = argparse.ArgumentParser()
    parser.add_argument("--language", choices=["zh", "en", "both"], default="both")
    args = parser.parse_args()
    fonts = register_fonts()
    print("Publication fonts: " + ", ".join(str(path) for path in fonts))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    jobs = {
        "zh": (
            ROOT / "whitepaper" / "WGP-ABF_Whitepaper_v0.6.zh-CN.md",
            OUTPUT / "WGP-ABF-Whitepaper-v0.6.0-zh-CN.pdf",
        ),
        "en": (
            ROOT / "whitepaper" / "WGP-ABF_Whitepaper_v0.6.en.md",
            OUTPUT / "WGP-ABF-Whitepaper-v0.6.0-en.pdf",
        ),
    }
    selected: Iterable[str] = jobs if args.language == "both" else [args.language]
    for language in selected:
        source, destination = jobs[language]
        build_one(language=language, source=source, destination=destination)
        print(f"Built {destination}")


if __name__ == "__main__":
    main()
