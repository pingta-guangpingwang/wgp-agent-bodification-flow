<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# WGP-ABF v0.5 → v0.6 migration / 迁移指南

WGP-ABF v0.6 introduces a breaking `/0.6` format family. A `/0.5` document remains valid only against the immutable `v0.5.0` schemas; changing its `format` string is not a migration. Create new documents, resolve every exact reference, recompute content hashes, and rerun conformance evidence.

WGP-ABF v0.6 引入破坏性的 `/0.6` 格式族。`/0.5` 文档只继续受不可变 `v0.5.0` Schema 约束；仅修改 `format` 字符串不构成迁移。迁移必须创建新文档、重新解析所有精确引用、重算内容摘要并重新执行一致性证据。

## Breaking changes / 破坏性变化

| v0.5 | v0.6 | Required action / 必需动作 |
|---|---|---|
| Port and Descriptor fields repeat protocol, Schema, media type, and cardinality facts | `ModuleDataContract` is the sole normative owner of payload and exchange semantics | Publish or select an exact contract and replace copied facts with channel-and-role references / 发布或选择精确契约，以通道与角色引用替代复制字段 |
| A Descriptor assembly port defines its own interface facts | A Descriptor maps each local binding only to an exact Contract channel and role; the Recipe maps that binding to an ABIR instance port | Rebuild every Descriptor binding and Recipe port mapping; reject unresolved channel, role, binding, or port IDs / 重建每个描述符绑定与配方端口映射，拒绝无法解析的通道、角色、绑定或端口 ID |
| A Recipe connects local surface/port mappings | `contractBindings` resolve a directed producer→consumer chain; Contract and channel identity derive from both Descriptor bindings, while the resolution pins exact compatibility or adapter evidence when required | Add one resolved binding for every critical data path / 为每条关键数据链新增一个已解析绑定 |
| Profile and Suite entries rely on Descriptor-local surface IDs | Profiles and Suites select exact contract channels and roles | Replace bare surface IDs and pin the contract version, digest, channel, and role / 替换裸 surface ID，并固定契约版本、摘要、通道与角色 |
| A Report can identify one part without proving the other party | Chain evidence identifies the exact contract path, binding, producer, consumer, packages, channels, roles, executor, profile, and environment | Rerun pairwise suites; do not carry forward single-part reports / 重新执行成对套件，不得沿用单件报告 |
| Runtime ordering is inferred from a run-global sequence and timestamps | Contract exchanges use an ordering domain and contract-defined stream lifecycle | Re-emit events with binding identity; never infer cross-producer causality from wall-clock timestamps / 以绑定身份重新生成事件，禁止用墙钟时间推导跨生产者因果 |
| I1 Adapter-wrapped, I2 Interface-conformant, I3 Behavior-verified | I1 Contract-exposed, I2 Data-aligned, I3 Chain-verified | Recompute every Assessment; old I1–I3 labels and evidence do not map automatically / 重新计算全部 Assessment，旧等级及证据不得自动映射 |

## Migration procedure / 迁移步骤

