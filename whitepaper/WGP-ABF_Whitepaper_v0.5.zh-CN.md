<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# WGP 智能体机体化流程（WGP-ABF）

## 智能体工程图纸、标准件装配面与证据化演进框架

**版本 0.5 — 中英双语图解公开草案**

**概念提出者与主要作者：王广平（Wang Guangping）**

**发布日期：2026 年 8 月 27 日**

**状态：Public Draft；不是行业标准，也不是认证计划**

![WGP-ABF 封面主视觉：从二维工程图纸到模块化智能体装配体](../assets/images/wgp-abf-cover-art-v0.4.png)

> WGP-ABF 让智能体配置成为可视、可差分、可测试、可改装、可验证的一等工程产物。

在 WGP-ABF 中，**机体化（Bodification）**是一个项目专用词：它指把智能体配置转化为有类型、有版本、可观测、可测试的工程装配体。它不表示物理具身、人格化或生物学建模。结构规范使用 `Component`、`Edge`、`Container` 和 `AssemblyRecipe`；“机体”只用于面向人的可选视觉投影。

> **核心命题：百花齐放解决创新，标准件解决组合。WGP-ABF 不统一标准件内部实现，只标准化装配面。**

---

## 摘要

现代智能体由模型、工具、记忆、沙箱、权限、审批、子智能体、运行时和外部服务共同组成。生成式编程正在降低实现成本，但长期需要维护的工程资产已经从源代码延伸到装配配方、评测集、证据、标准件包和治理策略。智能体配置与实现生态却普遍缺少源代码已有的语义差分、评审、测试、归因、互换和回退机制。

WGP-ABF 提出一种平台中立的智能体配置工程方法，把配置转换为可拆解、可编辑、可运行、可评测和可诊断的工程产物。它定义三份协议与一条图纸纪律：结构协议以 WGP-ABIR 和 `AssemblyRecipe` 表达规范结构；运行协议以带存储、来源和回放角色的事件表达过程；证据协议以分层评测、统计条件和诊断报告约束改进主张；二维工程图纸则成为 ABIR 面向人的权威编辑投影。机体和三维视图仅是可选的只读解释投影。

v0.5 在结构协议中加入**标准装配面**。实现者继续自由选择模型、算法、语言、框架和内部架构；需要互操作的部分则通过 `StandardPartDescriptor`、`StandardPartPackage`、`CompatibilityProfile`、`InterchangeabilityAssessment`、`ConformanceSuite`、`ConformanceReport`、`EvidenceStatusRecord`、`PartRegistry` 与 `ReplacementPlan` 公开。标准件可映射 ABIR 的 `Component`、`Resource`、`Policy`、`Artifact`、`Interface` 或 `Container`，不得把模型、提示词或资源为了上架而伪装成可执行组件。I0–I4 互换等级由一次有时效的定向评估记录，说明一对标准件在固定版本、内容摘要、目标环境、策略和证据有效期下能够被替换到什么程度，且与描述结构来源的 F3–F0 完全正交。这样，创新可以百花齐放，组合仍能获得可检查的接口、配置、状态、生命周期和回退条件。

WGP-ABF 的核心价值不是减少配置输入，而是提升理解、组合和归因能力：揭示一份配置实际装配了什么，从开放注册表发现候选标准件，把一次替换形成 `ReplacementPlan` 与可审查的 `RecipeDiff`，并在相同任务集与受控环境下验证改动是否带来改善。符合核心规范的实现必须标注结构来源，独立声明操作能力并提供互换证据，区分事件的三个维度，让每个分数可追溯到原始证据，并证明图纸修改能够改变实际运行。DeepSeek Harness（DSH）是首个版本化参考适配案例，但不是该方法的概念边界。

![图 1：WGP-ABF 系统地图](../assets/diagrams/wgp-abf-system-map.png)

**图 1 — 系统地图。** WGP-ABIR 与 `AssemblyRecipe` 是规范、可版本化的结构记录；二维图纸是它们面向人的权威编辑投影；标准件对象描述可组合的装配面。所有视图和市场条目必须引用同一模型，不得暗中维护第二份业务结构。

---

## 1. 愿景、目标用户与非目标

### 1.1 愿景

让普通用户能像查看装配图一样理解智能体，让开发者能像评审代码一样评审配置，让标准件作者在保留内部创新自由的同时发布可组合装配面，让团队能像做受控实验一样验证每次替换。

WGP-ABF 希望建立一条连续工作流：

1. 从真实平台导入配置并说明每项信息来自哪里；
2. 用二维工程图纸呈现组件、接口、关系、权限和容器；
3. 通过标准描述符与注册表发现可组合标准件，但不要求其内部实现相同；
4. 计算目标环境中的互换等级并生成 `ReplacementPlan`；
5. 把修改表达为可读、可审查、可应用的 `RecipeDiff`；
6. 编译到目标平台、执行一致性套件并检测漂移；
7. 在可重复条件下采集运行证据，形成有边界的结论，升级、保留实验或回退。

### 1.2 目标用户

- 想看懂、修改或组合智能体的普通用户；
- 构建 Agent Studio、运维平台和可视化编辑器的产品团队；
- 发布标准件、适配器、测试套件或注册表的开源作者与厂商；
- 需要审计权限、供应链、插件与数据流的安全和治理人员；
- 研究智能体评测、诊断和组件交互的工程师；
- 希望建立开放标准件市场而不锁定内部技术路线的社区。

### 1.3 非目标

WGP-ABF 不承诺统一所有平台的执行语义，不统一标准件内部算法、语言或框架，不把人形外观当作结构真相，不以隐藏架构替代安全控制，不声称一次 A/B 就能完成因果归因，也不把任何单一模型、注册表或厂商定义为唯一实现。标准件不表示所有实现趋同；它只表示声明的装配面能够被机器检查。

---

## 2. 问题边界与设计原则

### 2.1 需要解决的八个问题

1. **不可见**：用户只能看到 YAML、JSON 或表单，看不到完整装配体。
2. **不可比**：相同概念在不同平台上缺少共同的结构语义。
3. **不可审查**：文本 diff 无法稳定表达“换了哪个组件、影响哪条路径”。
4. **不可回写**：很多可视化只读，修改不能安全落回真实运行配置。
5. **不可重放**：事件不完整或存续语义不清，界面重放与真实重执行混为一谈。
6. **不可归因**：分数存在，但分数、原始证据与结构对象之间没有引用链。
7. **不可治理**：插件来源、权限、审批、补偿和版本漂移缺少统一记录。
8. **不可流通**：优秀标准件缺少可移植描述符、内容寻址包、兼容性档案、可执行一致性测试和可信注册记录，因而无法形成开放、可验证的标准件市场。

