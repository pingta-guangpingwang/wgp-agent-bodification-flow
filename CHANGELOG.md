<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Changelog / 变更日志

## 0.6.0 — 2026-08-27

- Elevated `ModuleDataContract` as the primary standardization object for critical module boundaries; an independent immutable SchemaBundle carries the data-structure closure.
- Established acyclic fact ownership: Contract owns field and exchange semantics, ABIR Port owns structural placement, Descriptor maps local implementation bindings to Contract channels and roles, Recipe resolves implementation surfaces and instance ports, and evidence points to the resolved chain.
- Added machine-readable contract channels, roles, compatibility and migration records, Recipe `contractBindings[]`, chain-bound conformance evidence, and runtime `contractExchange` identity.
- Separated format compatibility, data alignment, chain verification, behavioral equivalence, and task quality.
- Redefined I1–I3 as Contract-exposed, Data-aligned, and Chain-verified while keeping I0–I4 orthogonal to F3–F0, C0–C3, and operation capabilities.
- Extended validation to recompute RFC 8785-style canonical SHA-256 identities, materialize SchemaBundle and target-Recipe closure, and verify runtime Contract/Binding references.
- Materialized all positive-example Schema, payload, package, supply-chain, checker and evidence bytes behind exact artifact references; retrieval locators are resolution metadata rather than immutable Package or ABIR identity.
- Added nine independent executable checker fixtures and directed negative mutations for data/semantic drift, assembly direction, compatibility, migration, runtime identity, environment suitability and evidence freshness.
- Made the named chain checker independently reload the pinned Recipe, RuntimeEvents and payload bytes, recompute their identities, and close binding/part/package parties. Permission evidence now maps each required Descriptor permission tuple to a pinned policy rule. The rollback-named fixture is explicitly limited to exact RecipeDiff application and recipe compensation; it does not claim post-compensation runtime acceptance.
- Made compatibility aggregation cover every channel-referenced payload/response/end/error/delta structure, unknown-field and Contract compatibility policy, interaction kind, and connection cardinality. Explicit drops now require a typed, field-scoped `DataLossApproval`.
- Required migration coverage for every corresponding primary and auxiliary channel structure, required a data-loss approval to cover the complete assessment validity window, and pinned invalid fixtures to their exact expected AJV keyword and instance/schema paths.
- Closed adapter resolution as one identity across Recipe, RuntimeEvent/Report binding, CompatibilityAssessment, MigrationPlan and the exact adapter ArtifactRecord; exact and compatible modes reject adapter-only fields at the Schema layer.
- Required every enabled required Descriptor binding to have one explicit Recipe Contract resolution, including exact Contract-typed ABIR parties at non-Standard-Part chat boundaries. Adapter, rollback and checkpoint execution now resolves the exact Assessment/Plan artifacts through `ArtifactRecord` rather than fixed paths.
- Kept the sole positive whole-part example at the honestly proved maximum `I2 Data-aligned`. I3/I4 remain normative levels, but v0.6 has no positive lifecycle fixture until structured failure/recovery RuntimeEvent evidence is implemented; the reference validator rejects that overclaim.
- Reframed Standard-Part markets and replacement as applications above the data-contract layer; see [the v0.5 → v0.6 migration guide](MIGRATION-v0.5-to-v0.6.md).
- Added a bilingual data-contract-chain diagram and revised both whitepapers and repository guides around reliable producer→consumer chaining.

## 0.5.0 — 2026-08-27

- Elevated standard agent parts from an implicit integration concern to a core WGP-ABF engineering layer.
- Defined the principle that implementations remain diverse while their assembly surfaces become interoperable.
- Added `StandardPartDescriptor`, standard-part packages, compatibility profiles, directed interchangeability assessments, conformance suites and reports, external append-only evidence-status records, registries, and replacement plans without collapsing ABIR object kinds into `Component`.
- Added I0-I4 as cumulative, machine-derived interchangeability levels, explicitly independent from F3-F0 structural provenance and concrete operation capabilities.
- Added a machine-readable standard-part-descriptor Schema, valid example, invalid fixtures, and cross-document validation.
- Added a fifth bilingual diagram and revised both illustrated whitepapers around the standard-part ecosystem.

## 0.4.0 — 2026-08-26

- Published the first bilingual illustrated public draft.
- Renamed WGP-ABIR from Agent Body IR to Agent Blueprint IR.
- Made `WGP-ABIR + AssemblyRecipe` the canonical structural record and the 2D blueprint its authoritative editing projection.
- Separated F3–F0 provenance from field-level operation capabilities.
- Split runtime-event storage, origin, and replay role into independent axes.
- Distinguished View Replay, Simulation Replay, and Re-execution.
- Bounded fixed model-stream replay to contract regression and added statistical and causal-claim requirements.
- Added security, supply-chain, accessibility, conformance, bilingual governance, mixed licensing, original visuals, schemas, and a minimal example.

## 0.3 — archived source draft

- Original Chinese concept whitepaper by Wang Guangping.
- Preserved unchanged under `archive/v0.3/`.
