<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# WGP 智能体机体化流程（WGP-ABF）

## 智能体工程图纸、证据化评测与验证式组件替换框架

**版本 0.4 — 中英双语图解公开草案**<br>
**概念提出者与主要作者：王广平（Wang Guangping）**<br>
**发布日期：2026 年 8 月 26 日**<br>
**状态：Public Draft；不是行业标准，也不是认证计划**

![WGP-ABF 封面主视觉：从二维工程图纸到模块化智能体装配体](../assets/images/wgp-abf-cover-art-v0.4.png)

> WGP-ABF 让智能体配置成为可视、可差分、可测试、可改装、可验证的一等工程产物。

在 WGP-ABF 中，**机体化（Bodification）**是一个项目专用词：它指把智能体配置转化为有类型、有版本、可观测、可测试的工程装配体。它不表示物理具身、人格化或生物学建模。结构规范使用 `Component`、`Edge`、`Container` 和 `AssemblyRecipe`；“机体”只用于面向人的可选视觉投影。

---

## 摘要

现代智能体由模型、工具、记忆、沙箱、权限、审批、子智能体、运行时和外部服务共同组成。生成式编程正在降低实现成本，但长期需要维护的工程资产已经从源代码延伸到装配配方、评测集、证据和治理策略。智能体配置却普遍缺少源代码已有的语义差分、评审、测试、归因与回退机制。

WGP-ABF 提出一种平台中立的智能体配置工程方法，把配置转换为可拆解、可编辑、可运行、可评测和可诊断的工程产物。它定义三份协议与一条图纸纪律：结构协议以 WGP-ABIR 和 `AssemblyRecipe` 表达规范结构；运行协议以带存储、来源和回放角色的事件表达过程；证据协议以分层评测、统计条件和诊断报告约束改进主张；二维工程图纸则成为 ABIR 面向人的权威编辑投影。机体和三维视图仅是可选的只读解释投影。

WGP-ABF 的核心价值不是减少配置输入，而是提升理解和归因能力：揭示一份配置实际装配了什么，定位薄弱组件或关系，把改动表达为可审查的 `RecipeDiff`，并在相同任务集与受控环境下验证改动是否带来改善。符合核心规范的实现必须标注结构来源，独立声明操作能力，区分事件的三个维度，让每个分数可追溯到原始证据，并证明图纸修改能够改变实际运行。DeepSeek Harness（DSH）是首个版本化参考适配案例，但不是该方法的概念边界。

![图 1：WGP-ABF 系统地图](../assets/diagrams/wgp-abf-system-map.png)

**图 1 — 系统地图。** WGP-ABIR 与 `AssemblyRecipe` 是规范、可版本化的结构记录；二维图纸是它们面向人的权威编辑投影。所有视图必须共享同一模型，不得暗中维护第二份业务结构。

---

## 1. 愿景、目标用户与非目标

### 1.1 愿景

让普通用户能像查看装配图一样理解智能体，让开发者能像评审代码一样评审配置，让团队能像做受控实验一样验证每次修改。

WGP-ABF 希望建立一条连续工作流：

1. 从真实平台导入配置并说明每项信息来自哪里；
2. 用二维工程图纸呈现组件、接口、关系、权限和容器；
3. 把一次修改表达为可读、可审查、可应用的差分；
4. 编译到目标平台并检测漂移；
5. 在可重复条件下采集运行证据；
6. 形成有边界的结论，升级、保留实验或回退。

### 1.2 目标用户

- 想看懂、修改或组合智能体的普通用户；
- 构建 Agent Studio、运维平台和可视化编辑器的产品团队；
- 需要审计权限、插件与数据流的安全和治理人员；
- 研究智能体评测、诊断和组件交互的工程师；
- 希望提供可移植配置或兼容适配器的开源社区。

### 1.3 非目标

WGP-ABF 不承诺统一所有平台的执行语义，不把人形外观当作结构真相，不以隐藏架构替代安全控制，不声称一次 A/B 就能完成因果归因，也不把任何单一模型或框架定义为唯一实现。

---