### 2.2 七条设计原则

- **真实优先**：每条结构 claim 都必须说明来源和覆盖度。
- **一个模型，多种投影**：机器规范记录、二维编辑图纸和三维展示不复制业务事实。
- **权限与来源分离**：F3–F0 不自动授予查看、编辑、编译或回写能力。
- **创新与装配分离**：内部实现保持开放竞争，只对跨边界的端口、配置、状态、要求和生命周期进行标准化。
- **声明与状态分离**：配方描述期望配置；运行事件描述实际过程。
- **证据先于升级**：修改只有通过预先声明的门槛，才能进入稳定版本。
- **渐进式复杂度**：新手先完成安全的目标，专家再展开字段、互换等级、统计和治理细节。

### 2.3 标准件贯穿九阶段流程

标准装配面不是流程之外的市场插件，而是图 2 九阶段中的可验证对象：

1. **导入**：收集 ABIR、`SourceClaim` 与已有标准件包身份；
2. **模块显形**：识别可替换边界和仍需封装的内部子图；
3. **标准件显形**：生成或读取 `StandardPartDescriptor`，并映射到 ABIR 六类对象之一；
4. **关系显形**：把端口、协议、Schema、权限和生命周期要求变成装配面；
5. **图纸生成**：在同一 ABIR 上显示当前件、候选件与 `InterchangeabilityAssessment` 中 I0–I4 证据范围；
6. **装配改装**：查询 `PartRegistry`，选择 `CompatibilityProfile`，重新计算 `InterchangeabilityAssessment` 并生成 `ReplacementPlan`；
7. **差分审查**：把替换计划编译为 `RecipeDiff`，展示权限、状态迁移、风险与补偿；
8. **编译运行**：解析固定摘要的 `StandardPartPackage`，执行 `ConformanceSuite`、产生 `ConformanceReport`，核验生命周期计划；
9. **评测诊断**：在真实任务集上复测，发布有范围和有效期的证据，或执行回退。

![图 2：从导入到证据化复测的九阶段工作流](../assets/diagrams/wgp-abf-nine-stage-flow.png)

**图 2 — 九阶段工作流。** 每一阶段都留下可审查产物；最后的门槛不是“标准件能安装”或“成功启动”，而是修改真实改变运行并得到同条件证据支持，或在不满足门槛时触发回退。

---

## 3. 规范语言、版本与合规档位

本文中的“必须／不得／应当／可以”分别对应 RFC 风格的 `MUST / MUST NOT / SHOULD / MAY`。只有显式使用这些词的句子构成规范性要求，其余内容用于解释和指导。

### 3.1 版本

- `specVersion`：WGP-ABF 机器规范的语义版本；
- `schemaVersion`：单个 JSON Schema 的语义版本；
- `recipeVersion`：某份装配配方的单调版本；
- `descriptorVersion`：标准件描述符所采用的描述格式版本；
- `definitionVersion`：标准件定义版本；
- `adapterVersion`：平台适配器版本。

本白皮书的 **0.5** 是面向读者的版本系列简称；npm 包、验证器和机器规范发布使用 SemVer **0.5.0**。`wgp-abir/0.5`、`wgp-standard-part-descriptor/0.5`、`wgp-recipe-diff/0.5`、`wgp-runtime-event/0.5` 一类 `format` 值表示 **0.5 格式兼容族**，不是 npm 包版本；同一兼容族的补丁发布必须继续接受已有合法文档，只有破坏兼容性时才能进入新的格式族。不可变 Git 标签 **`v0.5.0`** 固定该次发布的 Schema、样例和构建产物，Schema `$id` 必须引用这一标签，而不得引用可移动分支。

`0.y.z` 表示公开草案。破坏性字段或语义修改必须提高次版本，补丁版不得改变既有合法文档的含义。白皮书 0.5、包／规范版本 0.5.0、格式兼容族 `/0.5` 与 Git 标签 `v0.5.0` 指向同一首发语义基线，但分别服务于文档标识、工具分发、文档兼容判断和不可变发布定位，不得互相替代。

### 3.2 分级核心合规与可选投影合规

| 等级 | 名称 | 最低要求 |
|---|---|---|
| C0 | 可视化说明器 | 明确标注为非合规的教学或展示原型，不得声称运行保真度 |
| C1 | 图纸合规 | 合法 ABIR + AssemblyRecipe、强类型边、逐对象来源、唯一规范记录、可导出表示 |
| C2 | 操作合规 | C1 + 字段级能力、语义差分、风险审查、原生编译、运行绑定核验和回退纪律 |
| C3 | 证据合规 | C2 + 事件三轴、安全回放、评测不确定性、claim 成熟度、对象诊断和可比复测 |

实现必须公开验证器版本、支持的 Schema 与适配器版本、例外和其合规声明的证据。精美的机体、标准件市场或三维视图不会提高核心合规等级。

**Projection Conformance** 是独立的可选标签。实现如提供二维、机体或三维投影，则必须证明投影由规范记录生成，编辑只发生在声明为可回写的二维字段上，并提供键盘操作、文字替代和非颜色编码。没有机体或三维投影不影响 C1–C3。

标准件的 I0–I4 互换结论也不等于实现的 C0–C3 合规等级。前者描述一对候选件在特定目标中的替换证据，后者描述整套 WGP-ABF 实现覆盖了哪些规范责任。

---

## 4. 规范模型：ABIR、配方、证据与投影

WGP-ABF 的唯一规范结构事实由 **WGP Agent Blueprint Intermediate Representation（WGP-ABIR）** 与 **`AssemblyRecipe`** 共同构成：

- **WGP-ABIR** 表达对象、端口、关系、来源 claim 和可用能力；
- **AssemblyRecipe** 表达可编译的期望配置、版本锚点与目标平台；
- **Evidence Store** 保存事件、任务结果、产物引用、互换验证和评测结果；
- **ProjectionProfile** 保存布局、主题、机体映射和无障碍说明。

标准件对象不建立第二份结构事实。`StandardPartDescriptor` 以 `partKind` 映射 ABIR 六类对象之一，引用 ABIR 端口并发布装配面；`StandardPartPackage` 绑定内容寻址的实现产物；`CompatibilityProfile` 定义稳定规则与环境要求，`InterchangeabilityAssessment` 记录一次定向、有时效的成对结论；`ConformanceSuite` 和 `ConformanceReport` 分别表示“如何验”和“验到了什么”；`ReplacementPlan` 表示“如何换”；`PartRegistry` 只索引带不可变摘要的版本化对象。可执行 `partKind: component` 可以提供更窄的工具视图，但不得引入另一个描述符根 Schema。

