# SPDX-License-Identifier: Apache-2.0
"""Resolve publication fonts without bundling third-party font files."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable


def _resolve(environment_name: str, candidates: Iterable[str]) -> Path:
    override = os.environ.get(environment_name)
    paths = ([override] if override else []) + list(candidates)
    for value in paths:
        if value and Path(value).is_file():
            return Path(value)
    joined = ", ".join(paths)
    raise FileNotFoundError(
        f"No usable font found for {environment_name}. Set {environment_name} to a licensed local font file. "
        f"Checked: {joined}"
    )


def publication_fonts() -> tuple[Path, Path, Path]:
    """Return regular, bold, and monospace fonts for bilingual output."""

    regular = _resolve(
        "WGP_FONT_REGULAR",
        (
            "C:/Windows/Fonts/msyh.ttc",
            "/System/Library/Fonts/PingFang.ttc",
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
            "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf",
        ),
    )
    bold = _resolve(
        "WGP_FONT_BOLD",
        (
            "C:/Windows/Fonts/msyhbd.ttc",
            "/System/Library/Fonts/PingFang.ttc",
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
            "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Bold.otf",
        ),
    )
    monospace = _resolve(
        "WGP_FONT_MONO",
        (
            "C:/Windows/Fonts/consola.ttf",
            "/System/Library/Fonts/Menlo.ttc",
            "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        ),
    )
    return regular, bold, monospace