## 2. 问题边界与设计原则

### 2.1 需要解决的七个问题

1. **不可见**：用户只能看到 YAML、JSON 或表单，看不到完整装配体。
2. **不可比**：相同概念在不同平台上缺少共同的结构语义。
3. **不可审查**：文本 diff 无法稳定表达“换了哪个组件、影响哪条路径”。
4. **不可回写**：很多可视化只读，修改不能安全落回真实运行配置。
5. **不可重放**：事件不完整或存续语义不清，界面重放与真实重执行混为一谈。
6. **不可归因**：分数存在，但分数、原始证据与结构对象之间没有引用链。
7. **不可治理**：插件来源、权限、审批、补偿和版本漂移缺少统一记录。

### 2.2 六条设计原则

- **真实优先**：每条结构 claim 都必须说明来源和覆盖度。
- **一个模型，多种投影**：机器规范记录、二维编辑图纸和三维展示不复制业务事实。
- **权限与来源分离**：F3–F0 不自动授予查看、编辑、编译或回写能力。
- **声明与状态分离**：配方描述期望配置；运行事件描述实际过程。
- **证据先于升级**：修改只有通过预先声明的门槛，才能进入稳定版本。
- **渐进式复杂度**：新手先完成安全的目标，专家再展开字段、统计和治理细节。

![图 2：从导入到证据化复测的九阶段工作流](../assets/diagrams/wgp-abf-nine-stage-flow.png)

**图 2 — 九阶段工作流。** 每一阶段都留下可审查产物；最后的门槛不是“成功启动”，而是修改真实改变运行并得到同条件证据支持，或在不满足门槛时触发回退。

---

## 3. 规范语言、版本与合规档位

本文中的“必须／不得／应当／可以”分别对应 RFC 风格的 `MUST / MUST NOT / SHOULD / MAY`。只有显式使用这些词的句子构成规范性要求，其余内容用于解释和指导。

### 3.1 版本

- `specVersion`：WGP-ABF 机器规范的语义版本；
- `schemaVersion`：单个 JSON Schema 的语义版本；
- `recipeVersion`：某份装配配方的单调版本；
- `definitionVersion`：组件定义版本；
- `adapterVersion`：平台适配器版本。

本白皮书的 **0.4** 是面向读者的版本系列简称；npm 包、验证器和机器规范发布使用 SemVer **0.4.0**。`wgp-abir/0.4`、`wgp-recipe-diff/0.4`、`wgp-runtime-event/0.4` 一类 `format` 值表示 **0.4 格式兼容族**，不是 npm 包版本；同一兼容族的补丁发布必须继续接受已有合法文档，只有破坏兼容性时才能进入新的格式族。不可变 Git 标签 **`v0.4.0`** 固定该次发布的 Schema、样例和构建产物，Schema `$id` 必须引用这一标签，而不得引用可移动分支。

`0.y.z` 表示公开草案。破坏性字段或语义修改必须提高次版本，补丁版不得改变既有合法文档的含义。白皮书 0.4、包／规范版本 0.4.0、格式兼容族 `/0.4` 与 Git 标签 `v0.4.0` 指向同一首发语义基线，但分别服务于文档标识、工具分发、文档兼容判断和不可变发布定位，不得互相替代。

### 3.2 分级核心合规与可选投影合规

| 等级 | 名称 | 最低要求 |
|---|---|---|
| C0 | 可视化说明器 | 明确标注为非合规的教学或展示原型，不得声称运行保真度 |
| C1 | 图纸合规 | 合法 ABIR + AssemblyRecipe、强类型边、逐对象来源、唯一规范记录、可导出表示 |
| C2 | 操作合规 | C1 + 字段级能力、语义差分、风险审查、原生编译、运行绑定核验和回退纪律 |
| C3 | 证据合规 | C2 + 事件三轴、安全回放、评测不确定性、claim 成熟度、对象诊断和可比复测 |

实现必须公开验证器版本、支持的 Schema 与适配器版本、例外和其合规声明的证据。精美的机体或三维视图不会提高核心合规等级。