`AssemblyRecipe.standardPartBindings[]` 选择 exact `descriptorRef` 与 `packageRef`，并记录 `partKind`、`targetObjectId`、配置和 `surfaceMappings`。每个 surface mapping 通过 `partPortId → targetPortId` 连接标准件端口与 ABIR 目标端口。Binding 只选择与映射规范对象，不得重复维护第二份对象或端口事实。

`ProjectionProfile` 不得成为 `Component` 的必填字段。`arm.browser` 一类视觉名称不得进入核心类型系统。布局变化、市场排序和推荐结果不得造成配方语义变化。

### 4.1 核心对象类别

| 类别 | 用途 | 示例 |
|---|---|---|
| `Component` | 可替换、可配置、可独立观测的运行单元 | 模型提供器、记忆检索器、工具执行器 |
| `Resource` | 被组件读取或写入的数据与能力资源 | 向量库、文件系统、模型凭据引用 |
| `Policy` | 在模型外强制执行的约束 | 网络策略、审批规则、预算上限 |
| `Artifact` | 可寻址的运行、标准件包或评测产物 | 包、补丁、报告、截图、日志片段 |
| `Interface` | 端口、协议或服务定义 | Chat completion、tool call、RPC |
| `Container` | 对对象进行唯一包含的层级 | 子智能体模块、工具组 |

消息、提示词、任务定义和策略不应为了画图或上架方便而全部伪装成 `Component`。

### 4.2 规范化与身份

符合规范的实现必须为对象提供稳定、带命名空间的 ID。用于哈希、签名和缓存的 JSON 应使用确定性规范化；推荐 RFC 8785 JSON Canonicalization Scheme。包含关系必须只有一个权威表示，不能同时由 `Container.contains` 和重复 containment edge 维护。

跨配方、描述符、标准件包和注册表引用必须同时固定版本与内容摘要。无法解析、摘要不匹配、出现循环但未声明递归模块、或 ID 冲突时，导入必须失败并给出可定位诊断。注册表显示名和下载量不得替代内容身份。

带根 `contentHash` 或 `recordHash` 的 JSON 文档必须使用无递归自摘要规则：先移除待计算的根摘要字段，再按 RFC 8785 规范化剩余文档，最后对规范化 UTF-8 字节执行 SHA-256。exact ref 使用该结果；不得对占位值求摘要，也不得把字段自身递归纳入输入。

---

## 5. 结构来源：保真度不是权限或互换等级

F3–F0 作为清晰的界面徽标继续保留，但 `structuralProvenance` 只表示某条 claim 的结构来源，不表示信任结论，不授予任何操作权限，也不表示标准件可互换：

- **F3 Native（原生）**：来自目标平台原生、可定位的权威结构表示；
- **F2 Exported（导出）**：来自平台或版本化适配器的可重复结构导出；
- **F1 Inferred（推断）**：由静态分析、运行观测或其他证据推断；
- **F0 Manual（人工）**：由人工直接声明，尚未获得更高等级的结构来源证据。

除通用 claim 标识 `id` 外，每条 `SourceClaim` 必须包含：`subjectId`、`fieldScope`、`structuralProvenance`、`identityAssurance`、`fieldCoverage`、`runtimeEvidence`、`operationCapabilities`、`trustState`、`method` 与 `observedAt`。`fieldScope` 是该 claim 覆盖的 JSON Pointer 集合；身份稳定性、字段覆盖、运行证据和信任状态必须分别记录，不能由 F 等级代替。`adapter`、`evidenceRefs` 与 `expiresAt` 为可选字段；存在失效期限时，过期 claim 不得继续作为当前证据使用。

![图 3：结构来源与操作能力分离](../assets/diagrams/wgp-abf-fidelity-matrix.png)

**图 3 — 来源与权限分离。** F3 Native（原生）不代表可编辑或可互换，F2 Exported（导出）也不代表“受限可编辑”。操作能力必须由适配器和字段级证明独立声明；I0–I4 则由第 12 章的成对兼容证据决定。

### 5.1 操作能力

`operationCapabilities` 是 `SourceClaim` 针对 `fieldScope` 所覆盖字段给出的可组合能力集合，可以同时包含：

- `view`：能够稳定显示；
- `edit`：允许生成合法修改；
- `compile`：能编译为目标平台配置；
- `roundTrip`：导出、修改、回写后能保持声明的语义；
- `hotReload`：在声明的运行阶段内无需整体重启；
- `replace`：支持原子替换并保留接口约束。

这些值说明适配器已证明的技术能力，不等同于当前用户授权、部署策略、审批结果或 I 级别；执行操作时仍必须同时满足这些约束。能力不能从 `structuralProvenance`、`trustState`、注册表排名或单一运行观测推导。整机界面应报告 claim 覆盖向量，例如 `F3 62% / F2 21% / F1 12% / F0 5%`，而不是用单个最低值掩盖差异。关键路径必须针对具体任务声明。

---

## 6. 强类型图、端口、模块与标准装配面

结构边必须连接明确端口，而不是只连接两个框：

```text
sourceComponent + sourcePort
  -> edge(type, cardinality, schema, ordering, policyRefs)
  -> targetComponent + targetPort
```

端口至少声明方向、数据 Schema、单值或多值、同步或流式语义。编译器必须拒绝方向冲突、数据 Schema 不兼容、必需端口未连接和未经授权的权限扩张。

推荐语义关系标签包括：

- `data.flow`：消息或结构化数据流；
- `control.invoke`：调用与控制关系；
- `capability.consume`：组件消费某项能力；
- `policy.enforce`：策略强制作用于对象或边；
- `artifact.produce`：组件产生可寻址产物；
- `evidence.support`：证据支持一条 claim 或评分。

这些 profile 级标签必须显式映射到 ABIR Schema 允许的核心 `edgeKind`，不能隐式扩展枚举。`errorPropagation` 属于运行或诊断投影，不应与静态结构边混为同一事实。

**标准装配面**由对外端口、协议与 Schema、配置契约、能力与依赖、权限要求、状态与迁移、安装／替换／回退／卸载生命周期共同组成。标准化这些边界不限制标准件内部使用何种算法、框架、模型或许可证。只有跨边界可检查的信息进入描述符，私有实现细节保持私有。

可复用子图由 `ModuleDefinition` 表达。模块实例必须显式声明暴露端口、参数、内部版本与状态隔离方式。递归模块必须有深度、资源和终止约束。

---

## 7. RecipeDiff、ReplacementPlan、审批、事务与漂移

一次修改必须首先成为 `ReplacementPlan` 或其他可审查提案，再编译为 `RecipeDiff`；它不得直接覆盖文件或执行注册表推荐。`ReplacementPlan` 描述替换双方、要求的 I 级别、配置转换、状态迁移、权限差分、执行步骤、验证向量、回退、审批和证据引用。只有计划中的前置条件与证据仍然有效时，才能生成可应用差分。

