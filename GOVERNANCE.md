<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Governance / 治理

WGP-ABF begins with a founder-maintainer model. 王广平（Wang Guangping）is the concept originator, initial specification editor, and initial final maintainer.

WGP-ABF 初期采用创始人维护制。王广平是概念提出者、初始规范编辑和首位最终维护人。

## Decisions / 决策方式

- Editorial corrections use pull requests.
- Semantic changes use public RFCs with a minimum seven-day comment period; urgent security corrections may use a shorter private process and publish a later rationale.
- The maintainer records `Draft → Accepted → Implemented → Superseded/Rejected` status.
- A decision must cite affected schemas, examples, language editions, migration impact, and conformance impact.
- No contributor may turn an observational result into a causal or certification claim without the required evidence.
- A public or private Contract or Part Registry provides discovery and immutable indexing only; registry presence, `active` status, schema-compatibility evidence, and runtime-stability evidence do not constitute WGP-ABF certification or maintainer endorsement.

## Future structure / 后续结构

After at least three sustained maintainers participate, the project may create a technical steering group through a public governance RFC. The founder's authorship record remains historical; technical decision authority may evolve under the accepted governance document.

## Releases / 发布

Release tags are immutable records. A corrected release receives a new version rather than replacing an existing tag. Release notes must identify breaking changes, schema migrations, known limitations, and artifact checksums.