1. Freeze the source documents and record their `/0.5` content hashes. Never rewrite the `v0.5.0` tag or Release. / 冻结源文档并记录 `/0.5` 内容摘要，不得改写 `v0.5.0` 标签或 Release。
2. Identify each critical producer→consumer path and assign stable producer, consumer, channel, structure, and role IDs. / 识别每条关键生产端到消费端数据链，并分配稳定的生产端、消费端、通道、结构与角色 ID。
3. Publish a `ModuleDataContract` that pins Schema bundles and their transitive external-reference closure, field meaning, serialization, protocol framing, ordering, delivery, stream completion, errors, timeout, cancellation, retry, idempotency, duplicate handling, and state semantics. / 发布 `ModuleDataContract`，固定 Schema Bundle 及传递外部引用闭包、字段含义、序列化、协议分帧、顺序、交付、流结束、错误、超时、取消、重试、幂等、重复处理与状态语义。
4. Rebuild each ABIR Port as a structural position. Add an expected exact Contract channel and role to each critical directed Port; represent a contract-typed bidirectional interaction as two directed Ports. Rebuild each Descriptor local binding as an implementation mapping to a Contract channel and role. Neither object copies protocol or Schema facts. / 将每个 ABIR Port 重建为结构位置；每个关键定向端口还必须固定预期契约通道与角色，契约化双向交互拆成两个定向端口。将每个描述符本地绑定重建为实现到契约通道与角色的映射；两者都不得复制协议或 Schema 事实。
5. Rebuild Profiles, Suites, and target Environment records before any dependent conclusion. Replace surface IDs with exact Contract-channel-role selections, and make required vectors cover every applicable data and execution aspect. / 在生成任何依赖性结论前重建 Profile、Suite 与目标 Environment；用精确契约通道—角色选择替换 surface ID，并让必选向量覆盖全部适用的数据与执行语义。
6. Execute the bounded compatibility checker over the exact source and target Contract channels and roles. Aggregate every structure referenced by each channel, including auxiliary response/end/error/delta structures, and include interaction kind and connection cardinality. Publish `ContractCompatibilityAssessment` only after all applicable results are independently reproduced. An adapter path must make the Assessment artifact equal the MigrationPlan artifact, resolve adapter/rollback/checkpoint through exact ArtifactRecords, cover every assessed channel and every changed field in all corresponding structures, and bind each explicit drop to a `DataLossApproval` for the exact Contract direction, structure and JSON Pointer whose decision time and expiry cover the complete Assessment evidence window. / 对精确源端与目标端契约通道—角色运行有界兼容检查器；聚合每个通道引用的全部结构，包括辅助 response/end/error/delta，并纳入交互类型与连接基数。只有全部适用结果均可独立复现后，才发布 `ContractCompatibilityAssessment`。适配器路径必须使 Assessment 制品与 MigrationPlan 制品一致，通过精确 ArtifactRecord 解析 adapter/rollback/checkpoint，覆盖全部已评估通道及全部对应结构中的每个变化字段，并让每项显式丢弃绑定到针对精确契约方向、结构与 JSON Pointer 的 `DataLossApproval`，且其决定时间与有效期覆盖完整 Assessment 证据时窗。
7. Rebuild the AssemblyRecipe: use each `standardPartBindings[].surfaceMappings[].portMappings[]` entry to map a Descriptor-local `assemblyBindingId` to its instance `abirPortId`, then resolve every producer→consumer `contractBinding`. Every enabled required Descriptor binding must occur exactly once; a non-Standard-Part boundary may use a Contract-typed ABIR-port party. Derive Contract and channel identity from both endpoints. For `compatible` mode, exact-reference the prior Assessment and omit adapter-only fields. For `adapter` mode, exact-reference that same Assessment's MigrationPlan and adapter artifact; the Plan's migration artifact, Recipe artifact and Assessment artifact must be the same exact identity. An A→B assessment, plan or adapter cannot satisfy B→A. / 重建 AssemblyRecipe：通过每个 `standardPartBindings[].surfaceMappings[].portMappings[]` 将描述符本地 `assemblyBindingId` 映射到实例 `abirPortId`，再解析每个生产端→消费端 `contractBinding`。每个已启用的 required Descriptor binding 必须恰好出现一次；非标准件边界可使用契约化 ABIR 端口 party。契约与通道身份由双方端点导出。`compatible` 模式必须 exact-reference 先前 Assessment，并省略 adapter 专用字段；`adapter` 模式必须 exact-reference 同一 Assessment 的 MigrationPlan 与适配制品，且 Plan 迁移制品、Recipe 制品和 Assessment 制品必须是同一精确身份。A→B 的 Assessment、Plan 或 adapter 都不能用于 B→A。
8. Execute producer→consumer conformance suites against the pinned Recipe and Environment. Emit `/0.6` RuntimeEvents first, then issue a multi-chain `ConformanceReport` whose `chainBindings[]` exact-reference that Recipe and whose required results are supported by those events. An I3 claim additionally requires structured successful, invalid/failure, and recovery RuntimeEvent sequences for every Profile-required binding; normal-path events and detached checker scenarios are insufficient. / 针对固定 Recipe 与 Environment 执行生产端到消费端一致性套件；先生成 `/0.6` RuntimeEvent，再签发多链路 `ConformanceReport`，其 `chainBindings[]` exact-reference 该 Recipe，且全部必选结果均由这些事件支撑。I3 主张还要求 Profile 每条必需 binding 都具有结构化的成功、无效/失败与恢复 RuntimeEvent 序列；正常路径事件和独立 checker 场景不充分。
9. Only after the Recipe-bound evidence exists, issue status records, whole-part `InterchangeabilityAssessment`, `ReplacementPlan`, and `RecipeDiff` objects on their actual one-way dependency branches. / 只有 Recipe 绑定证据就绪后，才按真实单向依赖分支生成状态记录、整件 `InterchangeabilityAssessment`、`ReplacementPlan` 与 `RecipeDiff`。
10. Rebuild Evaluation records, recompute every content hash, and run the repository validator. / 重建 Evaluation 记录、重算全部内容摘要并运行仓库验证器。