除格式、身份、创建时间和配方身份外，`RecipeDiff` 的核心字段是：

- `baseVersion` 与 `baseContentHash`：锁定修改前的配方版本和规范化内容摘要；
- `targetVersion` 与 `targetContentHash`：锁定预期修改后的版本和内容摘要；
- `preconditions`：声明事务级版本、摘要、路径存在性或路径值前置条件；
- `operations`：有序原子操作；每个操作包含自己的 `precondition`、`restartRequired`，并以 `operations[].compensation` 记录可执行的配置逆操作；
- `riskAssessments`：按受影响路径记录风险类别、严重度、缓解措施、残余风险和风险审批；
- `compensation`：记录事务恢复策略，以及 `externalSideEffects` 中每项外部副作用的补偿动作、验证、幂等性和责任人；
- `approval`：记录整个事务是否需要审批及其状态；它不能替代 `riskAssessments[].approval` 对具体风险的审批。

操作的配置逆操作、配置回滚、外部副作用补偿和真正不可逆操作是四个不同概念。`operations[].compensation` 只描述单个操作对 `AssemblyRecipe` 的逆操作；配置回滚按安全顺序执行这些逆操作并验证目标摘要；顶层 `compensation.externalSideEffects` 处理配方文档之外已经发生的效果；没有真实逆操作或可靠补偿的动作属于不可逆操作，不能用空操作伪装成可恢复。

编译器必须确定、幂等，并在应用前验证前置版本、标准件包摘要与配方摘要。原子应用要么全部成功，要么保持原状；不支持原子的目标平台必须显式报告部分失败语义和恢复点。应用前后的导入结果应执行语义漂移检测。

不可逆操作必须默认拒绝。当前核心 Schema 不能把没有真实补偿的动作声明为“安全可恢复”；部署扩展只有在策略明确允许、`riskAssessments` 单独展示风险、获得独立审批并留下审计记录时才可以执行，而且必须明确说明无法回滚的外部结果。

---

## 8. 运行事件、因果顺序与三类回放

`RuntimeEvent` 的信封至少包含：

