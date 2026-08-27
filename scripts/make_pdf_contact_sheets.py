"""Create contact sheets for visual QA of rendered PDF pages.

SPDX-License-Identifier: Apache-2.0
"""

from pathlib import Path
import re

from PIL import Image, ImageDraw, ImageFont

from font_paths import publication_fonts


ROOT = Path(__file__).resolve().parents[1]
_, FONT_BOLD, _ = publication_fonts()
FONT = ImageFont.truetype(str(FONT_BOLD), 24)


def build(language: str) -> None:
    source = ROOT / "tmp" / "pdfs" / language
    target = source / "contact"
    target.mkdir(parents=True, exist_ok=True)
    pages = sorted(
        source.glob("page-*.png"),
        key=lambda path: int(re.search(r"(\d+)$", path.stem).group(1)),
    )
    if not pages:
        raise FileNotFoundError(
            f"No rendered pages found in {source}; render the PDF with pdftoppm before creating contact sheets."
        )
    for sheet_index in range(0, len(pages), 4):
        group = pages[sheet_index : sheet_index + 4]
        canvas = Image.new("RGB", (1420, 1900), "#d8e0e7")
        draw = ImageDraw.Draw(canvas)
        for position, page in enumerate(group):
            image = Image.open(page).convert("RGB")
            image.thumbnail((680, 855), Image.Resampling.LANCZOS)
            x = 20 + (position % 2) * 700
            y = 55 + (position // 2) * 915
            canvas.paste(image, (x + (680 - image.width) // 2, y))
            page_number = sheet_index + position + 1
            draw.text((x, 15 + (position // 2) * 915), f"{language.upper()} · PAGE {page_number}", fill="#102d44", font=FONT)
        output = target / f"sheet-{sheet_index // 4 + 1:02d}.jpg"
        canvas.save(output, quality=92, optimize=True)
    print(f"{language}: {len(pages)} rendered pages, {(len(pages) + 3) // 4} contact sheets")


def main() -> None:
    for language in ("zh", "en"):
        build(language)


if __name__ == "__main__":
    main()
