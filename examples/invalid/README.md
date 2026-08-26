<!-- SPDX-License-Identifier: Apache-2.0 -->

# Rejection fixtures / 拒绝样例

These documents are intentionally invalid. `scripts/validate_examples.mjs` requires every fixture to be rejected for the named rule, preventing a validator that merely fails for an unrelated reason from passing CI.

这些文档故意违反规范。`scripts/validate_examples.mjs` 不仅要求每个样例被拒绝，还要求命中指定规则，避免验证器因无关错误失败却误过 CI。

| Fixture / 样例 | Required rejection / 必须拒绝的原因 |
|---|---|
| `abir-legacy-source-claim.json` | Legacy provenance and single-choice adapter capability / 旧来源值与单选适配器能力 |
| `assembly-recipe-undeclared-secret.json` | Undeclared recipe-envelope property / 未声明的配方信封字段 |
| `recipe-diff-missing-risk-assessments.json` | Missing required risk assessment / 缺少必填风险评估 |
| `recipe-diff-incomplete-external-compensation.json` | External-effect record missing machine status / 外部副作用补偿缺少机器状态 |
| `runtime-event-legacy-timestamp.json` | Legacy `timestamp` instead of `occurredAt` / 使用旧 `timestamp` 而非 `occurredAt` |
| `evaluation-causal-overclaim.json` | Causal maturity with non-causal attribution / 因果成熟度与非因果归因冲突 |
