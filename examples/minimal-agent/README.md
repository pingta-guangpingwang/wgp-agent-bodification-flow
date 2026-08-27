# WGP-ABF v0.6 minimal agent / 最小智能体示例

[中文](#中文) · [English](#english)

## 中文

本目录给出 v0.6 的机器闭包，以及一个最高可证明为 `I2 Data-aligned` 的正例。两个不同 `partId`、不同 Package 的编排器实现通过有向 `ModuleDataContract` 与模型提供方装配；示例固定真实 Schema、载荷、制品字节及规范化 JSON 摘要。它用于解释规范，不是可部署客户端或性能基准。

### 主要文件

| 文件 | 作用 |
| --- | --- |
| `module-data-contract.json` / `module-data-contract-target.json` | 1.0.0 与 1.1.0 边界契约；request 的 Schema 身份相同，response 需要有向 adapter 与显式丢弃迁移 |
| `schemas/*.schema.json` | 真实、版本化 Schema 文件及外部 `$ref` 闭包 |
| `standard-part-descriptor*.json` | 编排器源/目标 Descriptor 与独立模型提供方 Descriptor；装配面只引用精确 Contract 通道角色 |
| `abir.json` | 六类对象、精确通道角色端口及真实 producer→consumer 边 |
| `recipe.json` / `recipe-target.json` | 源/目标装配；显式 `contractBindings[]` 使用 compatible 与 adapter resolution |
| `recipe-diff.json` | 从源 Recipe 到目标 Recipe 的精确前置条件、风险、替换与逆向补偿 |
| `events.jsonl` | 两次正常运行；candidate request/response 固定精确 ABIR、Recipe、双方 part/package/contract/channel/role/schema/payload/digest |
| `standard-part-companions.json` | Package、ArtifactRecord、SchemaBundle、Profile、Suite、Report、有向 Contract Assessment/MigrationPlan、DataLossApproval、ReplacementPlan、最高 I2 Assessment 与状态链 |
| `artifacts/tests/*` | 九组独立 input、expected、checker 与 result，覆盖静态契约、正常链路、配置、权限、迁移、验收、RecipeDiff 配方补偿及受限的可靠性/顺序场景；配方补偿不等于回滚后运行验收 |
| `evaluation.json` | 配对运行的说明性评测闭包；不参与 I-level 授级 |

### 机器闭包

- `ModuleDataContract` 是 Schema、字段与执行协议的唯一真相；Descriptor、ABIR 与 Recipe 不复制这些事实。
- Descriptor 本地 `assemblyBinding.bindingId` 固定 `contractRef + channelId + contractRoleId`；Recipe 再把 `assemblyBindingId` 映射到 `abirPortId`。每个 required binding 恰好出现在一条显式 `contractBinding`；非标准件的聊天边界通过 contract-typed ABIR port party 参与 exact resolution。每条 binding 必须对应 ABIR 中同方向的真实边。
- request 方向为 1.0.0 orchestrator producer → 1.1.0 provider consumer，使用实际执行的 bounded checker。response 方向为 1.1.0 provider producer → 1.0.0 orchestrator consumer，使用 exact-ref adapter、针对 `/providerMetadata` 的 typed `DataLossApproval`、checkpoint 与可恢复 rollback；Assessment、Plan 与实际加载的制品身份必须一致。
- `SchemaBundle` 固定完整 Schema 文档的 RFC 8785 规范化 JSON 摘要及外部 `$ref` 闭包；源文件空白与对象成员顺序不改变身份。解析记录只提供本示例的本地位置。Package、签名（若存在）、SourceClaim 证据与 ABIR Artifact 使用 exact artifact refs；镜像 locator 只归 `ArtifactRecord`。
- `RuntimeEvent.subject` 使用精确 `abirRef` 与 `recipeRef`。contract exchange 的 producer 与 consumer 分别固定 Contract、通道、角色、结构、SchemaBundle、载荷制品和字节摘要；validator 用双方 Schema 校验载荷，并实际运行 adapter/rollback。独立 chain checker 重新加载固定 Recipe、RuntimeEvent 与载荷字节，重算 Recipe、事件和载荷摘要，并闭合 binding、part 与 package 身份。
- 权限 checker 读取目标链路双方 Descriptor 的必需权限元组，通过 typed `requirementMappings` 解析到固定 PermissionPolicy 规则，再核验规则决策；未映射的 Descriptor 权限不得作为已满足证据。
- Profile 与 Suite 都用 `{contractRef, bindings:[{channelId, roleId}]}` 固定适用通道角色对，避免集合笛卡尔歧义。兼容评估 mapping 同样固定 source/target channel 与 role。
- 唯一正向 `InterchangeabilityAssessment` 声明 maximum-derived `I2`。validator 依次证明 `I0 Closed → I1 Contract-exposed → I2 Data-aligned`，并拒绝把当前证据过度授予 I3/I4。
- ConformanceReport 固定正常 request/response RuntimeEvent 摘要与执行时间窗，但正常路径不等于 `I3 Chain-verified`。九个 checker 中的 failure/recovery 场景是受限的独立输入序列，并非结构化 RuntimeEvent 生命周期证据。

### v0.6 证据边界

参考验证器尚未定义可证明 timeout→retry→recovery、dedup side effect、error classification、cancel acknowledgement 的结构化 RuntimeEvent 结果模型，因此本示例不提供 I3 或 I4 正例，并主动拒绝相应过度声明。ReplacementPlan、迁移与验收 checker 是规范对象和局部执行示例；`test.rollback` 只证明 RecipeDiff 正向应用及补偿后精确恢复源 Recipe，不声称补偿后重新运行源实现并通过验收，也不把整件 Assessment 提升到 I4。

资源上限、授权上下文传播、数据保护、租户隔离、deadline/lease 与迟到结果策略也尚未进入 v0.6 `ModuleDataContract`，不能作为本版 I2 合规主张。当前 timeout 门槛仅覆盖 `durationMs`、起算点、超时动作及有向兼容比较。

### 验证

从仓库根目录运行：

```powershell
node scripts/update_example_hashes.mjs
node scripts/validate_examples.mjs
git diff --check
```

更新器重建无环真实摘要；验证器严格编译全部 Schema、逐行验证 JSONL、重算根/制品/Schema 摘要、执行九个 checker，并运行针对 SchemaBundle 篡改、字段与可靠性语义漂移、角色/方向错误、缺 ABIR 边、反向 assessment/migration、错误载荷 Schema/digest、未解析 causation、报告证据漂移及 I-level 过度授级的定向变异。

## English

This directory provides the v0.6 machine closure and one positive example whose maximum provable level is `I2 Data-aligned`. Two orchestrator implementations with distinct `partId` and Package identities are assembled with a model provider through directed `ModuleDataContract` records. Real schema, payload, artifact-byte, and canonical-JSON digests close the example. It explains the specification; it is not a deployable client or benchmark.

The principal files are two Contract versions, materialized versioned schemas, three Descriptors, ABIR, source and target Recipes, a guarded RecipeDiff, normal-path RuntimeEvent JSONL, typed companions, nine independent test sets, and an illustrative Evaluation that does not grant an I-level. The chain checker independently reloads the pinned Recipe, RuntimeEvents, and payload bytes; recomputes their digests; and closes binding, part, and package identities. The permission checker maps every required Descriptor permission tuple through typed policy mappings to a pinned rule and decision.

The Contract solely owns schema, field, protocol, timeout/retry/idempotency, ordering, delivery, cancellation, error, stream, and state semantics. Descriptor bindings expose exact Contract channel-role identities; the Recipe maps every required binding to an ABIR port and one explicit same-direction Contract binding. Non-Standard-Part chat boundaries participate through Contract-typed ABIR-port parties. The request direction executes a bounded checker. The response direction executes an exact-ref adapter under a typed `DataLossApproval`, checkpoints `/providerMetadata`, validates the target payload, and restores the original during rollback.

RuntimeEvent subjects carry exact ABIR and Recipe references. Each Contract exchange independently pins producer and consumer part, package, Contract, channel, role, structure, SchemaBundle, payload artifact, and byte digest. Package, optional signature, SourceClaim evidence, and ABIR artifact identities use exact artifact references; retrieval mirrors live only in `ArtifactRecord`.

The only positive whole-part assessment is the maximum-derived `I2` result. The validator proves `I0 Closed`, `I1 Contract-exposed`, and `I2 Data-aligned`, then rejects I3/I4 overclaims. The Report pins the normal request/response events, but normal-path events do not prove the required failure and recovery lifecycle. The bounded reliability scenarios are independent checker inputs, not structured RuntimeEvent execution evidence.

The v0.6 reference validator does not yet model timeout→retry→recovery, deduplicated side effects, classified errors, or cancellation acknowledgement as structured RuntimeEvent facts. Consequently, this release has no positive I3/I4 fixture. ReplacementPlan, migration, and acceptance checkers remain normative/local examples. `test.rollback` proves exact RecipeDiff application and compensation back to the source Recipe only; it does not claim that the source implementation was rerun and accepted after compensation, and it cannot elevate the whole-part assessment to I4.

Resource ceilings, authorization-context propagation, data-protection rules, tenant isolation, deadlines/leases, and late-result policy are also future extensions rather than v0.6 I2 claims. v0.6 timeout comparison covers duration, start point, and timeout action.

Run the three commands in the Chinese validation section. All committed exact hashes are recomputed from canonical JSON or materialized bytes; the validator rejects repeated-character placeholder digests and unresolved evidence.
