<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# WGP-ABF v0.6 machine-readable specifications / 机器规范

These strict JSON Schema 2020-12 documents form the v0.6 family. Declared envelopes reject unknown properties. The explicitly open values are namespaced `extensions`, implementation configuration, RuntimeEvent `payload`, and metric maps.

这些严格的 JSON Schema 2020-12 文档组成 v0.6 格式族。已声明信封拒绝未知字段；明确开放的值仅包括命名空间 `extensions`、实现配置、RuntimeEvent `payload` 与指标映射。

| Schema | Purpose / 用途 |
| --- | --- |
| [`module-data-contract.schema.json`](module-data-contract.schema.json) | The single source of truth for module boundary roles, structures, field semantics, channel protocols, timeout/retry/idempotency, ordering, delivery, cancellation, error and state semantics / 模块边界角色、数据结构、字段语义、通道协议及可靠性语义的唯一真相 |
| [`abir.schema.json`](abir.schema.json) | Six object categories, exact Contract channel-role references on critical directed ports, typed edges, source claims and projections / 六类对象、关键定向端口上的精确 Contract 通道角色引用、强类型边、来源声明与投影 |
| [`assembly-recipe.schema.json`](assembly-recipe.schema.json) | Exact part/package pins, Descriptor-to-ABIR mappings, and explicit producer-to-consumer Contract resolution / 标准件与包精确固定、Descriptor 到 ABIR 映射及显式生产者到消费者契约解析 |
| [`recipe-diff.schema.json`](recipe-diff.schema.json) | Guarded changes, risk coverage, compensation and exact ReplacementPlan linkage / 受保护变更、风险覆盖、补偿与 ReplacementPlan 精确联动 |
| [`runtime-event.schema.json`](runtime-event.schema.json) | Exact ABIR/Recipe subject identity and dual producer/consumer Contract exchange evidence / 精确 ABIR/Recipe 主体身份及生产者、消费者双端契约交换证据 |
| [`evaluation.schema.json`](evaluation.schema.json) | Paired evaluation records, uncertainty, claims, limitations and decisions / 配对评测、不确定性、主张、限制与决策 |
| [`standard-part-descriptor.schema.json`](standard-part-descriptor.schema.json) | Immutable Descriptor plus Package, Profile, Suite, Report, Assessment, Plan, Registry and artifact-resolution companions / 不可变 Descriptor 及包、Profile、Suite、Report、Assessment、Plan、Registry 与制品解析伴随对象 |

## Contract ownership and assembly / 契约归属与装配

`ModuleDataContract` owns boundary identity/version/hash, producer and consumer roles, exact SchemaBundle identities, message/stream/event/state structures, field requiredness/nullability/default/unit/encoding, framing, ordering, backpressure, lifecycle, timeout, retry, idempotency, duplicate handling, delivery, cancellation and error classification. It does not standardize internal algorithms or implementation layout. Resource ceilings, authorization propagation, data-protection policy, tenant isolation, deadlines/leases and late-result policy are future extensions and are not v0.6 conformance claims.

`ModuleDataContract` 拥有边界身份、版本、哈希、生产者与消费者角色、精确 SchemaBundle、消息/流/事件/状态结构、字段必填性/可空性/默认值/单位/编码、分帧、顺序、背压、生命周期、超时、重试、幂等、重复处理、交付、取消与错误分类。它不统一内部算法或实现布局。资源上限、授权传播、数据保护策略、租户隔离、deadline/lease 与迟到结果策略属于未来扩展，不属于 v0.6 合规声明。

A Descriptor surface declares only `bindingId → exact contractRef + channelId + contractRoleId`. A Recipe maps that local binding to an ABIR port and declares each producer-to-consumer `contractBinding`; every enabled required Descriptor binding must occur exactly once. A non-Standard-Part boundary may participate through a Contract-typed direct ABIR-port party. Resolution is `exact`, directed `compatible`, or directed `adapter`; compatible and adapter modes pin a `ContractCompatibilityAssessment`, while adapter mode also pins the Assessment's exact artifact and required directed MigrationPlan. The Plan migration artifact, Recipe adapter artifact and Assessment adapter artifact must be the same exact identity. ABIR ports repeat only the exact Contract channel-role identity needed to validate port direction; they do not copy schema, protocol or field facts.

Descriptor 表面只声明 `bindingId → 精确 contractRef + channelId + contractRoleId`。Recipe 把该本地 binding 映射到 ABIR 端口，并声明每条生产者到消费者 `contractBinding`；每个已启用的 required Descriptor binding 必须恰好出现一次。非标准件边界可通过契约化的 ABIR 端口 party 参与。解析模式为 `exact`、有向 `compatible` 或有向 `adapter`；后两者精确固定 `ContractCompatibilityAssessment`，adapter 还必须固定该 Assessment 的精确适配制品与有向 MigrationPlan。Plan 的迁移制品、Recipe 的适配制品和 Assessment 的适配制品必须是同一精确身份。ABIR 端口仅重复校验方向所必需的精确 Contract 通道角色身份，不复制 Schema、协议或字段事实。

`ContractCompatibilityAssessment`, `ContractMigrationPlan`, and `DataLossApproval` are strict normative companion objects under `module-data-contract.schema.json#/$defs`; examples validate them individually. Assessments are source-to-target only and bind exact source/target channels and roles. Reverse compatibility requires a second assessment. An explicit field drop requires an approval for the exact Contract direction, structure and JSON Pointer; its decision time and expiry must cover the complete Assessment evidence window. Applicable aspect matrices cover schema, field semantics, protocol, ordering, delivery, timeout, error, retry, idempotency and cancellation; stream/state aspects apply only to matching interaction types. Schema and field comparison aggregates every structure referenced by the channel, including response, end, error and delta structures; protocol comparison also includes interaction kind and connection cardinality.

