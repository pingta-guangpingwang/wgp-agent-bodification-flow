<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# WGP-ABF bilingual glossary / 双语术语表

This glossary is normative for translation consistency in v0.4. Schema and event identifiers remain untranslated. 本表用于保证 v0.4 翻译一致；Schema 与事件标识符不翻译。

| 中文 | English | Schema or identifier | Rule / 使用规则 |
|---|---|---|---|
| 智能体配置工程 | Agent Configuration Engineering | — | WGP-ABF 所属工程领域 |
| 智能体机体化流程 | Agent Bodification Flow | WGP-ABF | Bodification 是项目专用词，不表示物理具身 |
| 图纸中间表示 | Agent Blueprint Intermediate Representation | WGP-ABIR | 不再使用 Agent Body IR |
| 规范结构记录 | Canonical Structural Record | — | 由 WGP-ABIR + AssemblyRecipe 共同构成 |
| 白皮书版本系列 | Whitepaper Edition Series | `0.4` | 面向读者的版本简称，不是 npm 包版本或 `format` 值 |
| 包与机器规范版本 | Package and Machine-Spec Version | `0.4.0` | npm 包、验证器和机器规范发布使用 SemVer |
| 格式兼容族 | Format Compatibility Family | `/0.4` | `wgp-…/0.4` 表示文档兼容族；补丁发布不得破坏该族 |
| 不可变发布标签 | Immutable Release Tag | `v0.4.0` | 固定 Schema、样例和构建产物；Schema `$id` 引用该标签 |
| 组件 | Component | `Component` | ABIR 中可替换、可配置、可观测的结构对象 |
| 组件绑定 | Component Binding | `componentBindings[]` | 在 `AssemblyRecipe` 中把 ABIR 组件绑定到实现、配置和目标平台 |
| 资源 | Resource | `Resource` | 数据或外部能力，不伪装成组件 |
| 策略 | Policy | `Policy` | 在模型外强制执行的约束 |
| 产物 | Artifact | `Artifact` | 可寻址的运行或评测结果 |
| 接口 | Interface | `Interface` | 端口或协议定义 |
| 容器 | Container | `Container` | 唯一包含层级 |
| 装配配方 | Assembly Recipe | `AssemblyRecipe` | 可编译的期望配置 |
| 配方差分 | Recipe Diff | `RecipeDiff` | 以 `baseVersion`、`baseContentHash`、`targetVersion`、`targetContentHash`、`preconditions`、`operations`、`riskAssessments`、`compensation` 和 `approval` 表达受控语义变更 |
| 配置逆操作 | Configuration Inverse Operation | `operations[].compensation` | 只逆转对应操作对 `AssemblyRecipe` 的修改，不撤销外部副作用 |
| 配置回滚 | Configuration Rollback | — | 按安全顺序执行配置逆操作，并验证目标内容摘要 |
| 风险评估 | Risk Assessment | `riskAssessments` | 按路径记录类别、严重度、缓解措施、残余风险和风险审批 |
| 外部副作用补偿 | External Side-Effect Compensation | `compensation.externalSideEffects` | 记录配方文档之外效果的补偿动作、验证、幂等性和责任人 |
| 不可逆操作 | Irreversible Operation | — | 没有真实逆操作或可靠补偿；不得用空操作伪装成可恢复 |
| 事务审批 | Transaction Approval | `approval` | 记录整项差分的审批，不替代具体风险的审批 |
| 工程图纸 | Engineering Blueprint | — | 面向人的权威编辑投影，不是当前 Schema 的独立机器类型 |
| 投影配置 | Projection Profile | `projectionProfiles[]` | ABIR 中记录布局、主题、机体映射与无障碍说明的投影条目 |
| 结构来源声明 | Source Claim | `SourceClaim` | 除 `id` 外，必含 `subjectId`、`fieldScope`、`structuralProvenance`、`identityAssurance`、`fieldCoverage`、`runtimeEvidence`、`operationCapabilities`、`trustState`、`method`、`observedAt`；可选 `adapter`、`evidenceRefs`、`expiresAt` |
| 结构来源 | Structural Provenance | `structuralProvenance` | 只描述字段的结构来源，不表示信任结论，也不授权操作 |
| 原生级 | Native | `F3` | 来自平台原生、可定位的权威结构表示 |
| 导出级 | Exported | `F2` | 来自平台或版本化适配器的可重复结构导出 |
| 推断级 | Inferred | `F1` | 由静态分析、运行观测或其他证据推断 |
| 人工级 | Manual | `F0` | 由人工直接声明，尚无更高等级的结构来源证据 |
| 操作能力 | Operation Capability | `operationCapabilities` | `view / edit / compile / roundTrip / hotReload / replace` 是针对 `fieldScope` 的可组合能力；不等同用户授权或审批 |
| 强类型边 | Typed Edge | `Edge` | 连接具体端口并携带关系语义 |
| 运行绑定 | Runtime Binding | — | 结构身份与原生运行实体的证据化关联；是方法论概念，不是当前 Schema 的顶层类型 |
| 运行事件 | Runtime Event | `RuntimeEvent` | 使用三轴事件语义 |
| 存储类别 | Storage Class | `storageClass` | `durable / ephemeral` |
| 事件来源 | Event Origin | `origin` | `primary / derived` |
| 回放角色 | Replay Role | `replayRole` | input/expectedOutcome/verificationOnly/projectionOnly/excluded |
| 视图回放 | View Replay | — | 无副作用地重建界面 |
| 模拟回放 | Simulation Replay | — | 使用录制依赖做契约回归 |
| 重新执行 | Re-execution | — | 重新调用真实组件，需新授权 |
| 评测协议 | Evaluation Protocol | `protocol` | 记录证据设计、固定条件、重复次数、预注册状态和成功标准 |
| 组件级评测 | Component-Level Evaluation | `subject.scope = "component"` | 单组件局部行为 |
| 装配级评测 | Assembly-Level Evaluation | — | 模块或子图交互的方法论概念；当前 Schema 没有 `assembly` scope 枚举 |
| 智能体级评测 | Agent-Level Evaluation | `subject.scope = "agent"` | 完整任务结果 |
| 独立性能分 | Standalone Performance Score | — | 组件自身条件下的分数 |
| 当前装配贡献估计 | In-Assembly Contribution Estimate | `results[] / claims[]` | 固定配方与环境内的条件差异；由评测结果和有边界的 claim 表达，不是独立机器类型 |
| 最小可检测效应 | Minimum Detectable Effect | — | 统计功效计划中的方法论概念；当前 Schema 没有同名字段 |
| 诊断报告 | Diagnosis Report | — | 组织假设、替代解释、干预与证据的方法论概念；当前 Schema 没有同名类型 |
| 疑似原因 | Suspected Cause | — | 方法论概念；未经干预，不得写成根因，当前 Schema 没有同名状态字段 |
| 已验证原因 | Validated Cause | — | 方法论概念；达到预注册干预门槛后才可使用，当前 Schema 没有同名状态字段 |
| 证据化改进闭环 | Evidence-Governed Improvement Loop | — | “进化”不表示未经授权自主改写 |
| 机体投影 | Body Projection | — | 仅在呈现层使用 |
| 符合规范的实现 | Conforming Implementation | — | 必须附版本、例外和验证证据 |