**Projection Conformance** 是独立的可选标签。实现如提供二维、机体或三维投影，则必须证明投影由规范记录生成，编辑只发生在声明为可回写的二维字段上，并提供键盘操作、文字替代和非颜色编码。没有机体或三维投影不影响 C1–C3。

---

## 4. 规范模型：ABIR、配方、证据与投影

WGP-ABF 的唯一规范结构事实由 **WGP Agent Blueprint Intermediate Representation（WGP-ABIR）** 与 **`AssemblyRecipe`** 共同构成：

- **WGP-ABIR** 表达对象、端口、关系、来源 claim 和可用能力；
- **AssemblyRecipe** 表达可编译的期望配置、版本锚点与目标平台；
- **Evidence Store** 保存事件、任务结果、产物引用和评测结果；
- **ProjectionProfile** 保存布局、主题、机体映射和无障碍说明。

`ProjectionProfile` 不得成为 `ComponentInstance` 的必填字段。`arm.browser` 一类视觉名称不得进入核心类型系统。布局变化不得造成配方语义变化。

### 4.1 核心对象类别

| 类别 | 用途 | 示例 |
|---|---|---|
| `Component` | 可替换、可配置、可独立观测的运行单元 | 模型提供器、记忆检索器、工具执行器 |
| `Resource` | 被组件读取或写入的数据与能力资源 | 向量库、文件系统、模型凭据引用 |
| `Policy` | 在模型外强制执行的约束 | 网络策略、审批规则、预算上限 |
| `Artifact` | 可寻址的运行或评测产物 | 补丁、报告、截图、日志片段 |
| `Interface` | 端口、协议或服务定义 | Chat completion、tool call、RPC |
| `Container` | 对对象进行唯一包含的层级 | 子智能体模块、工具组 |

消息、提示词、任务定义和策略不应为了画图方便而全部伪装成 `Component`。

### 4.2 规范化与身份

符合规范的实现必须为对象提供稳定、带命名空间的 ID。用于哈希、签名和缓存的 JSON 应使用确定性规范化；推荐 RFC 8785 JSON Canonicalization Scheme。包含关系必须只有一个权威表示，不能同时由 `Container.children` 和重复 containment edge 维护。

跨配方引用必须固定版本或内容摘要。无法解析、出现循环但未声明递归模块、或 ID 冲突时，导入必须失败并给出可定位诊断。

---

## 5. 结构来源：保真度不是权限

F3–F0 作为清晰的界面徽标继续保留，但 `structuralProvenance` 只表示某条 claim 的结构来源，不表示信任结论，也不授予任何操作权限：

- **F3 Native（原生）**：来自目标平台原生、可定位的权威结构表示；
- **F2 Exported（导出）**：来自平台或版本化适配器的可重复结构导出；
- **F1 Inferred（推断）**：由静态分析、运行观测或其他证据推断；
- **F0 Manual（人工）**：由人工直接声明，尚未获得更高等级的结构来源证据。

除通用 claim 标识 `id` 外，每条 `SourceClaim` 必须包含：`subjectId`、`fieldScope`、`structuralProvenance`、`identityAssurance`、`fieldCoverage`、`runtimeEvidence`、`operationCapabilities`、`trustState`、`method` 与 `observedAt`。`fieldScope` 是该 claim 覆盖的 JSON Pointer 集合；身份稳定性、字段覆盖、运行证据和信任状态必须分别记录，不能由 F 等级代替。`adapter`、`evidenceRefs` 与 `expiresAt` 为可选字段；存在失效期限时，过期 claim 不得继续作为当前证据使用。

![图 3：结构来源与操作能力分离](../assets/diagrams/wgp-abf-fidelity-matrix.png)

**图 3 — 来源与权限分离。** F3 Native（原生）不代表可编辑，F2 Exported（导出）也不代表“受限可编辑”。操作能力必须由适配器和字段级证明独立声明。

### 5.1 操作能力

`operationCapabilities` 是 `SourceClaim` 针对 `fieldScope` 所覆盖字段给出的可组合能力集合，可以同时包含：