## Compatibility claims / 兼容性主张

Schema compatibility is directed. The v0.6 reference checker treats a differing pinned Schema content hash as `migrationRequired`; it does not claim general JSON Schema subsumption from a finite keyword comparison. Where Schema identity is exact, every applicable field, protocol and reliability aspect must still pass the pinned directed checker. Otherwise, a pinned adapter and scoped execution evidence are required. A finite example set cannot establish universal Schema inclusion, and Schema compatibility cannot establish runtime stability or task-quality equivalence.

Schema 兼容具有方向性。v0.6 参考 checker 对不同的固定 Schema 内容摘要一律给出 `migrationRequired`，不以有限关键字比较声称普遍 JSON Schema 包含关系。Schema 身份相同时，所有适用字段、协议与可靠性维度仍必须通过固定的有向 checker；否则需要固定 adapter 与限定执行证据。有限样例不能证明普遍 Schema 包含关系，Schema 兼容也不能证明运行稳定或任务质量等价。

The v0.6 repository intentionally publishes no positive I3/I4 fixture. The reference validator refuses those levels until timeout/retry/dedup/error/cancellation outcomes and recovery causality are represented as structured RuntimeEvent evidence. Migration tools may create the normative records, but must not report an I3/I4 result from the repository's normal-path example. / v0.6 仓库有意不发布 I3/I4 正例；在 timeout/retry/dedup/error/cancellation 结果与恢复因果能以结构化 RuntimeEvent 证据表达前，参考验证器拒绝这两个等级。迁移工具可以创建规范对象，但不得用仓库的正常路径示例声称 I3/I4。

## Recovery / 恢复

Migration is copy-on-write. Keep the `/0.5` documents, packages, and evidence available until `/0.6` acceptance and rollback checks pass. If migration fails, discard the incomplete `/0.6` graph and continue using the pinned `/0.5` release; do not mutate either release to make hashes match.

迁移采用写时复制。在 `/0.6` 验收与回退检查通过前，保留 `/0.5` 文档、包与证据。迁移失败时，丢弃未完成的 `/0.6` 引用图并继续使用固定的 `/0.5` 发布；不得通过修改任一发布来迁就摘要。

## Validation / 验证

```sh
pnpm install --frozen-lockfile
pnpm run validate
python scripts/render_diagrams.py
python scripts/build_pdfs.py
python scripts/validate_pdfs.py
python scripts/build_release.py
pnpm run validate
```

Passing these repository checks proves only the published example and cross-document invariants. A deployment still needs its own environment-pinned pairwise conformance evidence. / 通过这些仓库检查只证明已发布样例与跨文档不变量；真实部署仍需在自身固定环境中生成成对一致性证据。
