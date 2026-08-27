<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Project status / 项目状态

WGP-ABF v0.6 is a **bilingual illustrated public draft**. It is a proposed open engineering method, not an industry standard, formal certification, security guarantee, or legal advice.

WGP-ABF v0.6 是一份**中英双语图解公开草案**。它是开放工程方法提案，不是行业标准、正式认证、安全保证或法律意见。

## Maturity / 成熟度

- Whitepaper model and terminology: public draft.
- JSON Schemas and examples: v0.6 baseline includes a machine-readable `ModuleDataContract`, independent SchemaBundle, contract channels and roles, Standard-Part implementation mappings, Recipe contract bindings, normal-path chain evidence, and runtime contract exchange. The sole positive whole-part example derives a maximum of `I2 Data-aligned`.
- Data-contract ownership: normative and machine-validated, with one-way exact references from immutable Bundle/Contract/Port/Descriptor/Profile/Suite facts to directed compatibility assessments, typed data-loss approvals, resolved Recipes, Recipe-bound events and reports, and later interchangeability or replacement conclusions. Every enabled required Descriptor binding has one explicit Recipe Contract resolution. A compatibility assessment does not pin a target Recipe; a Report pins the Recipe it exercised. Format compatibility is not a behavioral-equivalence claim.
- Contract-dimension scope: the v0.6 machine baseline covers Schema and field semantics, protocol, streaming, ordering, delivery, errors, timeout origin/action, cancellation, retry, idempotency, and state. Resource/rate limits, authorization-context propagation, sensitive-field handling obligations, tenant isolation, deadline propagation, leases, late-result policy, chain budgets, and retry-amplification limits remain explicit future extensions and are not v0.6 Contract-conformance gates.
- Standard-part companion records: validated through reusable `$defs`; standalone format envelopes are not yet published for every companion type.
- DeepSeek Harness mapping: version-pinned reference case, not complete adapter coverage.
- Conformance validator: structural and cross-document closure checks recompute RFC 8785-style canonical SHA-256 identities, materialize independent SchemaBundle entries and exact-reference closure, apply RecipeDiff to a target Recipe, and validate runtime Contract/Binding identities. Nine independent checker fixtures exercise static Contract, normal-chain, configuration, permission, migration, acceptance, RecipeDiff compensation, and bounded reliability/order scenarios. The chain checker reloads the pinned Recipe, RuntimeEvents and payload bytes and recomputes their identities; the permission checker maps required Descriptor tuples to pinned policy rules. RecipeDiff compensation restores the source Recipe record but is not post-rollback runtime acceptance, and the bounded scenarios are not structured RuntimeEvent lifecycle evidence.
- Evidence limitation: the v0.6 reference RuntimeEvent and validator do not yet prove timeout→retry→recovery, deduplicated side effects, classified error recovery, or cancellation acknowledgement. The reference example therefore has no positive I3/I4 fixture, and the validator rejects attempts to promote its normal-path evidence beyond I2. These repository checks are not a certification program; no project may currently claim “WGP-ABF Certified.”
- Body and 3D projections: optional product direction, not a core requirement.

Semantic changes before v1.0 may be breaking. v0.6 introduces the breaking `/0.6` family; v0.5 implementations should follow [`MIGRATION-v0.5-to-v0.6.md`](MIGRATION-v0.5-to-v0.6.md). Every implementation should pin a specification, Schema, validator, adapter, Contract, and SchemaBundle version.