- `view`：能够稳定显示；
- `edit`：允许生成合法修改；
- `compile`：能编译为目标平台配置；
- `roundTrip`：导出、修改、回写后能保持声明的语义；
- `hotReload`：在声明的运行阶段内无需整体重启；
- `replace`：支持原子替换并保留接口约束。

这些值说明适配器已证明的技术能力，不等同于当前用户授权、部署策略或审批结果；执行操作时仍必须同时满足三者。能力不能从 `structuralProvenance`、`trustState` 或单一运行观测推导。整机界面应报告 claim 覆盖向量，例如 `F3 62% / F2 21% / F1 12% / F0 5%`，而不是用单个最低值掩盖差异。关键路径必须针对具体任务声明。

---

## 6. 强类型图、端口、模块与策略

结构边必须连接明确端口，而不是只连接两个框：

```text
sourceComponent + sourcePort
  -> edge(type, cardinality, schema, ordering, policyRefs)
  -> targetComponent + targetPort
```

端口至少声明方向、数据 Schema、单值或多值、同步或流式语义。编译器必须拒绝方向冲突、数据 Schema 不兼容、必需端口未连接和未经授权的权限扩张。

推荐边类型包括：

- `data.flow`：消息或结构化数据流；
- `control.invoke`：调用与控制关系；
- `capability.consume`：组件消费某项能力；
- `policy.enforce`：策略强制作用于对象或边；
- `artifact.produce`：组件产生可寻址产物；
- `evidence.support`：证据支持一条 claim 或评分。

`errorPropagation` 属于运行或诊断投影，不应与静态结构边混为同一事实。

可复用子图由 `ModuleDefinition` 表达。模块实例必须显式声明暴露端口、参数、内部版本与状态隔离方式。递归模块必须有深度、资源和终止约束。

---

## 7. RecipeDiff、审批、事务与漂移

一次修改必须首先成为 `RecipeDiff`，而不是直接覆盖文件。除格式、身份、创建时间和配方身份外，差分的核心字段是：

- `baseVersion` 与 `baseContentHash`：锁定修改前的配方版本和规范化内容摘要；
- `targetVersion` 与 `targetContentHash`：锁定预期修改后的版本和内容摘要；
- `preconditions`：声明事务级版本、摘要、路径存在性或路径值前置条件；
- `operations`：有序原子操作；每个操作包含自己的 `precondition`、`restartRequired`，并以 `operations[].compensation` 记录可执行的配置逆操作；
- `riskAssessments`：按受影响路径记录风险类别、严重度、缓解措施、残余风险和风险审批；
- `compensation`：记录事务恢复策略，以及 `externalSideEffects` 中每项外部副作用的补偿动作、验证、幂等性和责任人；
- `approval`：记录整个事务是否需要审批及其状态；它不能替代 `riskAssessments[].approval` 对具体风险的审批。

操作的配置逆操作、配置回滚、外部副作用补偿和真正不可逆操作是四个不同概念。`operations[].compensation` 只描述单个操作对 `AssemblyRecipe` 的逆操作；配置回滚按安全顺序执行这些逆操作并验证目标摘要；顶层 `compensation.externalSideEffects` 处理配方文档之外已经发生的效果；没有真实逆操作或可靠补偿的动作属于不可逆操作，不能用空操作伪装成可恢复。恢复旧配置不能撤销已经发送的邮件、已公开发布的内容或被外部系统删除的数据。

编译器必须确定、幂等，并在应用前验证前置版本与摘要。原子应用要么全部成功，要么保持原状；不支持原子的目标平台必须显式报告部分失败语义和恢复点。应用前后的导入结果应执行语义漂移检测。

不可逆操作必须默认拒绝。核心 Schema 不能把无补偿动作标为“安全可恢复”；部署扩展只有在策略明确允许、`riskAssessments` 单独披露风险、获得独立审批，并在审计记录中指出不可逆结果时才可以执行。

---

## 8. 运行事件、因果顺序与三类回放

`RuntimeEvent` 的信封至少包含：

