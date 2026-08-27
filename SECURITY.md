<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Security policy / 安全政策

WGP-ABF v0.6 is a specification draft and does not itself provide a security boundary. Implementers must enforce permissions outside the model and document data-contract, adapter, sandbox, secret, tenant, standard-part supply-chain, and side-effect controls.

WGP-ABF v0.6 是规范草案，本身不构成安全边界。实现者必须在模型外强制执行权限，并说明数据契约、适配器、沙箱、秘密、租户隔离、标准件供应链和外部副作用控制。

## Reporting / 报告漏洞

Use GitHub private vulnerability reporting when it is enabled. Do not open a public issue containing an exploit, credential, personal data, or an unpublished supply-chain weakness. Include affected version, reproducible impact, minimal proof, and any known mitigation.

启用 GitHub 私密漏洞报告后请使用该入口。不要在公开 Issue 中提交利用代码、凭据、个人数据或尚未公开的供应链弱点。报告应包含受影响版本、可复现影响、最小证明和已知缓解措施。

## Scope / 范围

Security reports may cover schemas or examples that enable unsafe privilege expansion, approval bypass, replayed side effects, cross-tenant evidence exposure, secret or error-payload leakage, contract or package substitution, movable Schema-bundle drift, malicious adapters, stream/resource exhaustion, retry amplification, idempotency bypass, misleading provenance, registry poisoning, ignored revocations, signature confusion, or validator bypass. General product ideas and whitepaper disagreements belong in normal Issues or RFCs.

安全报告可以涵盖会导致不安全提权、绕过审批、重复执行副作用、跨租户证据暴露、秘密或错误载荷泄露、契约或包替换、可移动 Schema Bundle 漂移、恶意适配器、流式或资源耗尽、重试放大、幂等绕过、误导性来源声明、注册表投毒、忽略撤回、签名混淆或绕过验证器的 Schema 与样例。一般产品建议和对白皮书的分歧应进入普通 Issue 或 RFC。
