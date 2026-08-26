<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# WGP-ABF v0.4 machine-readable specifications

These JSON Schema 2020-12 files are the initial interoperable baseline for the public draft. Declared envelopes reject unknown properties. Deliberate extension points remain open: namespaced `extensions`, implementation-owned recipe configuration objects, runtime-event `payload`, and metric-value maps. An open extension point does not make its containing envelope open.

这些 JSON Schema 2020-12 文件是公开草案的首个可互操作基线。已声明的信封拒绝未知字段，但明确保留开放扩展点：带命名空间的 `extensions`、实现方拥有的配方配置对象、运行事件 `payload` 与指标值映射。局部扩展点开放不代表其外层信封开放。

| Schema | Purpose / 用途 |
|---|---|
| [`abir.schema.json`](abir.schema.json) | Six object categories, ports, typed edges, source claims, and separate projection profiles / 六类对象、端口、强类型边、来源 claim 与独立投影 |
| [`assembly-recipe.schema.json`](assembly-recipe.schema.json) | Versioned desired configuration and target runtime bindings / 版本化期望配置与目标运行时绑定 |
| [`recipe-diff.schema.json`](recipe-diff.schema.json) | Preconditions, per-risk approval, atomic operations, restart, inverse recipe operations, and external-effect compensation / 前置条件、逐项风险审批、原子操作、重启、配方反向操作与外部副作用补偿 |
| [`runtime-event.schema.json`](runtime-event.schema.json) | Event envelope with independent storage, origin, and replay-role fields / 存储、来源与回放角色三轴事件信封 |
| [`evaluation.schema.json`](evaluation.schema.json) | Paired evidence, uncertainty, claims, limitations, and decisions / 配对证据、不确定性、主张、限制与决策 |

## Source claims / 来源声明

`structuralProvenance` has four stable values and describes source quality only: `F3` (Native), `F2` (Exported), `F1` (Inferred), and `F0` (Manual). `operationCapabilities` is an independent, composable field-level list containing any supported combination of `view`, `edit`, `compile`, `roundTrip`, `hotReload`, and `replace`. A provenance level never implies an operation capability.

`structuralProvenance` 只有四个稳定值，并且只描述来源质量：`F3`（Native）、`F2`（Exported）、`F1`（Inferred）、`F0`（Manual）。`operationCapabilities` 是独立、可组合的字段级列表，可包含 `view`、`edit`、`compile`、`roundTrip`、`hotReload`、`replace` 的任意受支持组合。来源等级绝不隐含操作能力。

## Guarded changes and compensation / 受保护变更与补偿

Every `RecipeDiff` carries at least one `riskAssessments` record with category, severity, affected JSON Pointer paths, mitigation, residual risk, and per-risk approval. `operations[].compensation` is an inverse document operation that restores recipe state. `compensation.externalSideEffects` is a separate machine-readable list for effects outside the recipe store; every record carries an effect id, description, action, verification, idempotence, owner, and status. An empty list explicitly declares that the change has no identified external side effect requiring compensation.

每个 `RecipeDiff` 至少包含一项 `riskAssessments`，记录类别、严重度、受影响 JSON Pointer 路径、缓解措施、剩余风险与逐项审批。`operations[].compensation` 是恢复配方状态的反向文档操作；`compensation.externalSideEffects` 则是配方存储之外副作用的独立机器记录，每项包含副作用 ID、描述、动作、验证、幂等性、负责人和状态。空列表明确表示当前变更没有已识别且需要补偿的外部副作用。

## Runtime-event axes / 运行事件三轴

- `storageClass`: `durable | ephemeral`
- `origin`: `primary | derived`
- `replayRole`: `input | expectedOutcome | verificationOnly | projectionOnly | excluded`

The axes are independent. A derived event may be durable. A primary event may be ephemeral. A durable event may be excluded from a particular replay.

三个维度彼此独立：derived 事件可以持久化，primary 事件可以只存在于实时会话，durable 事件也可以被某类回放排除。

## Version pinning / 版本固定

Every `$id` points to the immutable `v0.4.0` tag of the expected public repository. A later semantic change receives a new tag and schema version; an existing tag must not be replaced.

每个 `$id` 指向预计公开仓库的不可变 `v0.4.0` tag。后续语义变化必须产生新 tag 与 Schema 版本，不得原地替换已发布 tag。

See [`examples/minimal-agent`](../examples/minimal-agent/) for valid documents and [`examples/invalid`](../examples/invalid/) for fixtures that must be rejected. `pnpm run validate` checks both sets and also proves the example's unique IDs, object and port references, recipe and guarded-diff lineage, risk and recovery records, event time/order/derivation, trial-to-run closure, metric aggregates, and evidence references. Digest authenticity and implementation-specific extension payloads still require their owning producer or adapter.

合法文档见 [`examples/minimal-agent`](../examples/minimal-agent/)，必须被拒绝的负例见 [`examples/invalid`](../examples/invalid/)。`pnpm run validate` 同时验证两组样例，并检查唯一 ID、对象与端口引用、配方及受保护差异的版本链、风险和恢复记录、事件时间/顺序/派生、试验与运行闭包、指标聚合及证据引用。摘要真实性与实现专属扩展载荷仍由其生产者或适配器负责验证。