```json
{
  "format": "wgp-runtime-event/0.4",
  "eventId": "44444444-4444-4444-8444-444444444444",
  "runId": "run.example-01",
  "sessionId": "session.example-01",
  "sequence": 12,
  "eventType": "tool.completed",
  "occurredAt": "2026-08-26T08:00:00Z",
  "observedAt": "2026-08-26T08:00:00.042Z",
  "producer": {"name": "adapter.dsh", "version": "0.4.0", "instanceId": "runtime.local-01"},
  "subject": {"abirId": "agent.example", "objectId": "component.tool.browser", "recipeId": "recipe.example"},
  "trace": {"traceId": "0123456789abcdef0123456789abcdef", "spanId": "0123456789abcdef"},
  "storageClass": "durable",
  "origin": "primary",
  "replayRole": "expectedOutcome",
  "payload": {},
  "redaction": {"state": "none", "removedFields": []}
}
```

事件的三个维度必须分开：

| 维度 | 取值 | 含义 |
|---|---|---|
| `storageClass` | `durable / ephemeral` | 是否进入持久记录，或仅在实时会话中存在 |
| `origin` | `primary / derived` | 是原始观测，还是由其他事件确定性派生 |
| `replayRole` | `input / expectedOutcome / verificationOnly / projectionOnly / excluded` | 在声明的回放中作为输入、预期结果、验证、界面投影或被排除 |

派生事件也可以持久化；ephemeral 事件也可能是原始观测。`tool.started` 若记录真实开始时间，就是 primary event，不能仅因它可被界面推断而标成 derived。

实现必须明确区分：

1. **View Replay（视图回放）**：只使用已记录事实重建界面；
2. **Simulation Replay（模拟回放）**：使用固定依赖或录制的模型流验证接口与路径；
3. **Re-execution（重新执行）**：重新调用真实组件，结果可能变化并产生新事件链。

事实性回放输入来自 `durable + primary` 事件或其受控加密引用；derived 层必须可由声明的确定性函数重算。事件处理还必须定义重复投递、乱序、迟到、时钟漂移、写盘失败和副作用执行前 checkpoint 的策略。

隐私要求优先于“保存所有明文”。系统可以保存输入清单、摘要和受访问控制的加密引用，但必须说明保留期、删除、密钥和租户隔离语义。

---

## 9. 可观测性与开放映射

WGP-ABF 不替代 OpenTelemetry。推荐把 `traceId / spanId` 与 OpenTelemetry trace 对齐，把 WGP 对象 ID、配方摘要和 evidence 引用作为语义属性。GenAI 语义约定仍在演进，适配器必须固定所采用的版本或 commit，不得只写“使用最新版本”。

遥测采集必须遵守：

- 原始事件命名空间与平台原生事件命名空间分离；
- 转换规则公开、版本化并能说明语义损失；
- 高敏字段默认脱敏，秘密值不得进入普通日志；
- 事件到结构对象是一对多或多对一时，必须保留明确引用，不能伪造一一对应；
- 评分和诊断只引用稳定 evidence ID，不复制易漂移的日志文本。

---

## 10. 评测设计、统计协议与贡献边界

WGP-ABF 同时记录两个正交维度：**评测单位**和**证据设计**。

### 10.1 评测单位

- `eval.component`：验证单个组件的接口、局部质量、成本与安全；
- `eval.assembly`：验证一个模块或子图中的交互；
- `eval.agent`：验证完整智能体的任务结果和用户体验。

每个组件可以同时拥有“独立性能分”和“当前装配贡献分”。两者不可互换。

### 10.2 证据设计

1. **Contract regression**：固定模型流或依赖，验证接口、事件和运行路径；
2. **Paired behavioral evaluation**：在相同任务和环境下配对真实采样，估计行为差异；
3. **Factorial or interaction evaluation**：存在多组件交互时使用因子设计，或明确不做单件贡献归因；
4. **Observational diagnosis**：用于发现相关性和提出假设，不得写成已验证根因。

固定模型流能降低模型输出变化，但不能让整个系统方差“接近零”，也不能单独证明某组件对最终质量的因果贡献。若修改改变了上下文、工具结果或调用 ID，旧流甚至可能不再有效。