```json
{
  "format": "wgp-runtime-event/0.5",
  "eventId": "44444444-4444-4444-8444-444444444444",
  "runId": "run.example-01",
  "sessionId": "session.example-01",
  "sequence": 12,
  "eventType": "tool.completed",
  "occurredAt": "2026-08-27T08:00:00Z",
  "observedAt": "2026-08-27T08:00:00.042Z",
  "producer": {"name": "adapter.dsh", "version": "0.5.0", "instanceId": "runtime.local-01"},
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

派生事件也可以持久化；ephemeral 事件也可能是原始观测。`tool.started` 若记录真实开始时间，就是 primary event，不能仅因它可被界面推断而标成 derived。标准件替换、迁移、验证与回退必须产生引用 `ReplacementPlan`、描述符版本和包摘要的事件，以便重建实际使用的标准件身份。

实现必须明确区分：

1. **View Replay（视图回放）**：只使用已记录事实重建界面；
2. **Simulation Replay（模拟回放）**：使用固定依赖或录制的模型流验证接口与路径；
3. **Re-execution（重新执行）**：重新调用真实组件，结果可能变化并产生新事件链。

事实性回放输入来自 `durable + primary` 事件或其受控加密引用；derived 层必须可由声明的确定性函数重算，并在形成派生事件时使用 `derivation.sourceEventIds`。事件处理还必须定义重复投递、乱序、迟到、时钟漂移、写盘失败和副作用执行前 checkpoint 的策略。

隐私要求优先于“保存所有明文”。系统可以保存输入清单、摘要和受访问控制的加密引用，但必须说明保留期、删除、密钥和租户隔离语义。

---

## 9. 可观测性与开放映射

WGP-ABF 不替代 OpenTelemetry。推荐把 `traceId / spanId` 与 OpenTelemetry trace 对齐，把 WGP 对象 ID、配方摘要、标准件包摘要、替换计划和 evidence 引用作为语义属性。GenAI 语义约定仍在演进，适配器必须固定所采用的版本或 commit，不得只写“使用最新版本”。

遥测采集必须遵守：

- 原始事件命名空间与平台原生事件命名空间分离；
- 转换规则公开、版本化并能说明语义损失；
- 高敏字段默认脱敏，秘密值不得进入普通日志；
- 事件到结构对象或标准件身份是一对多或多对一时，必须保留明确引用，不能伪造一一对应；
- 评分、互换证据和诊断只引用稳定 evidence ID，不复制易漂移的日志文本。

---

## 10. 评测设计、统计协议与贡献边界

WGP-ABF 同时记录两个正交维度：**评测单位**和**证据设计**。

### 10.1 评测单位

- `eval.component`：验证单个组件的接口、局部质量、成本与安全；
- `eval.assembly`：验证一个模块或子图中的交互；
- `eval.agent`：验证完整智能体的任务结果和用户体验。

每个标准件可以同时拥有“独立性能分”和“当前装配贡献分”。两者不可互换。I1 只表明适配器已封装标准装配面，I2 才表明接口合规，I3 记录限定环境中的行为验证；三者均不代表结果质量更高。I4 证明限定范围内的迁移、验收与回退证据闭合，也不自动证明任务表现改善。

### 10.2 证据设计

1. **Contract regression**：固定模型流或依赖，验证接口、事件和运行路径；
2. **Paired behavioral evaluation**：在相同任务和环境下配对真实采样，估计行为差异；
3. **Factorial or interaction evaluation**：存在多组件交互时使用因子设计，或明确不做单件贡献归因；
4. **Observational diagnosis**：用于发现相关性和提出假设，不得写成已验证根因。

`ConformanceSuite` 属于契约与生命周期证据；`EvaluationRun` 属于任务结果证据。固定模型流能降低模型输出变化，但不能让整个系统方差“接近零”，也不能单独证明某标准件对最终质量的因果贡献。若修改改变了上下文、工具结果或调用 ID，旧流甚至可能不再有效。

### 10.3 最低统计记录

每份可比较 Scorecard 必须记录指标定义、样本独立单位、任务集版本、配对方式、重复次数、效应量、方差估计、置信区间算法、显著性水平、预设功效、最小可检测效应（MDE）、异常与缺失规则、停止规则、评价器版本和人工标注一致性。

安全、隐私和授权指标是不可由综合质量分抵消的门禁。跨平台行为分数可以比较，但标准件级归因必须同时展示双方 claim 覆盖、互换档案和证据强度。

---

## 11. 诊断假设、干预验证与改进决策

诊断报告不得直接把相关现象命名为 `rootCause`。它应使用：

- `suspectedCause`：由证据支持但尚未干预；
- `testedCause`：已执行预注册的干预；
- `validatedCause`：效应通过门槛且替代解释受到控制；
- `rejectedCause`：干预不支持原假设。

每条诊断必须引用 `partId`、`componentId`、`edgeId` 或子图、症状事件、对照证据和不确定性。诊断可以查询 `PartRegistry` 提出候选件，但推荐排序不得被写成根因或升级结论。一次改动的决策只有四类：`promote`、`hold`、`reject`、`rollBack`。不得把“未发现显著下降”自动写成“已经改善”。

![图 4：证据化改进闭环](../assets/diagrams/wgp-abf-evolution-loop.png)

**图 4 — 证据化改进闭环。** “进化”在本文中指由人或治理策略控制的可复现改进流程。诊断产生 `ReplacementPlan`，计划经标准装配面、差分、验证和真实任务评测后，才能升级或回退；系统不得未经授权自主改写自身。

---

## 12. 标准件装配面、互换等级与开放市场

本章把“标准件”限定为**装配面的标准化**。一个 ABIR 对象可以有完全不同的内部代码、模型、数据结构或商业模式，只要它公开可验证的装配面，并在声明范围内通过相应测试，就可以参与组合。标准件不是统一实现，也不是中心注册表的批准徽章。

### 12.1 九类标准件协议对象

| 对象 | 责任 | 关键内容 |
|---|---|---|
| `StandardPartDescriptor` | 描述一个版本化标准件如何识别、映射 ABIR、连接、配置和管理 | identity、assembly、configuration、capabilities、requirements、state、package/profile/suite exact refs 与 lifecycle |
| `StandardPartPackage` | 提供由描述符 `packageRef` 选择的不可变实现产物，且不反向引用描述符 | package identity、exact artifact ref、locator、media type、来源、SBOM、许可证与签名 |
| `CompatibilityProfile` | 定义可复用的目标类型、环境、装配面与替换规则 | runtime constraints、required surfaces、依赖／权限／状态／配置策略、允许模式与 required suite refs |
| `InterchangeabilityAssessment` | 记录一次 `source → target` 在固定 profile 和环境中的有时效结论 | exact source/target/profile/environment refs、`assessedLevel`、`levelEvidence`、`assessedAt`、`expiresAt` 与可选 plan ref |
| `ConformanceSuite` | 定义可执行正例、反例、协议和生命周期测试 | suite identity、内容摘要、specification version、test vectors 与预期结果 |
| `ConformanceReport` | 记录一次套件执行的环境、结果和可核验证据 | suite/part/profile/environment exact refs、content hash、executedAt、executor、results、summary 与 expiresAt |
| `EvidenceStatusRecord` | 以外部只追加记录决定一份不可变报告当前能否作为证据 | status record identity、exact report ref、连续 revision、record/previous hash、action、recordedAt 与 reason |
| `PartRegistry` | 以只追加记录索引描述符、摘要、发布、撤销与墓碑 | registry identity、revision、record/previous hash、action、status、recordedAt、part exact ref、reason |
| `ReplacementPlan` | 把候选件变成可审查、可执行、可验收、可回退的替换方案 | 双方 exact refs、profile ref、replacement mode、recipe precondition、风险、适配器能力、迁移／验收／回退报告、失败策略与步骤 |

`StandardPartDescriptor` 使用 `format: wgp-standard-part-descriptor/0.5` 和 `descriptorVersion: 0.5.0`。其根字段为 `format`、`descriptorVersion`、`contentHash`、`createdAt`、`identity`、`assembly`、`configuration`、`capabilities`、`requirements`、`state`、`packageRef`、`compatibilityProfileRefs`、`conformanceSuiteRefs` 与 `lifecycle`，可选 `extensions`。`identity` 必须包含 `partId`、`name`、`version`、`partKind`、`publisher` 和 `releaseChannel`；`partKind` 只能为 `component | resource | policy | artifact | interface | container`，分别映射 ABIR 六类对象。所有跨文档引用必须同时固定版本与内容摘要；标准件引用的精确形式为 `{partId, version, contentHash}`。装配端口必须引用 ABIR，不得另造一套端口事实。

Descriptor 只能引用预先定义且不反向 exact 引用它的 Package、Profile 和 Suite。后置 `ConformanceReport`、`InterchangeabilityAssessment` 和 `ReplacementPlan` 必须以 exact part ref 指向已不可变的 Descriptor，并由 `PartRegistry` 或查询索引反向发现。Descriptor 和 `lifecycle` 不得反向引用这三类后置文档，以避免不可计算的双向哈希环。

`StandardPartPackage` 以 `artifactRef: {artifactId, version, contentHash}`、`locator` 和 `mediaType` 固定实现产物，并记录 `supplyChain`、`license` 和 `signature`。签名只证明指定签名者对指定摘要的声明，不自动证明代码安全、许可证正确或适合当前任务。

`ConformanceSuite` 只定义规范版本、内容摘要、必选或可选测试向量和预期结果；`ConformanceReport` 才是已在固定标准件、Profile、执行器和环境中运行后的不可变证据，并记录失效时间。套件不能自证已通过；报告通过也只证明其声明契约，不证明普遍任务质量。撤回必须由外部、只追加的 `EvidenceStatusRecord` 以 exact ref 指向报告后生效；不得回写或重新哈希已发布的报告。

`CompatibilityProfile` 本身不存储 I 级别。`InterchangeabilityAssessment` 必须固定 `assessmentId`、`version`、`contentHash`、`sourcePart`、`targetPart`、`profileRef`、`environmentRef`、`assessedLevel`、`levelEvidence`、`assessedAt` 与 `expiresAt`；I4 还必须有 exact `replacementPlanRef`。改变方向、Profile、环境、版本、摘要或证据时窗时，旧 Assessment 必须失效并重新计算。

### 12.2 I0–I4 互换等级

I 等级存储在 `InterchangeabilityAssessment.assessedLevel` 中，是 `A → B` 在一个固定 `CompatibilityProfile`、目标运行环境、策略、版本与摘要、证据时间范围内的**成对结论**，不是 Profile 自身或标准件永久固有的徽章。`levelEvidence` 是累计证据：每个等级必须同时满足全部低级门槛，机器只能推导所有必需证据均完整、有效时的最高等级。Assessment 不得自报超过这一机器推导上限。

一份 `ConformanceReport` 只有在 exact part/Profile/Suite/environment 引用匹配、所有必选向量通过、未超过 `expiresAt`，且不存在更晚的 `EvidenceStatusRecord` 将其撤回或墓碑化时，才是 `levelEvidence` 可采信的证据：

| 等级 | 名称 | 已证明什么 | 没有证明什么 |
|---|---|---|---|
| **I0 Closed** | 封闭 | 固定标准件的 exact 身份可识别，但 `levelEvidence` 尚不满足 I1 | 不保证有可检查的标准装配面、可连接或可替换 |
| **I1 Adapter-wrapped** | 适配器封装 | I0 + `levelEvidence` 含可采信报告，证明固定版本且内容寻址的适配器暴露了 Profile 要求的 surface 与端口 | 不保证协议、Schema、配置、依赖或权限已全部合规 |
| **I2 Interface-conformant** | 接口合规 | I1 + `levelEvidence` 证明全部必选接口与配置向量通过，surface、端口方向、协议、Schema、基数、运行要求、依赖和权限均满足 Profile | 不保证目标环境中的行为已验证或状态可安全迁移 |
| **I3 Behavior-verified** | 行为已验证 | I2 + `levelEvidence` 含目标环境中可采信的 `ConformanceReport`，且其全部必选 `behavioral` 测试向量通过 | 不保证状态迁移、受控替换、回退或真实任务结果不退化 |
| **I4 Evidence-backed controlled interchangeability** | 证据支持的受控互换 | I3 + Assessment 有 exact `replacementPlanRef`，且累计 `levelEvidence` 含可采信报告，证明迁移、受控切换与验收、回退全部通过 | 不代表热重载、所有环境中的永久认证、普遍任务结果等价或任务质量必然提升 |

F3–F0 回答“结构信息从哪里来”，I0–I4 回答“这一对固定版本和摘要的标准件在什么条件下可以换到哪一步”。F 值不能填入 `assessedLevel`，I 值也不能替代 `SourceClaim`。I4 仍不能替代真实任务集上的 `EvaluationRun`，也不隐含 `hotReload`；具体实施可重启、滚动替换或热重载，由 `ReplacementPlan.replacementMode` 与适配器字段级 `operationCapabilities` 明确声明。

### 12.3 自由装配公式与替换计划

“自由装配”不是任意标准件随意相连，而是在显式约束内无需为每个组合重新发明私有适配规则。对标准件 A、候选件 B、目标环境与策略 T，实际应用替换的最低判定为：

```text
FreeAssembly(A, B, T) =
  SurfaceMatch
  ∧ RuntimeSatisfied
  ∧ DependenciesSatisfied
  ∧ PermissionsGranted
  ∧ AssessedLevel(A, B, T) ≥ T.requiredLevel
  ∧ ConformanceEvidenceValid
  ∧ LifecyclePlanAvailable
