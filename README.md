<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# WGP Agent Bodification Flow（WGP-ABF）

[![Validate specification](https://github.com/pingta-guangpingwang/wgp-agent-bodification-flow/actions/workflows/validate.yml/badge.svg)](https://github.com/pingta-guangpingwang/wgp-agent-bodification-flow/actions/workflows/validate.yml)
[![Release](https://img.shields.io/github/v/release/pingta-guangpingwang/wgp-agent-bodification-flow?include_prereleases)](https://github.com/pingta-guangpingwang/wgp-agent-bodification-flow/releases/tag/v0.4.0)
[![Dual license](https://img.shields.io/badge/license-CC%20BY%204.0%20%2B%20Apache--2.0-2f7dff)](LICENSE)

> 智能体工程图纸、证据化评测与验证式组件替换框架<br>
> An engineering framework for agent blueprints, evidence-backed evaluation, and validated component replacement

[简体中文](README.zh-CN.md) · [English](README.en.md) · [中文白皮书](whitepaper/WGP-ABF_Whitepaper_v0.4.zh-CN.md) · [English whitepaper](whitepaper/WGP-ABF_Whitepaper_v0.4.en.md)

![WGP-ABF：从二维工程图纸到模块化智能体装配体](assets/images/wgp-abf-cover-art-v0.4.png)

**Public Draft 0.4 · 公开草案 0.4**<br>
**Originator and principal author / 概念提出者与主要作者：Wang Guangping / 王广平**

WGP-ABF turns agent configurations into first-class engineering artifacts that can be visualized, diffed, tested, modified, and validated.

WGP-ABF 让智能体配置成为可视、可差分、可测试、可改装、可验证的一等工程产物。

## Read / 阅读

| Language | Markdown | PDF |
|---|---|---|
| 简体中文 | [v0.4 中文白皮书](whitepaper/WGP-ABF_Whitepaper_v0.4.zh-CN.md) | [下载中文 PDF](output/pdf/WGP-ABF-Whitepaper-v0.4.0-zh-CN.pdf) |
| English | [v0.4 English whitepaper](whitepaper/WGP-ABF_Whitepaper_v0.4.en.md) | [Download English PDF](output/pdf/WGP-ABF-Whitepaper-v0.4.0-en.pdf) |

The original Chinese v0.3 draft is preserved in [`archive/v0.3`](archive/v0.3/). / 中文 v0.3 原稿完整保存在 [`archive/v0.3`](archive/v0.3/)。

## What is new in v0.4 / v0.4 的关键改进

- `WGP-ABIR` now means **Agent Blueprint Intermediate Representation**, keeping body metaphors out of the type system.
- `WGP-ABIR + AssemblyRecipe` form the canonical structural record; the 2D blueprint is its authoritative human editing projection.
- F3–F0 describes structural provenance only. Edit, compile, replace, and round-trip capabilities are independently verified per field.
- Runtime events separate `storageClass`, `origin`, and `replayRole`; View Replay, Simulation Replay, and Re-execution have distinct guarantees.
- Fixed model-stream replay is treated as contract regression, not automatic causal proof.
- Conformance, threat modeling, accessibility, statistical requirements, dual licensing, and a pinned DSH adapter case are included.

## Repository / 仓库内容

- `whitepaper/` — bilingual illustrated whitepaper / 双语图解白皮书
- `spec/` — JSON Schema 2020-12 specifications / 机器可验证规范
- `examples/minimal-agent/` — minimal end-to-end example / 最小闭环样例
- `assets/` — original cover, diagrams, and provenance / 原创封面、图解与来源记录
- `scripts/` — versioned diagram, PDF, validation, and release builders; see [`BUILDING.md`](BUILDING.md) / 带版本的图表、PDF、验证与发布构建源，详见 [`BUILDING.md`](BUILDING.md)
- `governance/` and root policy files — contribution and rights model / 贡献与权利治理

## Status / 状态

This repository is a public draft, not an industry standard, certification program, security guarantee, or legal advice. Conformance claims must name the WGP-ABF version, validator version, adapter version, exceptions, and evidence.

本仓库是公开草案，不是行业标准、认证计划、安全保证或法律意见。任何合规声明都必须注明 WGP-ABF、验证器与适配器版本、例外和证据。

The canonical repository is [pingta-guangpingwang/wgp-agent-bodification-flow](https://github.com/pingta-guangpingwang/wgp-agent-bodification-flow); use its [Issues](https://github.com/pingta-guangpingwang/wgp-agent-bodification-flow/issues) for specification defects, interoperability reports, translation drift, and change proposals.

规范主仓库是 [pingta-guangpingwang/wgp-agent-bodification-flow](https://github.com/pingta-guangpingwang/wgp-agent-bodification-flow)；规范缺陷、互操作报告、翻译差异和变更提案请提交到 [Issues](https://github.com/pingta-guangpingwang/wgp-agent-bodification-flow/issues)。

Version labels serve different purposes: **0.4** is the reader-facing whitepaper series, **0.4.0** is the SemVer package/specification release, `/0.4` names the compatible document-format family, and immutable tag **`v0.4.0`** fixes this release's schemas and artifacts.

版本标识分工不同：**0.4** 是面向读者的白皮书系列，**0.4.0** 是 SemVer 包/机器规范版本，`/0.4` 是文档格式兼容族，不可变标签 **`v0.4.0`** 固定本次发布的 Schema 与产物。

## License and authorship / 许可与作者权

- Whitepaper, original diagrams, README, and governance prose: [CC BY 4.0](LICENSES/CC-BY-4.0.txt).
- Schemas, examples, scripts, and reference code: [Apache License 2.0](LICENSES/Apache-2.0.txt).
- WGP-ABF names, logos, and conformance/certification marks are governed separately by [TRADEMARKS.md](TRADEMARKS.md).

Open licensing does not transfer copyright. For CC BY 4.0 material, preserve attribution to **Wang Guangping / 王广平**, link the license, and identify modifications. For Apache-2.0 material, preserve the license and required notices. See [NOTICE](NOTICE), [AUTHORS.md](AUTHORS.md), and [CITATION.cff](CITATION.cff).