### 10.3 最低统计记录

每份可比较 Scorecard 必须记录指标定义、样本独立单位、任务集版本、配对方式、重复次数、效应量、方差估计、置信区间算法、显著性水平、预设功效、最小可检测效应（MDE）、异常与缺失规则、停止规则、评价器版本和人工标注一致性。

安全、隐私和授权指标是不可由综合质量分抵消的门禁。跨平台行为分数可以比较，但组件级归因必须同时展示双方 claim 覆盖和证据强度。

---

## 11. 诊断假设、干预验证与改进决策

诊断报告不得直接把相关现象命名为 `rootCause`。它应使用：

- `suspectedCause`：由证据支持但尚未干预；
- `testedCause`：已执行预注册的干预；
- `validatedCause`：效应通过门槛且替代解释受到控制；
- `rejectedCause`：干预不支持原假设。

每条诊断必须引用 `componentId`、`edgeId` 或子图、症状事件、对照证据和不确定性。一次改动的决策只有四类：`promote`、`hold`、`reject`、`rollBack`。不得把“未发现显著下降”自动写成“已经改善”。

![图 4：证据化改进闭环](../assets/diagrams/wgp-abf-evolution-loop.png)

**图 4 — 证据化改进闭环。** “进化”在本文中指由人或治理策略控制的可复现改进流程，不表示系统可以未经授权自主改写自身。

---

## 12. 面向普通用户的渐进式体验

可视化不是把所有字段放到画布上。合格的产品界面应当提供三层体验：

### 12.1 目标层

用户选择“更安全地联网”“增加长期记忆”“更换模型”“降低成本”等目标。系统用自然语言解释预期变化、风险和是否需要重启。

### 12.2 图纸层

用户看到组件、关系和权限。安全的预设修改以向导完成；每次修改先显示语义差分、影响范围和恢复能力，再请求确认。

### 12.3 专家层

开发者可以展开端口 Schema、SourceClaim、原始事件、统计计划、编译诊断和平台配置。所有专家信息与新手视图引用相同对象 ID。

新手模式不得用动画隐藏真实等待，也不得把高风险操作包装成普通开关。错误信息必须说明失败对象、可采取的动作以及当前配置是否已改变。

---

## 13. 二维图纸、机体投影与无障碍

二维工程图纸是权威编辑表面，但规范记录仍是 ABIR 与配方。所有画布操作必须生成 `RecipeDiff`；不能回写的字段必须只读并说明原因。

机体、真人、二次元、像素或三维外观可以帮助普通用户理解，但只能存在于 `ProjectionProfile`。同一组件可以在不同主题中映射为不同视觉部位，不得反向改变组件类型。

投影至少应支持：

- 键盘完成选择、查看、差分和应用流程；
- 不依赖颜色区分风险或状态；
- 为节点、关系和图表提供文字替代；
- 支持缩放、减少动态效果和高对比度；
- 当 3D 无法使用时，所有功能仍能在二维或列表视图完成。

---

## 14. 威胁模型、供应链与数据治理

WGP-ABF 的安全边界必须由模型外部的策略执行器、操作系统、沙箱和服务端权限共同实现。隐藏 ABIR 不能替代安全控制。

符合核心规范的部署应覆盖以下威胁：

- 提示注入和间接提示注入；
- 恶意插件、依赖劫持和供应链替换；
- SSRF、跨站脚本和不受控网络访问；
- 秘密泄漏、日志泄漏和跨租户数据访问；
- 图纸、配方、事件或遥测被篡改与重放；
- 审批绕过、权限提升和不可逆外部副作用。

组件和配方应记录来源、许可证、摘要、签名或证明、SBOM 引用与撤销状态。智能体默认只能读取最小化、脱敏的 capability manifest；读取完整权限图必须经过独立权限、审计和租户隔离策略。

任何能够改变网络、文件、凭据、外部发布或计费的修改，都必须在差分中作为高风险能力单独显示。

---

## 15. DeepSeek Harness 版本化适配案例

