<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Security policy / 安全政策

WGP-ABF v0.4 is a specification draft and does not itself provide a security boundary. Implementers must enforce permissions outside the model and document adapter, sandbox, secret, tenant, and side-effect controls.

WGP-ABF v0.4 是规范草案，本身不构成安全边界。实现者必须在模型外强制执行权限，并说明适配器、沙箱、秘密、租户隔离和外部副作用控制。

## Reporting / 报告漏洞

Use GitHub private vulnerability reporting when it is enabled. Do not open a public issue containing an exploit, credential, personal data, or an unpublished supply-chain weakness. Include affected version, reproducible impact, minimal proof, and any known mitigation.

启用 GitHub 私密漏洞报告后请使用该入口。不要在公开 Issue 中提交利用代码、凭据、个人数据或尚未公开的供应链弱点。报告应包含受影响版本、可复现影响、最小证明和已知缓解措施。

## Scope / 范围

Security reports may cover schemas or examples that enable unsafe privilege expansion, approval bypass, replayed side effects, cross-tenant evidence exposure, secret leakage, misleading provenance, or validator bypass. General product ideas and whitepaper disagreements belong in normal Issues or RFCs.