```

该公式只用于实际装配或替换。I0 编目与 I1 适配器设计不要求已经存在完整生命周期计划；一旦进入 apply/replace，`LifecyclePlanAvailable`、固定版本与摘要、权限、资源、证据有效期和回退条件全部成为硬门禁。I4 还要求迁移、验收与回退的 `ConformanceReport` 均满足上述可采信条件。

`ReplacementPlan` 必须固定 `planId`、`version`、`contentHash`、`profileRef`、`fromPart`、`toPart`、`replacementMode`、`recipePrecondition`、`riskAssessmentIds`、`requiredAdapterCapabilities`、`migrationReportRefs`、`acceptanceReportRefs`、`rollbackReportRefs`、`failurePolicy` 与 `steps`，不得包含反向 `recipeDiffRef`。Plan 不可变后，只有 `RecipeDiff.replacementPlanRef` 以 exact ref 指向该 Plan；Plan 不得再指回 Diff，以避免双向哈希环。只有 `replacementMode: hotReload` 时，适配器在受影响 `fieldScope` 的 `operationCapabilities` 中才必须包含 `hotReload`。计划失去任何摘要、权限、证据或配方前置条件时必须重新计算 Assessment，不得继续套用旧 I 级别。

### 12.4 标准件市场与开源治理

开放市场的最小交易对象不是一个下载链接，而是“描述符 + 内容寻址包 + 兼容性档案 + 有时效的互换评估 + 一致性证据 + 生命周期计划”。市场可以展示用途、许可证、权限变化、成本、维护状态和适用目标，但不得把下载量、商业排名或付费推广伪装成互换证据。

`PartRegistry` 是索引，不是唯一信任根。每次 publish、revoke 或 tombstone 必须写入只追加 revision，以 `recordHash` 和 `previousRecordHash` 构成可验证历史；撤销或墓碑不得静默覆盖旧记录。多个公共、企业和个人注册表可以并存；用户应能导出描述符与包摘要，在另一注册表或离线环境中复核。开放治理至少包括：命名空间和发布者验证、不可变版本、签名与 SBOM、撤销和安全通告、测试向量复现、证据失效、争议处理、公开 RFC、机器可执行兼容套件和不锁定单一市场的镜像协议。

![图 5：WGP-ABF 标准件装配与开放市场生态](../assets/diagrams/wgp-abf-standard-parts.png)

**图 5 — 标准件生态。** 多样化内部实现通过统一装配面发布为可验证标准件包；注册表负责发现，兼容性档案定义规则，互换评估、一致性套件与执行报告负责证明边界，替换计划与 `RecipeDiff` 负责执行和回退，`EvaluationRun` 负责判断真实任务结果。

---

## 13. 面向普通用户的渐进式体验

可视化不是把所有字段放到画布上。合格的产品界面应当提供三层体验：

### 13.1 目标层

用户选择“更安全地联网”“增加长期记忆”“更换模型”“降低成本”等目标。系统用自然语言解释预期变化、候选标准件当前 Assessment 的 I 等级与适用范围、权限与成本差分、证据新鲜度以及是否需要重启。市场推荐不得默认自动应用。

### 13.2 图纸层

用户看到组件、关系、权限、当前件与候选件。安全的预设修改以向导完成；每次修改先显示 `ReplacementPlan`、语义差分、影响范围、状态迁移和恢复能力，再请求确认。

### 13.3 专家层

开发者可以展开端口 Schema、`SourceClaim`、`StandardPartDescriptor`、原始事件、一致性向量、统计计划、编译诊断和平台配置。所有专家信息与新手视图引用相同对象 ID、版本和摘要。

新手模式不得用动画隐藏真实等待，不得把 I4 呈现为“必然更好”，也不得把高风险操作包装成普通开关。错误信息必须说明失败对象、失败门禁、可采取的动作以及当前配置是否已改变。

---

## 14. 二维图纸、机体投影与无障碍

二维工程图纸是权威编辑表面，但规范记录仍是 ABIR 与 `AssemblyRecipe`。所有画布操作必须生成 `RecipeDiff`；不能回写的字段必须只读并说明原因。当前件、候选件、I 等级与证据期限必须使用文字和图形双重编码。

机体、真人、二次元、像素或三维外观可以帮助普通用户理解，但只能存在于 `ProjectionProfile`。同一标准件可以在不同主题中映射为不同视觉部位，不得反向改变 `partKind`、互换等级或注册表身份。

投影至少应支持：

- 键盘完成选择、查看、候选比较、差分和应用流程；
- 不依赖颜色区分风险、状态、F 等级或 I 等级；
- 为节点、关系、图表和标准件证据提供文字替代；
- 支持缩放、减少动态效果和高对比度；
- 当 3D 无法使用时，所有功能仍能在二维或列表视图完成。

---

## 15. 威胁模型、供应链与数据治理

WGP-ABF 的安全边界必须由模型外部的策略执行器、操作系统、沙箱和服务端权限共同实现。隐藏 ABIR、描述符或注册表不能替代安全控制。

符合核心规范的部署应覆盖以下威胁：

- 提示注入和间接提示注入；
- 恶意标准件包、依赖劫持、拼写欺骗和供应链替换；
- 注册表投毒、伪造兼容档案、过期证据与被撤销版本继续分发；
- SSRF、跨站脚本和不受控网络访问；
- 秘密泄漏、日志泄漏和跨租户数据访问；
- 图纸、配方、描述符、事件或遥测被篡改与重放；
- 审批绕过、权限提升和不可逆外部副作用。

标准件和配方应记录来源、许可证、摘要、签名或证明、SBOM 引用与撤销状态。签名、注册表信任策略和一致性测试是不同证据，任何一个都不能替代其他两个。智能体默认只能读取最小化、脱敏的 capability manifest；读取完整权限图或安装包必须经过独立权限、审计和租户隔离策略。

任何能够改变网络、文件、凭据、外部发布或计费的替换，都必须在 `ReplacementPlan` 与差分中作为高风险能力单独显示。注册表下架不能撤销本地已安装包，部署必须支持摘要阻断和明确的撤销策略。

---

## 16. DeepSeek Harness 版本化适配案例

本章只说明可复查的参考映射，不代表 DSH 的所有对象都天然达到 F3 或 I4，也不代表 WGP-ABF 从属于 DSH。

本次核验锚点：

- 仓库：`pingta-guangpingwang/deepseek-harness`；
- 本地核验 commit：`0672d5ddfaf7d675d8e8bb37f69072bd98b5b0f7`；
- 最近标签及 commit 关系：本地核验 commit 位于 `dsh-v0.1.1-rc.2` 之后 1 个提交（`dsh-v0.1.1-rc.2-1-g0672d5ddf`）；
- 核验日期：2026-08-26。

DSH 的 `--dump-config`、生成的配置／工具／模块目录和持久 SessionEvent 目录，为声明配置与事件适配提供了较强基础。但配置行、服务注册、工具贡献和运行实体可能是一对多关系，必须逐对象或逐 claim 建立绑定。只有能从声明配置重建并通过适配器测试的字段才可标 F3 和 `roundTrip`。

DSH 的可执行插件可以映射为 `partKind: component` 的 `StandardPartDescriptor` 和 `StandardPartPackage`；模型、提示词、Skill 或其他资产则应按其真实语义映射为 `resource`、`artifact` 等 ABIR 类别。适配器必须显式发布端口、配置、权限、状态和生命周期，不得从“一切皆插件”直接推导 I 级别。两个插件只有在目标 profile、固定摘要、兼容档案和验证证据下才能获得成对互换结论。

DSH SessionEvent 与 Cordis 实时事件属于不同事件空间，映射必须保留命名空间。`assistant/chunk` 是流片段，不等于完整 `model.completed`；`turn/end` 也不一定等于整次 run 结束。热重载必须由 `ReplacementPlan.replacementMode`、字段级 `operationCapabilities`、in-flight 行为和重启条件共同声明。

参考编译器可以将 ABIR 中可回写的配置子集和通过门禁的 `ReplacementPlan` 编译为 profile patch；证据、布局、推断关系、市场元数据和诊断结果不应被错误写回平台配置。

---

## 17. 实施路线与验收标准

图 2 所示九阶段工作流按下列唯一里程碑表实施。其他文档应引用本表，不得维护第二套 P0–P6 定义：

| 阶段 | 交付物 | 验收条件 |
|---|---|---|
| P0 规范底座 | 核心 Schema、术语、合法与非法样例 | Schema 可执行；中英文对象名一致 |
| P1 导入与二维只读 | 至少一个版本化适配器、来源 claim、二维渲染 | 不支持项与语义损失可见 |
| P2 事件与回放 | 事件信封、View Replay、证据引用 | 乱序、重复、缺失与隐私策略通过测试 |
| P3 差分与回写 | RecipeDiff、dry-run、审批、编译、漂移检测 | 一次图纸修改可改变真实配置并可安全恢复 |
| P4 标准件纵切 | StandardPartDescriptor、StandardPartPackage、Profile、Assessment、Suite、Report、PartRegistry、ReplacementPlan | 两个不同实现完成 I0–I3 成对验证，且内部技术路线不同 |
| P5 评测与诊断 | 三类评测、Scorecard、I4 证据、假设状态与决策 | 统计计划预注册；所有分数和 I4 结论可追溯且有适用范围 |
| P6 可选投影与开放生态 | 机体／三维视图、联邦注册表、兼容性套件、社区标准件 | 核心功能不依赖 3D 或单一市场；第三方实现可互操作 |

任何阶段都不得通过伪造 F3 或 I4、丢弃不利运行、改变对照任务集、绕过生命周期门禁或用综合分掩盖安全下降来满足验收。

---

## 18. 开放生态、治理、知识产权与结论

### 18.1 开放治理与知识产权

WGP-ABF 由王广平在 2026 年提出并首先撰写。v0.5 采用双轨开放许可：

- 白皮书、README、治理文档与原创图表：**Creative Commons Attribution 4.0 International（CC BY 4.0）**；
- Schema、示例、构建脚本与参考代码：**Apache License 2.0**；
- WGP-ABF 名称、Logo 与未来可能的兼容／认证标记：不随上述许可授予，受 `TRADEMARKS.md` 约束。

开放许可不会转移原作者对原始作品的著作权；它向公众授予遵守条件的复制、修改和使用权限。著作权保护本文的文字、图表和具体表达，通常不等于对抽象思想、方法或操作流程本身的排他权。品牌保护、专利可申请性和司法辖区差异需要单独的专业法律意见。

标准件规范、注册协议和一致性套件应通过公开 RFC 演进。治理不得要求标准件内部开源，也不得以单一注册表上架作为合规前提；但公开市场条目必须遵守其许可证、来源、摘要、权限与证据披露义务。每个破坏性变更必须同时更新 Schema、合法样例、非法样例、迁移说明和中英文版本。

v1.0 之前如中英文出现无法调和的差异，以中文原始版本作为临时解释来源，并创建公开翻译问题；机器可验证语义以 Schema 和一致性测试为准。

规范仓库：[pingta-guangpingwang/wgp-agent-bodification-flow](https://github.com/pingta-guangpingwang/wgp-agent-bodification-flow)。规范缺陷、互操作问题、翻译差异和变更提案应提交到公开的 [Issues](https://github.com/pingta-guangpingwang/wgp-agent-bodification-flow/issues)，并引用受影响的格式兼容族、Schema `$id` 或不可变 Git 标签。

### 18.2 结论

智能体生态不应通过统一内部实现来获得组合能力。模型、算法、语言、框架、界面和商业模式需要持续分化，才能保持创新；端口、配置、状态、权限、依赖、包身份、生命周期、测试和替换证据需要标准化，才能形成可靠组合。

因此，WGP-ABF v0.5 的结论是：**百花齐放解决创新，标准件解决组合；不统一内部实现，只标准化装配面。** 自由装配不是无条件拖拽，而是在版本、摘要、环境、策略、权限、资源、互换等级、有效证据和生命周期计划全部可检查时，让标准件能够被发现、比较、替换、验证和回退。普通用户由此获得可理解的选择，开发者获得可审查的工程对象，标准件作者保留创新自由，开源社区则获得不依赖单一平台的市场与治理基础。

---

## 附录 A：最低可互操作对象

一份 Core Conformance 文档至少包含：

1. `AbirDocument`：规范版本、对象、端口、边、SourceClaim 与投影引用；
2. `AssemblyRecipe`：目标平台、期望配置、版本锚点与编译能力；
3. `RecipeDiff`：`baseVersion`、`baseContentHash`、`targetVersion`、`targetContentHash`、`preconditions`、`operations`、`riskAssessments`、`compensation`、`approval` 与单向 exact `replacementPlanRef`；
4. `RuntimeEvent`：因果身份、三维事件语义、对象与产物引用；
5. `EvaluationRun`：任务集、环境、对照、指标、统计计划和证据；
6. `StandardPartDescriptor` 与 `StandardPartPackage`：六类 ABIR 映射、标准装配面、固定实现产物和供应链身份；
7. `CompatibilityProfile`、`InterchangeabilityAssessment`、`ConformanceSuite` 与 `ConformanceReport`：稳定规则、有时效的定向 I 级别、测试定义和已执行证据；
8. `PartRegistry` 记录与 `ReplacementPlan`：可移植发现元数据和可审查替换方案。

本仓库 `spec/` 提供 JSON Schema，`examples/minimal-agent/` 提供最小闭环样例。Schema 与本文冲突时，应创建规范 Issue，不能静默选择其中一方。

## 附录 B：Claim 成熟度

| 等级 | 可用措辞 | 不可用措辞 |
|---|---|---|
| Observation | “与失败共同出现”“建议调查” | “导致失败” |
| Regression | “接口路径保持／破坏” | “提升最终智能体质量” |
| Controlled comparison | “在这些任务与条件下平均差异为…” | “普遍提升” |
| Validated causal claim | “在预注册干预及替代解释控制下支持…” | “完美归因” |

I0–I4 是互换证据等级，不是上述主张成熟度。即使替换达到 I4，关于任务质量、用户价值或成本收益的结论仍必须单独声明 Observation、Regression、Controlled comparison 或 Validated causal claim。

## 附录 C：规范发布检查项

每次版本化发布必须记录以下规范检查结果；任何未通过项必须在 Release 说明中列为已知限制，不能以沉默或未完成待办代替：

1. 中英文标题、章节号、图号、Replay 名称、F/I 等级和术语表一致；
2. Schema 接受全部合法样例，并拒绝版本化的代表性非法样例；
3. 标准件样例覆盖 I0–I4 的合法路径、降级路径和不得越级的反例；
4. 所有图具有来源、提示词或可编辑源、内容摘要与许可记录；
5. PDF 的字体、链接、分页、图注和文字提取通过发布检查；
6. 仓库秘密扫描和素材审查确认不含密钥、个人隐私或无权公开的第三方素材；
7. DSH 等外部适配案例记录不可变 commit、最近标签关系与核验日期；
8. Release 产物提供 SHA-256，并可追溯到不可变 Git 标签；
9. Public Draft 状态、许可范围、商标边界、规范仓库和 Issues 入口在仓库首页可见。

## 参考资料

1. Creative Commons, [Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)，访问日期 2026-08-27。
2. Apache Software Foundation, [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0)，访问日期 2026-08-27。
3. IETF, [RFC 8785: JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)，2020。
4. OpenTelemetry, [Semantic Conventions for Generative AI Systems](https://github.com/open-telemetry/semantic-conventions-genai/tree/56d6b11a02129319bf371083fa134b7ce989c976)，固定 commit `56d6b11a02129319bf371083fa134b7ce989c976`，访问日期 2026-08-27；该仓库当时仍处于演进阶段。
5. Semantic Versioning, [Semantic Versioning 2.0.0](https://semver.org/)，访问日期 2026-08-27。
6. WIPO, [Copyright](https://www.wipo.int/en/web/copyright/)，访问日期 2026-08-27。
7. DeepSeek Harness, [项目仓库](https://github.com/pingta-guangpingwang/deepseek-harness)，本章核验 commit 见第 16 节。

---

## 版本历史

| 版本 | 日期 | 说明 |
|---|---|---|
| 0.4 | 2026-08-26 | 固定 ABIR 与 AssemblyRecipe 规范记录、来源与操作能力分离、事件三轴、RecipeDiff、统计纪律、威胁模型和中英双语治理 |
| 0.5 | 2026-08-27 | 提出“百花齐放解决创新，标准件解决组合”，新增标准装配面、六类 ABIR 标准件映射、九类协议对象、I0–I4、自由装配公式、开放注册表与标准件市场治理 |

## 修订说明

v0.5 保留 v0.4 的结构事实、运行证据、评测和安全边界，并把可替换标准件从项目内部概念扩展为开放生态对象。新增的标准件协议不统一标准件内部实现，只固定跨边界的描述、包身份、兼容性、评估、测试、发现、替换与回退责任；新增 I0–I4 与 F3–F0 的正交规则，并把标准件发现和验证接入九阶段流程、诊断闭环和实施路线。

v0.4 中英文白皮书保留在 `whitepaper/`，v0.3 原稿完整保存在 `archive/v0.3/`，用于创作演进和出处追溯。