本章只说明可复查的参考映射，不代表 DSH 的所有对象都天然达到 F3，也不代表 WGP-ABF 从属于 DSH。

本次核验锚点：

- 仓库：`pingta-guangpingwang/deepseek-harness`；
- 本地核验 commit：`0672d5ddfaf7d675d8e8bb37f69072bd98b5b0f7`；
- 最近标签及 commit 关系：本地核验 commit 位于 `dsh-v0.1.1-rc.2` 之后 1 个提交（`dsh-v0.1.1-rc.2-1-g0672d5ddf`）；
- 核验日期：2026-08-26。

DSH 的 `--dump-config`、生成的配置／工具／模块目录和持久 SessionEvent 目录，为声明配置与事件适配提供了较强基础。但配置行、服务注册、工具贡献和运行实体可能是一对多关系，必须逐对象或逐 claim 建立绑定。只有能从声明配置重建并通过适配器测试的字段才可标 F3 和 `roundTrip`。

DSH SessionEvent 与 Cordis 实时事件属于不同事件空间，映射必须保留命名空间。`assistant/chunk` 是流片段，不等于完整 `model.completed`；`turn/end` 也不一定等于整次 run 结束。热重载能力必须由组件声明 `reloadStrategy`、in-flight 行为和重启条件。

参考编译器可以将 ABIR 中可回写的配置子集编译为 profile patch；证据、布局、推断关系和诊断结果不应被错误写回平台配置。

---

## 16. 实施路线与验收标准

图 2 所示九阶段工作流按下列唯一里程碑表实施。其他文档应引用本表，不得维护第二套 P0–P5 定义：

| 阶段 | 交付物 | 验收条件 |
|---|---|---|
| P0 规范底座 | 核心 Schema、术语、合法与非法样例 | Schema 可执行；中英文对象名一致 |
| P1 导入与二维只读 | 至少一个版本化适配器、来源 claim、二维渲染 | 不支持项与语义损失可见 |
| P2 事件与回放 | 事件信封、View Replay（视图回放）、证据引用 | 乱序、重复、缺失与隐私策略通过测试 |
| P3 差分与回写 | RecipeDiff、dry-run、审批、编译、漂移检测 | 一次图纸修改可改变真实配置并可安全恢复 |
| P4 评测与诊断 | 三类评测、Scorecard、假设状态与决策 | 统计计划预注册；所有分数可追溯 |
| P5 可选投影与生态 | 机体／三维视图、兼容性套件、社区适配器 | 核心功能不依赖 3D；第三方实现可互操作 |

任何阶段都不得通过伪造 F3、丢弃不利运行、改变对照任务集或用综合分掩盖安全下降来满足验收。

---

## 17. 开放生态、治理与知识产权

WGP-ABF 由王广平在 2026 年提出并首先撰写。v0.4 采用双轨开放许可：

- 白皮书、README、治理文档与原创图表：**Creative Commons Attribution 4.0 International（CC BY 4.0）**；
- Schema、示例、构建脚本与参考代码：**Apache License 2.0**；
- WGP-ABF 名称、Logo 与未来可能的兼容／认证标记：不随上述许可授予，受 `TRADEMARKS.md` 约束。

开放许可不会转移原作者对原始作品的著作权；它向公众授予遵守条件的复制、修改和使用权限。著作权保护本文的文字、图表和具体表达，通常不等于对抽象思想、方法或操作流程本身的排他权。品牌保护、专利可申请性和司法辖区差异需要单独的专业法律意见。

规范语义变化应通过公开 RFC。每个破坏性变更必须同时更新 Schema、合法样例、非法样例、迁移说明和中英文版本。v1.0 之前如中英文出现无法调和的差异，以中文原始版本作为临时解释来源，并创建公开翻译问题；机器可验证语义以 Schema 和一致性测试为准。

