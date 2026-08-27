<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Roadmap / 路线图

The normative P0–P6 table lives in Section 17 of the whitepaper. This file tracks likely repository work without redefining those milestones.

规范性 P0–P6 表位于白皮书第 17 节。本文件只跟踪可能的仓库工作，不维护第二套阶段定义。

- Expand valid and invalid conformance fixtures for every schema rule and standard-part kind.
- Publish independent SchemaBundle reuse and resolution guidance across multiple ModuleDataContract records.
- Extend contract vectors for ordering, streaming, error propagation, cancellation, timeout, retry amplification, idempotency, state recovery, and cross-tenant authorization context.
- Add machine-level resource-limit and security-context contract dimensions: payload and stream bounds, rate and concurrency budgets, deadline propagation, authorization-context propagation, sensitive-field handling, and tenant isolation, with directed compatibility and negative vectors.
- Validate producer→consumer `chainBindings[]` evidence across two independent runtimes and prove that one-sided reports cannot grant I3.
- Build a public validator that reports exact schema and rule versions.
- Publish standalone format envelopes for Package, Profile, Environment, Suite, Report, Assessment, ReplacementPlan, Registry, and evidence-status records.
- Implement a version-pinned DeepSeek Harness read-only adapter before write-back.
- Add a deterministic 2D blueprint reference viewer with accessible list fallback.
- Add one audited RecipeDiff → compile → runtime evidence → rollback vertical slice.
- Publish adapter SDK guidance and evidence profiles for software, education, and creative workflows.
- Build a federated PartRegistry reference service with signed descriptors and reproducible package manifests.
- Implement `$defs.contractCompatibilityAssessment` solving and I2-I4 replacement checks across at least two independent runtimes.
- Explore optional body and 3D projections only after the engineering path is complete.
