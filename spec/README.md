<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# WGP-ABF v0.5 machine-readable specifications

These strict JSON Schema 2020-12 envelopes form the v0.5 interoperable family. Declared envelopes reject unknown properties. Deliberate extension points remain open: namespaced `extensions`, implementation-owned recipe configuration, runtime-event `payload`, and metric-value maps. An open extension point does not make its containing envelope open.

这些严格的 JSON Schema 2020-12 信封共同组成 v0.5 可互操作格式族。已声明信封拒绝未知字段，同时保留带命名空间的 `extensions`、实现方拥有的配方配置、运行事件 `payload` 与指标值映射等明确扩展点。局部扩展点开放不代表外层信封开放。

| Schema | Purpose / 用途 |
|---|---|
| [`abir.schema.json`](abir.schema.json) | Six object categories, ports, typed edges, source claims, and projection profiles / 六类对象、端口、强类型边、来源声明与投影配置 |
| [`assembly-recipe.schema.json`](assembly-recipe.schema.json) | Exact standard-part/package pins, surface mappings, runtime bindings, and verification definitions / 标准件与包精确固定、表面映射、运行绑定及验证定义 |
| [`recipe-diff.schema.json`](recipe-diff.schema.json) | Guarded operations, risks, compensation, and an exact ReplacementPlan link / 受保护操作、风险、补偿与 ReplacementPlan 精确引用 |
| [`runtime-event.schema.json`](runtime-event.schema.json) | Storage/origin/replay axes plus executed part and package identity / 存储、来源、回放三轴及实际运行的标准件与包身份 |
| [`evaluation.schema.json`](evaluation.schema.json) | Paired evidence, uncertainty, claims, limitations, and decisions / 配对证据、不确定性、主张、限制与决策 |
| [`standard-part-descriptor.schema.json`](standard-part-descriptor.schema.json) | Immutable StandardPartDescriptor plus reusable companion definitions / 不可变 StandardPartDescriptor 与可复用伴随文档定义 |

## Standard parts and evidence / 标准件与证据

`partKind` maps exactly to ABIR `component`, `resource`, `policy`, `artifact`, `interface`, and `container`; a model or vector store can remain a Resource, while a skill or prompt can remain an Artifact. Standardized ports pin `protocolId`, `protocolVersion`, `schemaRef`, `schemaContentHash`, `mediaType`, direction, and cardinality. Assembly Recipes map those ports explicitly to ABIR ports and pin both the descriptor and package with exact identity, version, and hash.

`partKind` 精确映射 ABIR 的 `component`、`resource`、`policy`、`artifact`、`interface`、`container`，因此模型或向量库仍可作为 Resource，skill 或 prompt 仍可作为 Artifact。标准端口固定 `protocolId`、`protocolVersion`、`schemaRef`、`schemaContentHash`、`mediaType`、方向与基数；装配配方把这些端口显式映射到 ABIR 端口，并以身份、版本、哈希精确固定描述符与包。

`CompatibilityProfile` is a stable rule and context template. `InterchangeabilityAssessment` is a directed, time-bounded A-to-B result that pins a profile, environment, cumulative `levelEvidence`, and—at I4—a ReplacementPlan. The maximum admissible level is derived in order: `I0` Closed; `I1` Adapter-wrapped requires identified source and target adapters plus executed surface-contract evidence; `I2` Interface-conformant additionally closes standardized surfaces, configuration, runtime, environment, permission policy, exact dependencies, and executed configuration/permission evidence; `I3` Behavior-verified adds executed behavioral evidence; and `I4` Evidence-backed controlled interchangeability adds an exact plan with migration, acceptance, and rollback evidence. A later level cannot skip an earlier level's static closure or executed evidence. These values never overlap provenance `F3/F2/F1/F0`, and I4 never implies `hotReload`; `replacementMode` and field-level `operationCapabilities` decide execution mode.

`CompatibilityProfile` 是稳定的规则与上下文模板；`InterchangeabilityAssessment` 是有方向、有有效期的 A→B 结果，精确固定 profile、环境、累计 `levelEvidence`，并在 I4 固定 ReplacementPlan。最高可接受等级按顺序推导：`I0` Closed；`I1` Adapter-wrapped 要求源与目标 adapter 具有明确身份，并有已执行的表面协议证据；`I2` Interface-conformant 再要求标准表面、配置、运行时、环境、权限策略、精确依赖闭包，以及已执行的配置/权限证据；`I3` Behavior-verified 增加已执行行为证据；`I4` Evidence-backed controlled interchangeability 再增加精确计划与迁移、验收、回滚证据。高等级不得跳过低等级的静态闭包或已执行证据。它们绝不与来源等级 `F3/F2/F1/F0` 混用，I4 也绝不隐含 `hotReload`；实际方式由独立的 `replacementMode` 与字段级 `operationCapabilities` 决定。