规范仓库：[pingta-guangpingwang/wgp-agent-bodification-flow](https://github.com/pingta-guangpingwang/wgp-agent-bodification-flow)。规范缺陷、互操作问题、翻译差异和变更提案应提交到公开的 [Issues](https://github.com/pingta-guangpingwang/wgp-agent-bodification-flow/issues)，并引用受影响的格式兼容族、Schema `$id` 或不可变 Git 标签。

---

## 附录 A：最低可互操作对象

一份 Core Conformance 文档至少包含：

1. `AbirDocument`：规范版本、对象、端口、边、SourceClaim 与投影引用；
2. `AssemblyRecipe`：目标平台、期望配置、版本锚点与编译能力；
3. `RecipeDiff`：`baseVersion`、`baseContentHash`、`targetVersion`、`targetContentHash`、`preconditions`、`operations`、`riskAssessments`、`compensation` 与 `approval`；
4. `RuntimeEvent`：因果身份、三维事件语义、对象与产物引用；
5. `EvaluationRun`：任务集、环境、对照、指标、统计计划和证据。

本仓库 `spec/` 提供 JSON Schema，`examples/minimal-agent/` 提供最小闭环样例。Schema 与本文冲突时，应创建规范 Issue，不能静默选择其中一方。

## 附录 B：Claim 成熟度

| 等级 | 可用措辞 | 不可用措辞 |
|---|---|---|
| Observation | “与失败共同出现”“建议调查” | “导致失败” |
| Regression | “接口路径保持／破坏” | “提升最终智能体质量” |
| Controlled comparison | “在这些任务与条件下平均差异为…” | “普遍提升” |
| Validated causal claim | “在预注册干预及替代解释控制下支持…” | “完美归因” |

## 附录 C：规范发布检查项

每次版本化发布必须记录以下规范检查结果；任何未通过项必须在 Release 说明中列为已知限制，不能以沉默或未完成待办代替：

1. 中英文标题、章节号、图号、Replay 名称和术语表一致；
2. Schema 接受全部合法样例，并拒绝版本化的代表性非法样例；
3. 所有图具有来源、提示词或可编辑源、内容摘要与许可记录；
4. PDF 的字体、链接、分页、图注和文字提取通过发布检查；
5. 仓库秘密扫描和素材审查确认不含密钥、个人隐私或无权公开的第三方素材；
6. DSH 等外部适配案例记录不可变 commit、最近标签关系与核验日期；
7. Release 产物提供 SHA-256，并可追溯到不可变 Git 标签；
8. Public Draft 状态、许可范围、商标边界、规范仓库和 Issues 入口在仓库首页可见。

## 参考资料

1. Creative Commons, [Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)，访问日期 2026-08-26。
2. Apache Software Foundation, [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0)，访问日期 2026-08-26。
3. IETF, [RFC 8785: JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)，2020。
4. OpenTelemetry, [Semantic Conventions for Generative AI Systems](https://github.com/open-telemetry/semantic-conventions-genai/tree/56d6b11a02129319bf371083fa134b7ce989c976)，固定 commit `56d6b11a02129319bf371083fa134b7ce989c976`，访问日期 2026-08-26；该仓库当时仍处于演进阶段。
5. Semantic Versioning, [Semantic Versioning 2.0.0](https://semver.org/)，访问日期 2026-08-26。
6. WIPO, [Copyright](https://www.wipo.int/en/web/copyright/)，访问日期 2026-08-26。
7. DeepSeek Harness, [项目仓库](https://github.com/pingta-guangpingwang/deepseek-harness)，本章核验 commit 见第 15 节。

---

## 修订说明

v0.4 在保留 v0.3 原始愿景的同时完成了以下关键修正：把 ABIR 中的 `Body` 改为 `Blueprint`；明确 ABIR 与 `AssemblyRecipe` 是规范结构记录、二维图纸是权威编辑投影；把 `structuralProvenance` 与可组合的字段级 `operationCapabilities` 分开；把事件的存储、来源和回放角色拆成三个维度；把固定模型流降级为契约回归工具；补充统计、逆操作、外部副作用补偿、漂移、安全、供应链、无障碍和双语治理要求；统一实施路线和合规档位。

v0.3 原稿完整保存在 `archive/v0.3/`，用于创作演进和出处追溯。