`ContractCompatibilityAssessment`、`ContractMigrationPlan` 与 `DataLossApproval` 是 `module-data-contract.schema.json#/$defs` 下可独立校验的严格规范伴随对象。Assessment 仅表达 source→target，并精确绑定两端通道与角色；反向兼容必须另建记录。显式字段丢弃必须有针对精确契约方向、结构与 JSON Pointer 的批准，且其决定时间与有效期必须覆盖完整 Assessment 证据时窗。适用矩阵覆盖 Schema、字段语义、协议、顺序、交付、超时、错误、重试、幂等与取消；stream/state 只在对应交互类型适用。Schema 与字段比较聚合通道引用的全部结构，包括 response、end、error 与 delta；协议比较还包括交互类型与连接基数。

## Evidence levels and one-way DAG / 证据等级与单向 DAG

`InterchangeabilityAssessment.assessedLevel` is the maximum level derived from its exact closure at `assessedAt`:

- `I0 Closed`: source and target are closed, identifiable parts of the same category.
- `I1 Contract-exposed`: both parts expose exact Contract channel-role bindings required by the Profile.
- `I2 Data-aligned`: directed Contract assessments prove the applicable schema, field, protocol and execution semantics.
- `I3 Chain-verified`: an active, unexpired Report proves a real producer-to-consumer chain between distinct packages, with exact RuntimeEvent digests covering every Profile-required binding.
- `I4 Evidence-backed controlled interchangeability`: an exact ReplacementPlan adds migration, acceptance and rollback execution evidence.

`InterchangeabilityAssessment.assessedLevel` 是在 `assessedAt` 基于精确闭包推导出的最高等级：`I0 Closed` 为同类且身份闭合；`I1 Contract-exposed` 为双方暴露 Profile 所需精确通道角色；`I2 Data-aligned` 为有向契约评估证明适用数据与执行语义；`I3 Chain-verified` 为 active 且未过期的 Report 通过精确 RuntimeEvent 摘要证明不同包之间的真实链路，并覆盖 Profile 全部必需 binding；`I4 Evidence-backed controlled interchangeability` 再增加精确 ReplacementPlan 及迁移、验收、回滚执行证据。

I3 requires structured successful, invalid/failure, and recovery RuntimeEvent sequences for every required Profile binding; a normal-path Report or a checker scenario without exact RuntimeEvent evidence is insufficient. The v0.6 minimal example therefore derives only I2, and the reference validator rejects I3/I4 overclaims until the structured timeout/retry/dedup/error/cancellation evidence model is implemented.

I3 要求 Profile 每条必需 binding 都具有结构化的成功、无效/失败与恢复 RuntimeEvent 序列；只有正常路径 Report，或没有精确 RuntimeEvent 的 checker 场景，都不充分。因此 v0.6 最小示例最高只推导 I2；在结构化 timeout/retry/dedup/error/cancellation 证据模型实现前，参考验证器拒绝 I3/I4 过度声明。

The digest graph is one-way: SchemaBundle → Contract → Descriptor/Profile/Suite and ContractCompatibilityAssessment → Recipe → RuntimeEvent → ConformanceReport → InterchangeabilityAssessment. Plans and Reports point to earlier immutable objects; Contracts and Assessments never reverse-reference their later evidence. Artifact retrieval locators live in `ArtifactRecord`, so adding a GitHub, Gitee or object-storage mirror does not change Package or ABIR artifact identity.

摘要图保持单向：SchemaBundle → Contract → Descriptor/Profile/Suite 与 ContractCompatibilityAssessment → Recipe → RuntimeEvent → ConformanceReport → InterchangeabilityAssessment。Plan 与 Report 只指向更早的不可变对象，Contract 与 Assessment 不反向引用后续证据。制品下载位置归 `ArtifactRecord` 所有，因此增加 GitHub、Gitee 或对象存储镜像不会改变 Package 或 ABIR 制品身份。

## Hashing and validation / 哈希与验证

Every example root uses a real SHA-256 over RFC 8785-style canonical JSON with only that root's `contentHash` omitted; append-only records omit `recordHash`. Exact references contain identity, semantic version and content hash. Every `schemaContentHash` covers the RFC 8785 canonical UTF-8 JSON serialization of the complete Schema document, so source whitespace and member order do not change Schema identity. SchemaBundle entries pin every schema and external `$ref` edge. Artifact records verify local bytes. `scripts/update_example_hashes.mjs` rebuilds the acyclic digest graph, and `node scripts/validate_examples.mjs` independently recomputes it and runs schema, semantic, executable-checker and directed mutation gates.

每个示例根都使用真实 SHA-256：对仅删除该根 `contentHash` 的 RFC 8785 风格规范化 JSON 计算；只追加记录则删除 `recordHash`。精确引用同时包含身份、语义版本与内容哈希。每个 `schemaContentHash` 都覆盖完整 Schema 文档的 RFC 8785 规范化 UTF-8 JSON，因此源文件空白与成员顺序不改变 Schema 身份。SchemaBundle 固定每份 Schema 及外部 `$ref` 边，ArtifactRecord 校验本地字节。`scripts/update_example_hashes.mjs` 重建无环摘要图，`node scripts/validate_examples.mjs` 独立重算，并执行 Schema、语义、可执行 checker 与定向变异门禁。

Every `$id` points to the immutable `v0.6.0` repository path. Published tags are never replaced.

每个 `$id` 指向不可变 `v0.6.0` 仓库路径；已发布 tag 不得替换。
