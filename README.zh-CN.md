<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# WGP-ABF 中文导览

[返回双语首页](README.md) · [阅读完整中文白皮书](whitepaper/WGP-ABF_Whitepaper_v0.5.zh-CN.md) · [下载 PDF](output/pdf/WGP-ABF-Whitepaper-v0.5.0-zh-CN.pdf)

WGP-ABF 是王广平提出的智能体配置工程方法。它不是又一个节点编排器，也不统一智能体的内部实现；它标准化模型、记忆、工具、技能、工作流和界面的装配面，使配置能够被真实拆解、自由装配、可视化编辑、语义差分、编译回写、运行取证和受控验证。

## 一张图看懂

![WGP-ABF 系统地图](assets/diagrams/wgp-abf-system-map.png)

规范结构记录由 `WGP-ABIR + AssemblyRecipe` 组成。二维工程图纸是面向人的权威编辑投影；机体和三维界面只是可选、只读的解释投影。所有视图共用一套对象 ID，不保存第二份业务结构。

![WGP-ABF 标准件生态](assets/diagrams/wgp-abf-standard-parts.png)

百花齐放解决创新，标准件解决组合。`StandardPartDescriptor` 统一身份、对象类型、端口、能力、依赖、权限、状态迁移和证据入口；I0-I4 是固定 A→B、环境和时窗后由累计证据机器推导的互换结论，不能代替对热重载等具体操作能力的声明。不可变报告的撤回由外部只追加 `EvidenceStatusRecord` 生效。

## 普通用户会得到什么

1. 看见模型、工具、记忆、权限、沙箱和子智能体怎样连接；
2. 用安全向导完成“换模型、加记忆、收紧联网权限”等目标；
3. 修改前先看到影响范围、风险、是否需要重启和能否恢复；
4. 修改后用相同任务和环境复测，而不是只看“启动成功”；
5. 得到能回到组件、关系和原始证据的解释。

## 开发者从哪里开始

1. 阅读白皮书中的版本纪律、标准件体系、规范记录、来源 claim、差分和运行事件章节；
2. 查看 [`spec/`](spec/) 的 JSON Schema；
3. 打开 [`examples/minimal-agent/`](examples/minimal-agent/) 查看配方、ABIR、差分、事件和评测如何形成闭环；
4. 为目标平台实现固定版本的 importer/compiler adapter；
5. 先完成 C1 只读图纸，再逐步达到 C2 操作合规和 C3 证据合规。

## 关键边界

- F3–F0 只描述信息来源，不自动赋予编辑或回写能力；
- I0–I4 只描述互换成熟度，不能由来源等级、宣传文案或格式相似性自动推导；
- 固定模型响应流只能用于契约回归，不能单独证明因果贡献；
- 配置回退不能撤销已发送邮件、已删除数据等外部副作用；
- 安全策略必须在模型外强制执行，隐藏结构不是安全边界；
- 没有机体或 3D 视图不会降低核心合规等级。

## 参与方式

文字和小修正可以直接提交 PR；改变规范语义的提案应先提交 RFC，并同时更新 Schema、合法与非法样例、迁移说明和中英文文档。贡献前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [GOVERNANCE.md](GOVERNANCE.md)。

规范主仓库是 [pingta-guangpingwang/wgp-agent-bodification-flow](https://github.com/pingta-guangpingwang/wgp-agent-bodification-flow)，问题与提案进入公开 [Issues](https://github.com/pingta-guangpingwang/wgp-agent-bodification-flow/issues)。白皮书系列号 `0.5`、机器发布 `0.5.0`、格式兼容族 `/0.5` 和不可变标签 `v0.5.0` 各有不同用途，详见白皮书的版本纪律章节。

## 许可

白皮书与原创图表采用 CC BY 4.0；Schema、示例和脚本采用 Apache-2.0。开放许可不会转移王广平对原始作品的著作权。项目名称、Logo 与未来的认证标记另受 [TRADEMARKS.md](TRADEMARKS.md) 管理。
