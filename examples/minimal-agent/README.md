# WGP-ABF v0.4 minimal agent / 最小智能体示例

[中文](#中文) · [English](#english)

## 中文

本目录给出一个可由 JSON Schema 2020-12 验证的最小闭环：从结构图纸、装配配方、受保护变更、运行证据到评测结论。它用于解释格式，不是可直接部署的 DeepSeek 客户端或性能基准。

### 文件

| 文件 | 作用 | 对应规范 |
| --- | --- | --- |
| `abir.json` | 六类结构对象、端口级连线、多轴来源声明与独立投影视图 | `../../spec/abir.schema.json` |
| `recipe.json` | 实现选择、资源绑定、策略绑定、容器放置与启动参数 | `../../spec/assembly-recipe.schema.json` |
| `recipe-diff.json` | 带内容哈希前置条件、逐项风险评估、原子性、试运行、重启标记和双层补偿的事务 | `../../spec/recipe-diff.schema.json` |
| `events.jsonl` | 两次配对运行的事件；每一行是一个独立事件对象，并区分发生时间与采集时间 | `../../spec/runtime-event.schema.json` |
| `evaluation.json` | 基线/候选、试验协议、指标、证据引用、结论成熟度与限制 | `../../spec/evaluation.schema.json` |

### 关键设计

- `ABIR` 是机器可读的结构事实记录。`ProjectionProfile` 是独立的人机视图配置，不得制造或覆盖结构事实；结构内容哈希排除投影配置，因此纯布局修改不会使装配配方失效。
- `Component`、`Resource`、`Policy`、`Artifact`、`Interface`、`Container` 分开建模；它们之间的运行关系通过对象端口连接，而不是通过模糊的对象级连线表达。
- `SourceClaim` 把结构来源、身份确信度、字段覆盖率、运行证据、字段级操作能力和信任状态拆成独立轴。稳定来源值为 `F3`（Native）、`F2`（Exported）、`F1`（Inferred）、`F0`（Manual）；可组合的 `operationCapabilities` 独立声明 `view/edit/compile/roundTrip/hotReload/replace`，不得从来源等级推导。
- `RuntimeEvent` 的 `occurredAt` 是生产者报告的发生时间，`observedAt` 是可选的采集器观察时间；二者分离后可以显式分析传输延迟和时钟偏差。`storageClass`、`origin`、`replayRole` 相互独立。示例中的 `metric.derived` 是“持久化 + 派生 + 仅验证”，证明“派生”不等于“临时”。
- `RecipeDiff` 在整份配方和目标字段两级使用内容哈希前置条件；每项风险记录类别、严重度、受影响路径、缓解、剩余风险与审批。`operations[].compensation` 恢复配方状态，`compensation.externalSideEffects` 单独记录配方外副作用的补偿；空数组明确表示没有此类副作用。
- 评测把结论成熟度和归因强度显式记录。固定模型输出流只减少一种方差来源，不能单独证明因果关系。

### 验证

从仓库根目录运行正式验证器。它会以 Ajv 严格模式验证正例、逐行验证 JSONL、确认五类负例被预期规则拒绝，并检查跨文档 ID、引用、时间、顺序、配方差异、风险、指标和证据闭包：

```powershell
pnpm install --frozen-lockfile
pnpm run validate
```

示例哈希是满足格式要求的占位值，便于阅读和交叉引用。生产实现必须按规范选定的规范化算法计算真实摘要，并额外执行 JSON Schema 无法表达的跨文档语义检查，例如对象/端口引用存在性、ID 全局唯一性、摘要真实性和评测证据闭包。配方只保存凭据名称或不透明引用，绝不保存密钥值。

## English

This directory provides a minimal closed loop that validates against JSON Schema 2020-12: structural blueprint, assembly recipe, guarded change, runtime evidence, and evaluation conclusion. It explains the formats; it is neither a deployable DeepSeek client nor a performance benchmark.

### Files

| File | Purpose | Schema |
| --- | --- | --- |
| `abir.json` | Six structural object classes, port-level edges, multi-axis source claims, and an independent projection view | `../../spec/abir.schema.json` |
| `recipe.json` | Implementation selection, resource and policy binding, placement, and startup settings | `../../spec/assembly-recipe.schema.json` |
| `recipe-diff.json` | A transaction with content-hash preconditions, per-risk records, atomicity, dry-run intent, restart flags, and two compensation layers | `../../spec/recipe-diff.schema.json` |
| `events.jsonl` | Events from two paired runs; every line is one independent event object with distinct occurrence and observation times | `../../spec/runtime-event.schema.json` |
| `evaluation.json` | Baseline/candidate records, protocol, metrics, evidence references, claim maturity, and limitations | `../../spec/evaluation.schema.json` |

### Design points

- `ABIR` is the machine-readable structural record. `ProjectionProfile` is a separate human-interface view and cannot create or override structural facts; the structural content hash excludes projection settings, so a view-only edit cannot invalidate an assembly recipe.
- `Component`, `Resource`, `Policy`, `Artifact`, `Interface`, and `Container` are distinct object classes. Runtime relationships connect object ports instead of relying on ambiguous object-level lines.
- `SourceClaim` separates structural provenance, identity assurance, field coverage, runtime evidence, field-level operation capabilities, and trust state. Stable provenance values are `F3` (Native), `F2` (Exported), `F1` (Inferred), and `F0` (Manual). Composable `operationCapabilities` independently declare `view/edit/compile/roundTrip/hotReload/replace`; provenance never grants an operation.
- A `RuntimeEvent` uses `occurredAt` for producer-reported occurrence time and optional `observedAt` for collector observation time, exposing transport delay and clock skew. It classifies `storageClass`, `origin`, and `replayRole` independently. The `metric.derived` examples are durable, derived, and verification-only, showing that derived does not mean ephemeral.
- `RecipeDiff` uses content-hash preconditions at both recipe and target-field levels. Every risk records category, severity, affected paths, mitigation, residual risk, and approval. `operations[].compensation` restores recipe state; `compensation.externalSideEffects` separately records compensation outside the recipe, with an empty array explicitly meaning no such effects.
- Evaluations state claim maturity and attribution strength. A pinned model-output stream reduces one source of variance; it does not establish causality by itself.

### Validation

Run the commands in the Chinese section from the repository root. The Ajv strict validator accepts the positive documents, validates every JSONL event, proves that the negative fixtures are rejected for their intended reasons, and checks cross-document ID, reference, time, order, guarded-diff, risk, metric, and evidence closure.

The hashes in this example are readable placeholders that satisfy the declared formats and make cross-references obvious. Production implementations must calculate real digests with the specification's selected canonicalization algorithm and perform semantic checks that JSON Schema cannot express, including object/port referential integrity, global ID uniqueness, digest authenticity, and evaluation-evidence closure. Recipes contain credential names or opaque references only, never secret values.
