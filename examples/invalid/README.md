<!-- SPDX-License-Identifier: Apache-2.0 -->

# Rejection fixtures / 拒绝样例

These documents are intentionally invalid. `scripts/validate_examples.mjs` requires every fixture to be rejected for the named rule, preventing a validator that merely fails for an unrelated reason from passing CI.

这些文档故意违反规范。`scripts/validate_examples.mjs` 不仅要求每个样例被拒绝，还要求命中指定规则，避免验证器因无关错误失败却误过 CI。

| Fixture / 样例 | Required rejection / 必须拒绝的原因 |
|---|---|
| `abir-legacy-source-claim.json` | Legacy single-choice `adapterCapability` instead of the operation-capability set / 使用旧单选 `adapterCapability` 而非操作能力集合 |
| `assembly-recipe-undeclared-secret.json` | Undeclared recipe-envelope property / 未声明的配方信封字段 |
| `standard-part-descriptor-category-confusion.json` | Uppercase ABIR category disguised as `partKind` / 用大写 ABIR 类别冒充 `partKind` |
| `standard-part-replacement-hot-reload-without-capability.json` | `hotReload` mode without field-level capability / 缺少字段级能力却声明 `hotReload` 模式 |
| `standard-part-assessment-reversed.json` | Assessment direction disagrees with its ReplacementPlan / Assessment 方向与 ReplacementPlan 不一致 |
| `standard-part-assessment-level-overclaim.json` | I4 claim skips required cumulative I2 evidence / I4 声明跳过必需的累计 I2 证据 |
| `standard-part-conformance-report-revoked.json` | Revoke appended after assessment makes the old result currently inadmissible / assessment 后追加撤销记录，使旧结果当前不再可采信 |
| `standard-part-descriptor-stale-package-ref.json` | Exact package hash has no companion record / 精确包哈希没有对应伴随记录 |
| `recipe-diff-missing-risk-assessments.json` | Missing required risk assessment / 缺少必填风险评估 |
| `recipe-diff-incomplete-external-compensation.json` | External-effect record missing machine status / 外部副作用补偿缺少机器状态 |
| `runtime-event-legacy-timestamp.json` | Legacy `timestamp` instead of `occurredAt` / 使用旧 `timestamp` 而非 `occurredAt` |
| `evaluation-causal-overclaim.json` | Causal maturity with non-causal attribution / 因果成熟度与非因果归因冲突 |