`ConformanceSuite` defines tests; it is not proof that they ran. An immutable `ConformanceReport` records one execution and pins its profile, environment, expiry, individual results, and summary. A passing report requires every required test to pass. Separate append-only `EvidenceStatusRecord` entries activate, revoke, or tombstone an exact report through contiguous revisions and predecessor hashes; the current chain head decides current admissibility, so a later revoke or tombstone invalidates assessments that depended on that report. Report execution and expiry are still checked at `assessedAt`. Registry records independently provide append-only discovery revisions, revocation, and tombstones. A descriptor does not embed or reverse-reference Registry records, Reports, Assessments, or ReplacementPlans; those documents point to the immutable descriptor and are discovered through a Registry or query index, avoiding hash cycles.

`ConformanceSuite` 只定义测试，并不证明测试已经运行；不可变的 `ConformanceReport` 记录一次执行，固定 profile、环境、有效期、逐项结果和汇总。只有全部必需测试通过，报告才能通过。独立的只追加 `EvidenceStatusRecord` 通过连续 revision 与前序哈希激活、撤销或 tombstone 一份精确报告；当前链头决定当前可采信性，因此后续 revoke 或 tombstone 会使依赖该报告的旧 assessment 失效。报告是否已执行以及是否过期，仍在 `assessedAt` 时点检查。Registry 记录另行提供只追加的发现 revision、撤销与 tombstone。Descriptor 不嵌入或反向引用 Registry、Report、Assessment、ReplacementPlan；这些后置文档单向指向不可变 Descriptor，并通过 Registry 或查询索引发现，从而避免哈希环。

## Source claims and guarded changes / 来源声明与受保护变更

`structuralProvenance` remains `F3` Native, `F2` Exported, `F1` Inferred, or `F0` Manual. Independent `operationCapabilities` may compose `view`, `edit`, `compile`, `roundTrip`, `hotReload`, and `replace`. Every RecipeDiff carries risk, approval, exact preconditions, inverse recipe operations, and external-side-effect compensation. `verificationPlan` and ConformanceSuite entries are definitions, never passing evidence.

`structuralProvenance` 保持 `F3` Native、`F2` Exported、`F1` Inferred、`F0` Manual；独立的 `operationCapabilities` 可组合 `view`、`edit`、`compile`、`roundTrip`、`hotReload`、`replace`。每个 RecipeDiff 都包含风险、审批、精确前置条件、配方反向操作与外部副作用补偿。`verificationPlan` 与 ConformanceSuite 条目只是定义，绝不冒充通过证据。

## Hashing and version pinning / 哈希与版本固定

A root `contentHash` is SHA-256 over RFC 8785 canonical JSON with that root `contentHash` member omitted. A Registry `recordHash` uses the same rule with its root `recordHash` omitted. Exact references always contain id, version, and content hash. Example digests are visibly repeated placeholders; production validators must calculate and verify real digests before accepting a document.

根 `contentHash` 定义为：删除该根 `contentHash` 成员后，对 RFC 8785 规范化 JSON 计算 SHA-256。Registry `recordHash` 同理，但删除根 `recordHash`。精确引用始终同时包含身份、版本和内容哈希。样例使用明显重复的占位摘要；生产验证器必须计算并校验真实摘要后才能接受文档。

Every `$id` points to the immutable `v0.5.0` tag of the canonical GitHub repository. A semantic change receives a new tag and schema version; an existing tag must never be replaced.

每个 `$id` 指向规范 GitHub 仓库不可变的 `v0.5.0` tag。语义变化必须产生新 tag 与 Schema 版本，绝不原地替换已发布 tag。

See [`examples/minimal-agent`](../examples/minimal-agent/) for the closed positive set and [`examples/invalid`](../examples/invalid/) for schema and semantic rejection fixtures. `node scripts/validate_examples.mjs` runs Ajv strict validation and verifies exact references, category and port mappings, Suite/Report separation, cumulative I-level derivation, report-status and Registry chains, RecipeDiff/ReplacementPlan linkage, runtime part/package identity, event ordering, and evaluation closure.

完整正例见 [`examples/minimal-agent`](../examples/minimal-agent/)，Schema 与语义拒绝样例见 [`examples/invalid`](../examples/invalid/)。`node scripts/validate_examples.mjs` 以 Ajv 严格模式验证，并检查精确引用、类别与端口映射、Suite/Report 分离、I 级累计推导、报告状态链与 Registry 链、RecipeDiff/ReplacementPlan 联动、运行标准件与包身份、事件顺序及评测闭包。
