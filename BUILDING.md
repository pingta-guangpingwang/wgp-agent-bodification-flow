<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Build and publication guide / 构建与发布指南

The checked-in Markdown, diagrams, PDFs, schemas, examples, and release checksums are the authoritative v0.6.0 artifacts. The scripts provide the source used to build this release; byte-identical output requires the same inputs, dependency versions, fonts, and platform rendering behavior.

仓库内的 Markdown、图表、PDF、Schema、示例和发布校验和是 v0.6.0 的权威产物。脚本记录了本次发布所用构建源；若要求字节完全一致，需要保持输入、依赖版本、字体和平台渲染行为一致。

## Prerequisites / 前置条件

- Node.js 22 and pnpm 11.19.0 for JSON Schema validation.
- Python 3.11 or later with [`requirements-build.txt`](requirements-build.txt) for diagrams, PDFs, contact sheets, and PDF QA.
- Noto Sans SC, licensed under SIL Open Font License 1.1, for the publication PDFs. The full font file is not redistributed by this project; the PDFs contain embedded subsets.
- Poppler `pdftoppm` for the required rendered-page visual QA of a publication build.

## Font selection / 字体选择

The builders first read these optional environment variables and then try common Noto CJK locations:

- `WGP_FONT_REGULAR`
- `WGP_FONT_BOLD`
- `WGP_FONT_MONO`

Each value must be an absolute path to an open font file that covers Simplified Chinese and Latin. The checked-in v0.6.0 PDFs use the same system-installed `NotoSansSC-VF.ttf` file for all three registered faces: SHA-256 `763146584cf0710223441356b4395e279021b0806c196614377a7a0174ae074a`. Noto CJK is licensed under SIL Open Font License 1.1; the license text is in [`LICENSES/SIL-OFL-1.1.txt`](LICENSES/SIL-OFL-1.1.txt), and the upstream source is the [official Noto CJK repository](https://github.com/notofonts/noto-cjk/tree/main/Sans).

构建器优先读取上述环境变量，再检查常见的 Noto CJK 安装位置。每个值都必须指向同时覆盖简体中文与拉丁字符的开放字体绝对路径。仓库内 v0.6.0 PDF 的三个注册字形均使用系统安装的 `NotoSansSC-VF.ttf`，其 SHA-256 为 `763146584cf0710223441356b4395e279021b0806c196614377a7a0174ae074a`。Noto CJK 使用 SIL Open Font License 1.1；许可全文见 [`LICENSES/SIL-OFL-1.1.txt`](LICENSES/SIL-OFL-1.1.txt)，上游来源见 [Noto CJK 官方仓库](https://github.com/notofonts/noto-cjk/tree/main/Sans)。

## Commands / 命令

```sh
pnpm install --frozen-lockfile
pnpm run validate
python -m pip install -r requirements-build.txt
python scripts/render_diagrams.py
python scripts/build_pdfs.py
python scripts/validate_pdfs.py
mkdir -p tmp/pdfs/zh tmp/pdfs/en
pdftoppm -png -r 144 output/pdf/WGP-ABF-Whitepaper-v0.6.0-zh-CN.pdf tmp/pdfs/zh/page
pdftoppm -png -r 144 output/pdf/WGP-ABF-Whitepaper-v0.6.0-en.pdf tmp/pdfs/en/page
python scripts/make_pdf_contact_sheets.py
python scripts/build_release.py
python scripts/verify_release_bundle.py
pnpm run validate
```

Build the PDFs twice in the same official environment and compare SHA-256 values before publication. Inspect every rendered page, not only the contact sheets. The final validation checks schemas, positive and negative examples, cross-document references, local Markdown links, the exact release-bundle member set, and SHA-256 values for all release artifacts.

在同一官方环境中连续构建两次 PDF，并在发布前比较 SHA-256；视觉检查必须覆盖每一页，不能只看拼版图。最后一次验证会检查 Schema、正负样例、跨文档引用、本地 Markdown 链接、发布包精确成员集合，以及全部发布产物的 SHA-256。
