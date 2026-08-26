<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Contributing / 参与贡献

Thank you for helping make agent engineering understandable and modifiable by more people. 感谢你帮助更多人看懂、修改和迭代智能体。

## Small corrections / 小型修正

Documentation clarity, typos, accessibility descriptions, sample fixes, and non-semantic schema corrections may use a normal pull request. Explain the affected file and how you verified the result.

文档表达、错字、无障碍描述、样例修正和不改变语义的 Schema 修正可以直接提交 PR，并说明影响文件与验证方式。

## Specification changes / 规范变更

A proposal that changes meaning, required fields, conformance, adapter obligations, or evaluation claims should begin as an RFC. An accepted semantic change must update:

1. Chinese and English normative prose;
2. affected JSON Schemas;
3. at least one valid and one representative invalid example;
4. migration notes and changelog;
5. diagrams or glossary entries that encode the changed concept.

改变含义、必填字段、合规要求、适配器义务或评测主张的提案应先走 RFC。规范变更必须同步更新中英文、Schema、正反样例、迁移说明和相关图解。

## Authorship and license / 作者权与许可

Contributors must have the right to submit their work, identify third-party material, and accept the license already assigned to the target file. Use a sign-off when possible:

```bash
git commit -s
```

AI assistance should be disclosed when it materially generated prose, code, or visual assets. Do not submit secrets, private datasets, impersonated work, or assets without a documented right to redistribute.

## Conduct / 行为

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Security reports should follow [SECURITY.md](SECURITY.md), not a public Issue.
