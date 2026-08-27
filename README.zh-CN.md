<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# WGP-ABF 中文导览

[返回双语首页](README.md) · [阅读完整中文白皮书](whitepaper/WGP-ABF_Whitepaper_v0.6.zh-CN.md) · [下载 PDF](output/pdf/WGP-ABF-Whitepaper-v0.6.0-zh-CN.pdf) · [v0.5 → v0.6 迁移](MIGRATION-v0.5-to-v0.6.md)

WGP-ABF 是王广平提出的智能体配置工程方法。它不是又一个节点编排器，也不统一智能体的内部实现。它首先用 `ModuleDataContract` 对齐模型、记忆、工具、技能与工作流关键边界的数据结构和交换协议，再让标准件实现并打包这些契约，使配置能够被真实拆解、稳定串联、自由装配、可视化编辑、语义差分、编译回写、运行取证和受控验证。

## 发布文件下载

[中文 PDF](https://github.com/pingta-guangpingwang/wgp-agent-bodification-flow/releases/download/v0.6.0/WGP-ABF-Whitepaper-v0.6.0-zh-CN.pdf) · [English PDF](https://github.com/pingta-guangpingwang/wgp-agent-bodification-flow/releases/download/v0.6.0/WGP-ABF-Whitepaper-v0.6.0-en.pdf) · [规范包](https://github.com/pingta-guangpingwang/wgp-agent-bodification-flow/releases/download/v0.6.0/WGP-ABF-Spec-Bundle-v0.6.0.zip) · [SHA-256 校验和](https://github.com/pingta-guangpingwang/wgp-agent-bodification-flow/releases/download/v0.6.0/WGP-ABF-v0.6.0-SHA256SUMS.txt)

## 核心图解

![WGP-ABF 数据契约链](assets/diagrams/wgp-abf-data-contract-chain-v0.6.png)

v0.6 的可信链从独立、不可变的 `SchemaBundle` 与 exact `ModuleDataContract` 出发，经解析后的生产者→消费者 Binding 到达可执行证据；标准件发现、互换和替换建立在该链之上。

![WGP-ABF 系统地图](assets/diagrams/wgp-abf-system-map-v0.6.png)

`ModuleDataContract` 唯一拥有关键边界的字段语义、协议、流、顺序、错误、超时、重试、幂等和状态。关键单向依赖是：不可变 SchemaBundle／Contract／Port／Descriptor／Profile／Suite → 定向契约兼容评估 → 采用 `exact | compatible | adapter` resolution 的 Recipe → 绑定该 Recipe 的运行事件与链路报告 → 整件互换与受控替换结论。兼容评估不固定目标 Recipe，报告则必须 exact-reference 它实际执行的 Recipe。二维工程图纸是这些事实面向人的权威编辑投影，不保存第二份业务结构。

![WGP-ABF 标准件生态](assets/diagrams/wgp-abf-standard-parts-v0.6.png)

百花齐放解决创新，数据契约解决串联，标准件解决复用。数据结构对齐只是自由装配的必要条件；执行语义和生产者→消费者的可执行证据才保障稳定串联。格式兼容不等于行为等价。I1–I3 分别是 Contract-exposed、Data-aligned、Chain-verified；I0–I4 与 F3–F0、C0–C3 和具体操作能力正交。

## 普通用户会得到什么

1. 看见模型、工具、记忆、权限、沙箱和子智能体怎样连接；
2. 用安全向导完成“换模型、加记忆、收紧联网权限”等目标；
3. 修改前先看到影响范围、风险、是否需要重启和能否恢复；
4. 修改后用相同任务和环境复测，而不是只看“启动成功”；
5. 得到能回到组件、关系和原始证据的解释。

## 开发者从哪里开始

1. 阅读白皮书中的版本纪律、标准件体系、规范记录、来源 claim、差分和运行事件章节；
2. 查看 [`spec/`](spec/) 的 `ModuleDataContract` 与其他 JSON Schema；
3. 打开 [`examples/minimal-agent/`](examples/minimal-agent/) 查看契约、Binding、配方、ABIR、差分、事件和评测如何形成闭环；
4. 为目标平台实现固定版本的 importer/compiler adapter；
5. 先完成 C1 只读图纸，再逐步达到 C2 操作合规和 C3 证据合规。

## 关键边界

- F3–F0 只描述信息来源，不自动赋予编辑或回写能力；
- 同一 Schema 或可解析 JSON 只表示格式兼容，不表示执行语义一致、行为等价或任务质量相同；
- I0–I4 只描述互换成熟度，不能由 F/C 等级、宣传文案或格式相似性自动推导；
- 固定模型响应流只能用于契约回归，不能单独证明因果贡献；
- 配置回退不能撤销已发送邮件、已删除数据等外部副作用；
- 安全策略必须在模型外强制执行，隐藏结构不是安全边界；
- 没有机体或 3D 视图不会降低核心合规等级。

## 参与方式

文字和小修正可以直接提交 PR；改变规范语义的提案应先提交 RFC，并同时更新 Schema、合法与非法样例、迁移说明和中英文文档。贡献前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [GOVERNANCE.md](GOVERNANCE.md)。

规范主仓库是 [pingta-guangpingwang/wgp-agent-bodification-flow](https://github.com/pingta-guangpingwang/wgp-agent-bodification-flow)，问题与提案进入公开 [Issues](https://github.com/pingta-guangpingwang/wgp-agent-bodification-flow/issues)。白皮书系列号 `0.6`、机器发布 `0.6.0`、格式兼容族 `/0.6` 和不可变标签 `v0.6.0` 各有不同用途，详见白皮书的版本纪律章节。

## 许可

白皮书与原创图表采用 CC BY 4.0；Schema、示例和脚本采用 Apache-2.0。开放许可不会转移王广平对原始作品的著作权。项目名称、Logo 与未来的认证标记另受 [TRADEMARKS.md](TRADEMARKS.md) 管理。
