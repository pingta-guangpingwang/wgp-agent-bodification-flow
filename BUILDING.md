<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Build and publication guide / 构建与发布指南

The checked-in Markdown, diagrams, PDFs, schemas, examples, and release checksums are the authoritative v0.4.0 artifacts. The scripts provide the source used to build this release; byte-identical output requires the same inputs, dependency versions, fonts, and platform rendering behavior.

仓库内的 Markdown、图表、PDF、Schema、示例和发布校验和是 v0.4.0 的权威产物。脚本记录了本次发布所用构建源；若要求字节完全一致，需要保持输入、依赖版本、字体和平台渲染行为一致。

## Prerequisites / 前置条件

- Node.js 22 and pnpm 11.19.0 for JSON Schema validation.
- Python 3.11 or later with [`requirements-build.txt`](requirements-build.txt) for diagrams, PDFs, contact sheets, and PDF QA.
- A locally licensed font that covers Simplified Chinese and Latin text. Font files are not redistributed by this project.
- Poppler `pdftoppm` is optional and is used only for rendered-page visual QA.

## Font selection / 字体选择

The builders first read these optional environment variables and then try common system font locations:

- `WGP_FONT_REGULAR`
- `WGP_FONT_BOLD`
- `WGP_FONT_MONO`

Each value must be an absolute path to a font file that the builder is legally allowed to use. The current release was built on Windows with system-installed Microsoft YaHei and Consolas. Those fonts are not part of the repository and remain subject to their own licenses.

构建器优先读取上述环境变量，再检查常见系统字体位置。每个值都必须指向本机依法可用的字体绝对路径。本次发布在 Windows 上使用系统安装的微软雅黑与 Consolas；这些字体不随仓库分发，并继续受其自身许可约束。

## Commands / 命令

```sh
pnpm install --frozen-lockfile
pnpm run validate
python -m pip install -r requirements-build.txt
python scripts/render_diagrams.py
python scripts/build_pdfs.py
python scripts/validate_pdfs.py
python scripts/make_pdf_contact_sheets.py
python scripts/build_release.py
pnpm run validate
```

The final validation checks schemas, positive and negative examples, cross-document references, local Markdown links, and SHA-256 values for the two PDFs and specification bundle.

最后一次验证会检查 Schema、正负样例、跨文档引用、本地 Markdown 链接，以及两份 PDF 和规范包的 SHA-256。
