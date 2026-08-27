/** Validate the v0.6 example schemas, exact-reference DAG, and producer-consumer chain.
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { canonicalHashWithout, canonicalJson, sha256 } from "./lib/canonical-json.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const clone = (value) => structuredClone(value);
const exactDocumentKey = ({ id, version, contentHash }) => `document:${id}@${version}#${contentHash}`;
const exactPartKey = ({ partId, version, contentHash }) => `part:${partId}@${version}#${contentHash}`;
const exactContractKey = ({ contractId, version, contentHash }) => `contract:${contractId}@${version}#${contentHash}`;
const exactArtifactKey = ({ artifactId, version, contentHash }) => `artifact:${artifactId}@${version}#${contentHash}`;
const withoutHashKey = (key) => key.slice(0, key.lastIndexOf("#"));
const pointerTokens = (pointer) => pointer === "" ? [] : pointer.slice(1).split("/").map((token) => token.replaceAll("~1", "/").replaceAll("~0", "~"));
const resolvePointer = (document, pointer) => pointerTokens(pointer).reduce((value, token) => value?.[token], document);
const unique = (values) => new Set(values).size === values.length;

const runV06Validation = async () => {
  let failures = 0;
  const fail = (message) => {
    failures += 1;
    console.error(`FAIL ${message}`);
  };
  const pass = (message) => console.log(`PASS ${message}`);
  const check = (condition, message) => {
    if (!condition) fail(message);
    return Boolean(condition);
  };
  const expectIssues = (label, issues) => {
    if (issues.length === 0) fail(`negative mutation was accepted: ${label}`);
    else pass(`rejected mutation: ${label}`);
  };
  const expectIssue = (label, issues, pattern) => {
    if (!issues.some((issue) => pattern.test(issue))) fail(`negative mutation missed its gate: ${label}\n${issues.join("\n")}`);
    else pass(`rejected mutation: ${label}`);
  };

  check(canonicalJson({ b: 1, a: 2 }) === '{"a":2,"b":1}', "canonical JSON key ordering changed");
  check(canonicalJson({ "é": "雪", a: "\u000f" }) === '{"a":"\\u000f","é":"雪"}', "canonical JSON Unicode/string escaping changed");
  check(canonicalJson([-0, 1.5, 1e-7, 1e21]) === '[0,1.5,1e-7,1e+21]', "canonical JSON number serialization changed");
  const rfc8785Sample = {
    numbers: [333333333.33333329, 1e30, 4.50, 2e-3, 0.000000000000000000000000001],
    string: "€$\u000f\nA'B\"\\\\\"/",
    literals: [null, true, false],
  };
  check(
    canonicalJson(rfc8785Sample) === "{\"literals\":[null,true,false],\"numbers\":[333333333.3333333,1e+30,4.5,0.002,1e-27],\"string\":\"€$\\u000f\\nA'B\\\"\\\\\\\\\\\"/\"}",
    "RFC 8785 section 3.2.2 canonicalization sample changed",
  );
  for (const rejected of [undefined, Number.POSITIVE_INFINITY, 1n, () => undefined]) {
    let threw = false;
    try { canonicalJson(rejected); } catch { threw = true; }
    check(threw, `canonical JSON must reject ${typeof rejected}`);
  }
  for (const rejectedString of ["\ud800", "\udfff"]) {
    let threw = false;
    try { canonicalJson(rejectedString); } catch { threw = true; }
    check(threw, "canonical JSON must reject lone UTF-16 surrogates");
  }
  const schemaWhitespaceFixture = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties: { value: { type: "string" } },
  };
  const schemaWithDifferentWhitespace = JSON.parse(JSON.stringify(schemaWhitespaceFixture, null, 4));
  check(
    sha256(canonicalJson(schemaWhitespaceFixture)) === sha256(canonicalJson(schemaWithDifferentWhitespace)),
    "Schema canonical digest changed under whitespace-only serialization",
  );
  pass("canonical JSON golden vectors and hostile-value rejection");

  const schemaPaths = [
    "spec/abir.schema.json",
    "spec/assembly-recipe.schema.json",
    "spec/recipe-diff.schema.json",
    "spec/evaluation.schema.json",
    "spec/module-data-contract.schema.json",
    "spec/standard-part-descriptor.schema.json",
    "spec/runtime-event.schema.json",
  ];
  const schemas = new Map(schemaPaths.map((schemaPath) => [schemaPath, readJson(schemaPath)]));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  for (const schema of schemas.values()) ajv.addSchema(schema);
  const expectedRepository = "https://raw.githubusercontent.com/pingta-guangpingwang/wgp-agent-bodification-flow/v0.6.0";
  check(readJson("package.json").version === "0.6.0", "package version must be 0.6.0");
  for (const [schemaPath, schema] of schemas) {
    check(schema.$id === `${expectedRepository}/${schemaPath}`, `${schemaPath} has a non-release $id`);
    check(schema.$schema === "https://json-schema.org/draft/2020-12/schema", `${schemaPath} has the wrong JSON Schema dialect`);
    check(schema.properties.format.const.endsWith("/0.6"), `${schemaPath} does not use the /0.6 format family`);
    check(Boolean(ajv.getSchema(schema.$id)), `${schemaPath} did not compile in strict mode`);
  }
  const standardSchema = schemas.get("spec/standard-part-descriptor.schema.json");
  const moduleSchema = schemas.get("spec/module-data-contract.schema.json");
  check(
    isDeepStrictEqual(
      standardSchema.$defs.interchangeabilityLevel.oneOf.map(({ const: value, title }) => [value, title]),
      [
        ["I0", "Closed"],
        ["I1", "Contract-exposed"],
        ["I2", "Data-aligned"],
        ["I3", "Chain-verified"],
        ["I4", "Evidence-backed controlled interchangeability"],
      ],
    ),
    "I0-I4 display meanings changed",
  );
  check(
    !["migrationRefs", "conformanceSuiteRefs"].some((field) => field in moduleSchema.properties),
    "ModuleDataContract must not reverse-reference plans or suites",
  );
  check(
    !["protocol", "schemaRef", "mediaType", "connectionCardinality", "abirPortId"].some(
      (field) => field in standardSchema.$defs.assemblyBinding.properties,
    ),
    "Descriptor assembly bindings duplicate ModuleDataContract or Recipe facts",
  );
  check(
    ["contractRef", "bindings"].every((field) => standardSchema.$defs.contractChannelSelection.required.includes(field)),
    "profile and suite selections must use exact channel-role bindings",
  );
  pass("schema identities and v0.6 normative invariants");

  const positiveJobs = [
    ["spec/abir.schema.json", "examples/minimal-agent/abir.json"],
    ["spec/assembly-recipe.schema.json", "examples/minimal-agent/recipe.json"],
    ["spec/assembly-recipe.schema.json", "examples/minimal-agent/recipe-target.json"],
    ["spec/recipe-diff.schema.json", "examples/minimal-agent/recipe-diff.json"],
    ["spec/evaluation.schema.json", "examples/minimal-agent/evaluation.json"],
    ["spec/module-data-contract.schema.json", "examples/minimal-agent/module-data-contract.json"],
    ["spec/module-data-contract.schema.json", "examples/minimal-agent/module-data-contract-target.json"],
    ["spec/standard-part-descriptor.schema.json", "examples/minimal-agent/standard-part-descriptor.json"],
    ["spec/standard-part-descriptor.schema.json", "examples/minimal-agent/standard-part-descriptor-target.json"],
    ["spec/standard-part-descriptor.schema.json", "examples/minimal-agent/standard-part-descriptor-model-provider.json"],
  ];
  for (const [schemaPath, documentPath] of positiveJobs) {
    const validate = ajv.getSchema(schemas.get(schemaPath).$id);
    if (!validate(readJson(documentPath))) fail(`${documentPath}\n${ajv.errorsText(validate.errors, { separator: "\n" })}`);
    else pass(documentPath);
  }

  const companions = readJson("examples/minimal-agent/standard-part-companions.json");
  const companionDefinitions = [
    ["descriptors", standardSchema, "exactPartRef"],
    ["permissionPolicies", standardSchema, "permissionPolicy"],
    ["environments", standardSchema, "compatibilityEnvironment"],
    ["packages", standardSchema, "partPackage"],
    ["artifactRecords", standardSchema, "artifactRecord"],
    ["compatibilityProfiles", standardSchema, "compatibilityProfile"],
    ["conformanceSuites", standardSchema, "conformanceSuite"],
    ["conformanceReports", standardSchema, "conformanceReport"],
    ["evidenceStatusRecords", standardSchema, "evidenceStatusRecord"],
    ["interchangeabilityAssessments", standardSchema, "interchangeabilityAssessment"],
    ["replacementPlans", standardSchema, "replacementPlan"],
    ["registryRecords", standardSchema, "registryRecord"],
    ["schemaBundles", moduleSchema, "schemaBundle"],
    ["schemaResolutionRecords", moduleSchema, "schemaResolutionRecord"],
    ["contractCompatibilityAssessments", moduleSchema, "contractCompatibilityAssessment"],
    ["contractMigrationPlans", moduleSchema, "contractMigrationPlan"],
    ["dataLossApprovals", moduleSchema, "dataLossApproval"],
  ];
  const definitionValidators = new Map();
  let companionTypeFailures = 0;
  for (const [property, schema, definition] of companionDefinitions) {
    const validate = ajv.compile({ $ref: `${schema.$id}#/$defs/${definition}` });
    definitionValidators.set(definition, validate);
    if (!Array.isArray(companions[property])) {
      fail(`companion collection ${property} is missing`);
      companionTypeFailures += 1;
      continue;
    }
    for (const [index, value] of companions[property].entries()) {
      if (!validate(value)) {
        fail(`standard-part-companions.json ${property}[${index}]\n${ajv.errorsText(validate.errors, { separator: "\n" })}`);
        companionTypeFailures += 1;
      }
    }
  }
  if (companionTypeFailures === 0) pass("standard-part-companions.json (all typed companion records)");

  const runtimeSchema = schemas.get("spec/runtime-event.schema.json");
  const validateRuntime = ajv.getSchema(runtimeSchema.$id);
  const eventBytes = fs.readFileSync(path.join(root, "examples/minimal-agent/events.jsonl"), "utf8");
  const events = eventBytes.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const requestEvent = events.find(({ eventId }) => eventId === "66666666-6666-4666-8666-666666666666");
  const responseEvent = events.find(({ eventId }) => eventId === "77777777-7777-4777-8777-777777777777");
  let runtimeSchemaFailures = 0;
  for (const [index, event] of events.entries()) {
    if (!validateRuntime(event)) {
      fail(`events.jsonl line ${index + 1}\n${ajv.errorsText(validateRuntime.errors, { separator: "\n" })}`);
      runtimeSchemaFailures += 1;
    }
  }
  if (runtimeSchemaFailures === 0) pass(`events.jsonl (${events.length} schema-valid events)`);
  const repeatedDigestPattern = /^sha256:([0-9a-f])\1{63}$/;
  const repeatedDigestPaths = [];
  const scanRepeatedDigests = (value, location) => {
    if (typeof value === "string" && repeatedDigestPattern.test(value)) repeatedDigestPaths.push(location);
    else if (Array.isArray(value)) value.forEach((item, index) => scanRepeatedDigests(item, `${location}/${index}`));
    else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => scanRepeatedDigests(item, `${location}/${key}`));
  };
  for (const [, documentPath] of positiveJobs) scanRepeatedDigests(readJson(documentPath), documentPath);
  scanRepeatedDigests(companions, "examples/minimal-agent/standard-part-companions.json");
  events.forEach((event, index) => scanRepeatedDigests(event, `examples/minimal-agent/events.jsonl#${index + 1}`));
  check(repeatedDigestPaths.length === 0, `positive examples contain repeated-character placeholder digests: ${repeatedDigestPaths.join(", ")}`);
  if (repeatedDigestPaths.length === 0) pass("positive examples contain no repeated-character placeholder digests");

  const invalidJobs = [
    {
      schemaPath: "spec/abir.schema.json",
      documentPath: "examples/invalid/abir-legacy-source-claim.json",
      reason: "legacy source claim",
      expectedErrors: [{
        instancePath: "/sourceClaims/0",
        keyword: "additionalProperties",
        schemaPath: "#/additionalProperties",
        params: { additionalProperty: "adapterCapability" },
      }],
    },
    {
      schemaPath: "spec/assembly-recipe.schema.json",
      documentPath: "examples/invalid/assembly-recipe-undeclared-secret.json",
      reason: "undeclared secret",
      expectedErrors: [{
        instancePath: "",
        keyword: "additionalProperties",
        schemaPath: "#/additionalProperties",
        params: { additionalProperty: "embeddedSecret" },
      }],
    },
    {
      schemaPath: "spec/standard-part-descriptor.schema.json",
      documentPath: "examples/invalid/standard-part-descriptor-category-confusion.json",
      reason: "category confusion",
      expectedErrors: [{ instancePath: "/identity/partKind", keyword: "enum", schemaPath: "#/$defs/partKind/enum" }],
    },
    {
      definition: "replacementPlan",
      documentPath: "examples/invalid/standard-part-replacement-hot-reload-without-capability.json",
      reason: "hot reload without capability",
      expectedErrors: [
        {
          instancePath: "/requiredAdapterCapabilities/0/operationCapabilities/0",
          keyword: "const",
          schemaPath: "#/allOf/0/then/properties/requiredAdapterCapabilities/contains/properties/operationCapabilities/contains/const",
        },
        {
          instancePath: "/requiredAdapterCapabilities/0/operationCapabilities",
          keyword: "contains",
          schemaPath: "#/allOf/0/then/properties/requiredAdapterCapabilities/contains/properties/operationCapabilities/contains",
        },
        {
          instancePath: "/requiredAdapterCapabilities",
          keyword: "contains",
          schemaPath: "#/allOf/0/then/properties/requiredAdapterCapabilities/contains",
        },
        { instancePath: "", keyword: "if", schemaPath: "#/allOf/0/if" },
      ],
    },
    {
      schemaPath: "spec/recipe-diff.schema.json",
      documentPath: "examples/invalid/recipe-diff-missing-risk-assessments.json",
      reason: "missing risk assessment",
      expectedErrors: [{
        instancePath: "",
        keyword: "required",
        schemaPath: "#/required",
        params: { missingProperty: "riskAssessments" },
      }],
    },
    {
      schemaPath: "spec/recipe-diff.schema.json",
      documentPath: "examples/invalid/recipe-diff-incomplete-external-compensation.json",
      reason: "incomplete compensation",
      expectedErrors: [{
        instancePath: "/compensation/externalSideEffects/0",
        keyword: "required",
        schemaPath: "#/required",
        params: { missingProperty: "status" },
      }],
    },
    {
      schemaPath: "spec/runtime-event.schema.json",
      documentPath: "examples/invalid/runtime-event-legacy-timestamp.json",
      reason: "legacy timestamp",
      expectedErrors: [{
        instancePath: "",
        keyword: "additionalProperties",
        schemaPath: "#/additionalProperties",
        params: { additionalProperty: "timestamp" },
      }],
    },
    {
      schemaPath: "spec/evaluation.schema.json",
      documentPath: "examples/invalid/evaluation-causal-overclaim.json",
      reason: "causal overclaim",
      expectedErrors: [
        { instancePath: "/claims/0/attribution", keyword: "const", schemaPath: "#/allOf/0/then/properties/attribution/const" },
        { instancePath: "/claims/0", keyword: "if", schemaPath: "#/allOf/0/if" },
      ],
    },
  ];
  const matchesExpectedAjvError = (actual, expected) => actual.instancePath === expected.instancePath
    && actual.keyword === expected.keyword
    && actual.schemaPath === expected.schemaPath
    && Object.entries(expected.params ?? {}).every(([key, value]) => actual.params?.[key] === value);
  for (const { schemaPath, definition, documentPath, reason, expectedErrors } of invalidJobs) {
    const validate = definition ? definitionValidators.get(definition) : ajv.getSchema(schemas.get(schemaPath).$id);
    if (validate(readJson(documentPath))) {
      fail(`${documentPath} was accepted (${reason})`);
      continue;
    }
    const actualErrors = validate.errors ?? [];
    const missingExpected = expectedErrors.filter((expected) => !actualErrors.some((actual) => matchesExpectedAjvError(actual, expected)));
    const unexpected = actualErrors.filter((actual) => !expectedErrors.some((expected) => matchesExpectedAjvError(actual, expected)));
    if (missingExpected.length > 0 || unexpected.length > 0) {
      fail(`${documentPath} rejected for the wrong AJV rule (${reason})\n${JSON.stringify({ missingExpected, unexpected }, null, 2)}`);
    } else pass(`rejected ${documentPath} for exact named AJV rule (${reason})`);
  }

  const abir = readJson("examples/minimal-agent/abir.json");
  const recipe = readJson("examples/minimal-agent/recipe.json");
  const targetRecipe = readJson("examples/minimal-agent/recipe-target.json");
  const diff = readJson("examples/minimal-agent/recipe-diff.json");
  const evaluation = readJson("examples/minimal-agent/evaluation.json");
  const contracts = [
    readJson("examples/minimal-agent/module-data-contract.json"),
    readJson("examples/minimal-agent/module-data-contract-target.json"),
  ];
  const contractPathByExactKey = new Map([
    [exactContractKey({
      contractId: contracts[0].identity.contractId,
      version: contracts[0].identity.version,
      contentHash: contracts[0].contentHash,
    }), "examples/minimal-agent/module-data-contract.json"],
    [exactContractKey({
      contractId: contracts[1].identity.contractId,
      version: contracts[1].identity.version,
      contentHash: contracts[1].contentHash,
    }), "examples/minimal-agent/module-data-contract-target.json"],
  ]);
  const descriptors = [
    readJson("examples/minimal-agent/standard-part-descriptor.json"),
    readJson("examples/minimal-agent/standard-part-descriptor-target.json"),
    readJson("examples/minimal-agent/standard-part-descriptor-model-provider.json"),
  ];

  const ownerKey = (value) => {
    if (value.identity?.partId) return `part:${value.identity.partId}@${value.identity.version}`;
    if (value.identity?.contractId) return `contract:${value.identity.contractId}@${value.identity.version}`;
    if (value.bundleId) return `document:${value.bundleId}@${value.version}`;
    for (const idField of ["environmentId", "packageId", "profileId", "suiteId", "reportId", "assessmentId", "planId", "approvalId"]) {
      if (value[idField]) return `document:${value[idField]}@${value.version}`;
    }
    if (value.id && value.version && value.contentHash) return `document:${value.id}@${value.version}`;
    return undefined;
  };
  const owners = [
    abir,
    recipe,
    targetRecipe,
    ...contracts,
    ...descriptors,
    ...companions.permissionPolicies,
    ...companions.environments,
    ...companions.packages,
    ...companions.compatibilityProfiles,
    ...companions.conformanceSuites,
    ...companions.conformanceReports,
    ...companions.interchangeabilityAssessments,
    ...companions.replacementPlans,
    ...companions.schemaBundles,
    ...companions.contractCompatibilityAssessments,
    ...companions.contractMigrationPlans,
    ...companions.dataLossApprovals,
  ];
  const ownerKeys = owners.map(ownerKey);
  check(ownerKeys.every(Boolean), "every canonical-hash owner must have an identity");
  check(unique(ownerKeys), "canonical-hash owner identities must be unique");
  const ownerByLooseKey = new Map(owners.map((owner) => [ownerKey(owner), owner]));
  for (const owner of owners) {
    check(owner.contentHash === canonicalHashWithout(owner, "contentHash"), `${ownerKey(owner)} has a stale canonical contentHash`);
  }
  const appendOnlyRecordIssues = (records) => {
    const issues = [];
    const groups = Map.groupBy(records, (record) => record.reportRef ? exactDocumentKey(record.reportRef) : record.registryId);
    for (const group of groups.values()) {
      group.sort((left, right) => left.revision - right.revision);
      let previous;
      for (const [index, record] of group.entries()) {
        if (record.revision !== index + 1) issues.push(`${record.statusRecordId ?? record.registryId} revisions are not contiguous`);
        if (record.recordHash !== canonicalHashWithout(record, "recordHash")) issues.push(`${record.statusRecordId ?? record.registryId} has a stale recordHash`);
        if (record.revision === 1 ? "previousRecordHash" in record : record.previousRecordHash !== previous) issues.push("append-only record hash chain is broken");
        previous = record.recordHash;
      }
    }
    return issues;
  };
  for (const records of [companions.evidenceStatusRecords, companions.registryRecords]) {
    appendOnlyRecordIssues(records).forEach((issue) => fail(issue));
  }
  pass("RFC 8785-style hashes for roots and companion records");

  const artifactByLooseKey = new Map(companions.artifactRecords.map((record) => [`artifact:${record.artifactId}@${record.version}`, record]));
  check(artifactByLooseKey.size === companions.artifactRecords.length, "artifact resolution identities must be unique");
  for (const record of companions.artifactRecords) {
    if (record.verification.mode !== "localFile") {
      fail(`${record.artifactId}@${record.version} is not locally byte-verifiable`);
      continue;
    }
    const resolved = path.resolve(root, record.verification.localPath);
    check(resolved.startsWith(`${root}${path.sep}`), `${record.artifactId} localPath escapes the repository`);
    check(fs.existsSync(resolved), `${record.artifactId} local artifact is missing`);
    if (fs.existsSync(resolved)) check(record.contentHash === sha256(fs.readFileSync(resolved)), `${record.artifactId} byte digest drifted`);
  }
  pass("all exact artifacts resolve to locally verified bytes");

  const exactRefIssues = (documents) => {
    const issues = [];
    const visit = (value, pointer = "") => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) return value.forEach((item, index) => visit(item, `${pointer}/${index}`));
      const keys = Object.keys(value);
      if (keys.length === 3 && "contentHash" in value && "version" in value) {
        let looseKey;
        if ("partId" in value) looseKey = `part:${value.partId}@${value.version}`;
        else if ("contractId" in value) looseKey = `contract:${value.contractId}@${value.version}`;
        else if ("artifactId" in value) looseKey = `artifact:${value.artifactId}@${value.version}`;
        else if ("id" in value) looseKey = `document:${value.id}@${value.version}`;
        const owner = looseKey?.startsWith("artifact:") ? artifactByLooseKey.get(looseKey) : ownerByLooseKey.get(looseKey);
        if (!owner) issues.push(`${pointer || "/"}: unresolved ${looseKey}`);
        else if (owner.contentHash !== value.contentHash) issues.push(`${pointer || "/"}: digest drift for ${looseKey}`);
      }
      for (const [key, child] of Object.entries(value)) visit(child, `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`);
    };
    documents.forEach((document) => visit(document));
    return issues;
  };
  const closureDocuments = [abir, recipe, targetRecipe, diff, evaluation, ...contracts, ...descriptors, companions, ...events];
  const closureIssues = exactRefIssues(closureDocuments);
  closureIssues.forEach((issue) => fail(`exact-reference closure ${issue}`));
  if (closureIssues.length === 0) pass("cross-document exact-reference closure");

  const schemaResolutionByRef = new Map(companions.schemaResolutionRecords.map((record) => [record.schemaRef, record]));
  const schemaDocumentByRef = new Map();
  const schemaResolutionIssues = [];
  for (const record of companions.schemaResolutionRecords) {
    const resolved = path.resolve(root, record.locator);
    if (!resolved.startsWith(`${root}${path.sep}`)) {
      schemaResolutionIssues.push(`${record.schemaRef} locator escapes repository`);
      continue;
    }
    if (!fs.existsSync(resolved)) {
      schemaResolutionIssues.push(`${record.schemaRef} locator is missing`);
      continue;
    }
    const schemaDocument = readJson(record.locator);
    if (schemaDocument.$id !== record.schemaRef) schemaResolutionIssues.push(`${record.schemaRef} does not equal local $id`);
    if (sha256(canonicalJson(schemaDocument)) !== record.schemaContentHash) schemaResolutionIssues.push(`${record.schemaRef} canonical digest drifted`);
    schemaDocumentByRef.set(record.schemaRef, schemaDocument);
  }
  const collectExternalRefs = (schemaDocument, sourceSchemaRef) => {
    const refs = [];
    const visit = (value, pointer = "") => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) return value.forEach((item, index) => visit(item, `${pointer}/${index}`));
      for (const [key, child] of Object.entries(value)) {
        const childPointer = `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
        if (key === "$ref" && typeof child === "string" && !child.startsWith("#")) {
          const targetSchemaRef = new URL(child, sourceSchemaRef).href.split("#")[0];
          const target = schemaResolutionByRef.get(targetSchemaRef);
          refs.push({
            sourceSchemaRef,
            jsonPointer: childPointer,
            targetSchemaRef,
            targetSchemaContentHash: target?.schemaContentHash,
          });
        }
        visit(child, childPointer);
      }
    };
    visit(schemaDocument);
    return refs;
  };
  const schemaBundleIssues = (bundles) => {
    const issues = [...schemaResolutionIssues];
    for (const bundle of bundles) {
      if (!unique(bundle.entries.map(({ schemaRef }) => schemaRef))) issues.push(`${bundle.bundleId}@${bundle.version} repeats schemaRef`);
      const actualClosure = [];
      for (const entry of bundle.entries) {
        const resolution = schemaResolutionByRef.get(entry.schemaRef);
        if (!resolution) {
          issues.push(`${bundle.bundleId}@${bundle.version} cannot resolve ${entry.schemaRef}`);
          continue;
        }
        if (resolution.schemaContentHash !== entry.schemaContentHash) issues.push(`${entry.schemaRef} entry/resolution digest drift`);
        actualClosure.push(...collectExternalRefs(schemaDocumentByRef.get(entry.schemaRef), entry.schemaRef));
      }
      const edgeKey = (edge) => `${edge.sourceSchemaRef}#${edge.jsonPointer}->${edge.targetSchemaRef}#${edge.targetSchemaContentHash}`;
      const expected = [...bundle.externalRefClosure].map(edgeKey).sort();
      const actual = actualClosure.map(edgeKey).sort();
      if (!isDeepStrictEqual(actual, expected)) issues.push(`${bundle.bundleId}@${bundle.version} external $ref closure differs from local schemas`);
      for (const edge of actualClosure) {
        const targetEntry = bundle.entries.find(({ schemaRef }) => schemaRef === edge.targetSchemaRef);
        if (!targetEntry || targetEntry.schemaContentHash !== edge.targetSchemaContentHash) {
          issues.push(`${bundle.bundleId}@${bundle.version} does not pin closure target ${edge.targetSchemaRef}`);
        }
      }
    }
    return issues;
  };
  const bundleIssues = schemaBundleIssues(companions.schemaBundles);
  bundleIssues.forEach((issue) => fail(`SchemaBundle ${issue}`));
  if (bundleIssues.length === 0) pass("materialized SchemaBundle entries and transitive external-$ref closure");

  const bundleByExactKey = new Map(companions.schemaBundles.map((bundle) => [
    exactDocumentKey({ id: bundle.bundleId, version: bundle.version, contentHash: bundle.contentHash }),
    bundle,
  ]));
  const contractByExactKey = new Map(contracts.map((contract) => [exactContractKey({
    contractId: contract.identity.contractId,
    version: contract.identity.version,
    contentHash: contract.contentHash,
  }), contract]));
  const contractLooseKey = (contract) => `contract:${contract.identity.contractId}@${contract.identity.version}`;
  const schemaPropertyAt = (schemaDocument, fieldPointer) => {
    let current = schemaDocument;
    for (const token of pointerTokens(fieldPointer)) current = current?.properties?.[token];
    return current;
  };
  const schemaAllowsNull = (propertySchema) => {
    const types = Array.isArray(propertySchema?.type) ? propertySchema.type : [propertySchema?.type];
    return types.includes("null") || propertySchema?.enum?.includes(null) || propertySchema?.anyOf?.some(schemaAllowsNull) || false;
  };
  const structureFieldPaths = (structure) => new Set(structure.fields.map(({ path: fieldPath }) => fieldPath));
  const contractIssues = (contract) => {
    const issues = [];
    const roles = new Map(contract.roles.map((role) => [role.roleId, role]));
    const structures = new Map(contract.structures.map((structure) => [structure.structureId, structure]));
    if (roles.size !== contract.roles.length) issues.push("duplicate roleId");
    if (structures.size !== contract.structures.length) issues.push("duplicate structureId");
    if (!unique(contract.channels.map(({ channelId }) => channelId))) issues.push("duplicate channelId");
    for (const structure of contract.structures) {
      const bundle = bundleByExactKey.get(exactDocumentKey(structure.schema.schemaBundleRef));
      const entry = bundle?.entries.find(({ schemaRef }) => schemaRef === structure.schema.schemaRef);
      const schemaDocument = schemaDocumentByRef.get(structure.schema.schemaRef);
      if (!bundle) issues.push(`${structure.structureId} has unresolved schemaBundleRef`);
      if (!entry || entry.schemaContentHash !== structure.schema.schemaContentHash) issues.push(`${structure.structureId} schema identity is outside its bundle`);
      if (!schemaDocument) continue;
      if (structure.unknownFieldPolicy === "reject" && schemaDocument.additionalProperties !== false) {
        issues.push(`${structure.structureId} says reject unknown fields but schema permits them`);
      }
      if (!unique(structure.fields.map(({ path: fieldPath }) => fieldPath))) issues.push(`${structure.structureId} repeats field semantics`);
      for (const field of structure.fields) {
        const propertySchema = schemaPropertyAt(schemaDocument, field.path);
        if (!propertySchema) {
          issues.push(`${structure.structureId}${field.path} is absent from schema`);
          continue;
        }
        const [topLevelField] = pointerTokens(field.path);
        const schemaRequired = schemaDocument.required?.includes(topLevelField) ?? false;
        if (field.required !== schemaRequired) issues.push(`${structure.structureId}${field.path} required semantics drift`);
        if (field.nullable !== schemaAllowsNull(propertySchema)) issues.push(`${structure.structureId}${field.path} nullability semantics drift`);
        if ("defaultValue" in field && !isDeepStrictEqual(field.defaultValue, propertySchema.default)) {
          issues.push(`${structure.structureId}${field.path} default semantics drift`);
        }
        if ("default" in propertySchema && !("defaultValue" in field)) issues.push(`${structure.structureId}${field.path} omits schema default semantics`);
        if (field.unit && !isDeepStrictEqual(field.unit, propertySchema["x-wgp-unit"])) issues.push(`${structure.structureId}${field.path} unit semantics drift`);
        if (field.valueEncoding === "UUID" && propertySchema.format !== "uuid") issues.push(`${structure.structureId}${field.path} UUID encoding drift`);
        if (field.valueEncoding === "RFC3339" && propertySchema.format !== "date-time") issues.push(`${structure.structureId}${field.path} RFC3339 encoding drift`);
        if (field.valueEncoding === "utf-8" && propertySchema.contentEncoding !== "utf-8") issues.push(`${structure.structureId}${field.path} UTF-8 encoding drift`);
      }
      for (const requiredField of schemaDocument.required ?? []) {
        if (!structure.fields.some(({ path: fieldPath }) => fieldPath === `/${requiredField}`)) issues.push(`${structure.structureId} omits required schema field /${requiredField}`);
      }
    }
    const requireStructure = (channel, structureId, kind, label) => {
      const structure = structures.get(structureId);
      if (!structure) issues.push(`${channel.channelId} ${label} references missing structure ${structureId}`);
      else if (structure.kind !== kind) issues.push(`${channel.channelId} ${label} requires ${kind}, got ${structure.kind}`);
      return structure;
    };
    for (const channel of contract.channels) {
      if (roles.get(channel.producerRoleId)?.kind !== "producer") issues.push(`${channel.channelId} producerRoleId is not a producer`);
      for (const roleId of channel.consumerRoleIds) if (roles.get(roleId)?.kind !== "consumer") issues.push(`${channel.channelId} consumer ${roleId} is not a consumer`);
      if (!unique(channel.consumerRoleIds)) issues.push(`${channel.channelId} repeats consumer roles`);
      let payloadStructure;
      let errorStructure;
      let ordering;
      if (channel.interaction === "message") {
        payloadStructure = requireStructure(channel, channel.message.payloadStructureId, "message", "message payload");
        errorStructure = requireStructure(channel, channel.message.errorStructureId, "error", "message error");
        ordering = channel.message.ordering;
      } else if (channel.interaction === "stream") {
        payloadStructure = requireStructure(channel, channel.stream.chunk.structureId, "streamChunk", "stream chunk");
        requireStructure(channel, channel.stream.end.structureId, "streamEnd", "stream end");
        errorStructure = requireStructure(channel, channel.stream.error.structureId, "error", "stream error");
        ordering = channel.stream.ordering;
      } else if (channel.interaction === "event") {
        payloadStructure = requireStructure(channel, channel.event.eventStructureId, "event", "event payload");
        errorStructure = requireStructure(channel, channel.event.errorStructureId, "error", "event error");
        ordering = channel.event.ordering;
      } else if (channel.interaction === "state") {
        payloadStructure = requireStructure(channel, channel.state.snapshotStructureId, "stateSnapshot", "state snapshot");
        requireStructure(channel, channel.state.deltaStructureId, "stateDelta", "state delta");
        errorStructure = requireStructure(channel, channel.state.errorStructureId, "error", "state error");
        ordering = channel.state.ordering;
      }
      if (channel.reliability.retry.maxAttempts > 1) {
        if (!["required", "transport"].includes(channel.reliability.idempotency.mode)) issues.push(`${channel.channelId} retry lacks idempotency`);
        if (channel.reliability.retry.retryOn.length === 0) issues.push(`${channel.channelId} retry lacks retry classifications`);
      }
      if (channel.reliability.timeout.onTimeout === "retry" && channel.reliability.retry.maxAttempts < 2) issues.push(`${channel.channelId} timeout retry has one attempt`);
      if (["atLeastOnce", "effectivelyOnce"].includes(channel.reliability.delivery) && !["required", "transport"].includes(channel.reliability.idempotency.mode)) {
        issues.push(`${channel.channelId} delivery semantics require idempotency`);
      }
      if (channel.reliability.idempotency.keyPointer && !structureFieldPaths(payloadStructure).has(channel.reliability.idempotency.keyPointer)) {
        issues.push(`${channel.channelId} idempotency keyPointer is absent from payload structure`);
      }
      for (const pointer of [
        channel.reliability.errorHandling.classificationField,
        channel.reliability.errorHandling.retryableField,
        channel.reliability.errorHandling.terminalField,
      ]) if (!structureFieldPaths(errorStructure).has(pointer)) issues.push(`${channel.channelId} error field ${pointer} is absent`);
      if (ordering.mode !== "none" && !structureFieldPaths(payloadStructure).has(ordering.sequenceField)) issues.push(`${channel.channelId} ordering sequence field is absent`);
      if (channel.protocol.framingMediaType.includes("json") && !payloadStructure.schema.payloadMediaType.includes("json")) issues.push(`${channel.channelId} framing/payload serialization is not composable`);
    }
    return issues;
  };
  const allContractIssues = contracts.flatMap((contract) => contractIssues(contract).map((issue) => `${contractLooseKey(contract)} ${issue}`));
  allContractIssues.forEach((issue) => fail(`ModuleDataContract ${issue}`));
  if (allContractIssues.length === 0) pass("ModuleDataContract roles, schemas, fields, protocols, and reliability semantics");

  const descriptorByExactKey = new Map(descriptors.map((descriptor) => [exactPartKey({
    partId: descriptor.identity.partId,
    version: descriptor.identity.version,
    contentHash: descriptor.contentHash,
  }), descriptor]));
  const packageByExactKey = new Map(companions.packages.map((packageRecord) => [exactDocumentKey({
    id: packageRecord.packageId,
    version: packageRecord.version,
    contentHash: packageRecord.contentHash,
  }), packageRecord]));
  const profileByExactKey = new Map(companions.compatibilityProfiles.map((profile) => [exactDocumentKey({
    id: profile.profileId,
    version: profile.version,
    contentHash: profile.contentHash,
  }), profile]));
  const environmentByExactKey = new Map(companions.environments.map((environment) => [exactDocumentKey({
    id: environment.environmentId,
    version: environment.version,
    contentHash: environment.contentHash,
  }), environment]));
  const suiteByExactKey = new Map(companions.conformanceSuites.map((suite) => [exactDocumentKey({
    id: suite.suiteId,
    version: suite.version,
    contentHash: suite.contentHash,
  }), suite]));
  const assessmentByExactKey = new Map(companions.contractCompatibilityAssessments.map((assessment) => [exactDocumentKey({
    id: assessment.assessmentId,
    version: assessment.version,
    contentHash: assessment.contentHash,
  }), assessment]));
  const migrationByExactKey = new Map(companions.contractMigrationPlans.map((plan) => [exactDocumentKey({
    id: plan.planId,
    version: plan.version,
    contentHash: plan.contentHash,
  }), plan]));
  const dataLossApprovalByExactKey = new Map(companions.dataLossApprovals.map((approval) => [exactDocumentKey({
    id: approval.approvalId,
    version: approval.version,
    contentHash: approval.contentHash,
  }), approval]));
  const reportByExactKey = new Map(companions.conformanceReports.map((report) => [exactDocumentKey({
    id: report.reportId,
    version: report.version,
    contentHash: report.contentHash,
  }), report]));
  const recipeByExactKey = new Map([recipe, targetRecipe].map((value) => [exactDocumentKey({
    id: value.id,
    version: value.version,
    contentHash: value.contentHash,
  }), value]));

  const runtimeSatisfactionIssues = (required, actual, label) => {
    const issues = [];
    for (const engine of required.engines) {
      if (!actual.engines.some((candidate) => candidate.name === engine.name && candidate.versionRange === engine.versionRange)) {
        issues.push(`${label} lacks required engine ${engine.name}@${engine.versionRange}`);
      }
    }
    for (const platform of required.platforms) {
      const matched = actual.platforms.some((candidate) =>
        (platform.os === "any" || candidate.os === platform.os)
        && (platform.architecture === "any" || candidate.architecture === platform.architecture));
      if (!matched) issues.push(`${label} lacks required platform ${platform.os}/${platform.architecture}`);
    }
    for (const field of ["cpuCores", "memoryMiB", "storageMiB"]) {
      if (actual.minimumResources[field] < required.minimumResources[field]) issues.push(`${label} lacks required ${field}`);
    }
    const requiredAccelerator = required.minimumResources.accelerator ?? "any";
    const actualAccelerator = actual.minimumResources.accelerator ?? "any";
    if (!["any", "none"].includes(requiredAccelerator) && ![requiredAccelerator, "any"].includes(actualAccelerator)) issues.push(`${label} lacks required accelerator`);
    if (required.network !== actual.network) issues.push(`${label} network mode ${actual.network} differs from required ${required.network}`);
    return issues;
  };
  const permissionCoverageIssues = (descriptor, policy) => {
    const issues = [];
    if (!descriptor || !policy) return ["Descriptor or permission policy does not close"];
    const mappingKeys = policy.requirementMappings.map(({ permissionId, scope, action, resource }) => `${permissionId}#${scope}#${action}#${resource}`);
    if (!unique(mappingKeys)) issues.push(`${policy.id} repeats a permission-requirement mapping`);
    for (const mapping of policy.requirementMappings) {
      if (!policy.rules.some(({ ruleId }) => ruleId === mapping.ruleId)) issues.push(`${policy.id}/${mapping.mappingId} ruleId does not close`);
    }
    for (const requirement of descriptor.requirements.permissions.filter(({ required }) => required)) {
      for (const action of requirement.actions) {
        for (const resource of requirement.resources) {
          const count = policy.requirementMappings.filter((mapping) => mapping.permissionId === requirement.permissionId
            && mapping.scope === requirement.scope
            && mapping.action === action
            && mapping.resource === resource
            && policy.rules.some(({ ruleId }) => ruleId === mapping.ruleId)).length;
          if (count !== 1) issues.push(`${descriptor.identity.partId} permission tuple ${requirement.permissionId}#${requirement.scope}#${action}#${resource} mapping count is ${count}`);
        }
      }
    }
    return issues;
  };
  const profileEnvironmentIssues = (profile, environment, pairDescriptors = []) => {
    const issues = [];
    if (!profile || !environment) return ["Profile or Environment does not close"];
    if (!sameExactRef(profile.permissionPolicyRef, environment.permissionPolicyRef, exactDocumentKey)) issues.push("Environment permission policy differs from Profile");
    const permissionPolicy = companions.permissionPolicies.find((policy) => sameExactRef(
      { id: policy.id, version: policy.version, contentHash: policy.contentHash },
      profile.permissionPolicyRef,
      exactDocumentKey,
    ));
    if (!permissionPolicy) issues.push("Profile permission policy does not close");
    issues.push(...runtimeSatisfactionIssues(profile.runtimeConstraints, environment.runtime, "Environment"));
    for (const descriptor of pairDescriptors) {
      issues.push(...runtimeSatisfactionIssues(descriptor.requirements.runtime, environment.runtime, descriptor.identity.partId));
      issues.push(...permissionCoverageIssues(descriptor, permissionPolicy));
    }
    for (const descriptor of pairDescriptors) {
      const packageRecord = packageByExactKey.get(exactDocumentKey(descriptor.packageRef));
      if (!packageRecord) continue;
      if (profile.packageSignaturePolicy === "verifiedRequired" && packageRecord.signature.status !== "verified") issues.push(`${descriptor.identity.partId} package signature is not verified`);
      if (profile.packageSignaturePolicy === "signedRequired" && !["signed", "verified"].includes(packageRecord.signature.status)) issues.push(`${descriptor.identity.partId} package is not signed`);
      if (packageRecord.signature.status === "revoked") issues.push(`${descriptor.identity.partId} package signature is revoked`);
    }
    if (pairDescriptors.length === 2) {
      const [sourceDescriptor, targetDescriptor] = pairDescriptors;
      if (profile.dependencyPolicy === "exactPinned" && !isDeepStrictEqual(sourceDescriptor.requirements.dependencies, targetDescriptor.requirements.dependencies)) issues.push("exactPinned dependency requirements differ");
      if (!isDeepStrictEqual(sourceDescriptor.requirements.permissions, targetDescriptor.requirements.permissions)) issues.push("permission requirements differ between candidate parts");
      if (profile.configurationPolicy === "directRequired" && !isDeepStrictEqual(sourceDescriptor.configuration, targetDescriptor.configuration)) issues.push("direct configuration identities differ");
      if (profile.statePolicy === "directRequired" && !isDeepStrictEqual(sourceDescriptor.state, targetDescriptor.state)) issues.push("direct state identities differ");
    }
    return issues;
  };

  const descriptorIssues = (descriptor) => {
    const issues = [];
    if (!packageByExactKey.has(exactDocumentKey(descriptor.packageRef))) issues.push("packageRef does not close");
    if (descriptor.lifecycle.install.preconditions.some((precondition) => /signature (?:is|are) verified/i.test(precondition))) issues.push("lifecycle precondition falsely claims a verified signature");
    for (const ref of descriptor.compatibilityProfileRefs) if (!profileByExactKey.has(exactDocumentKey(ref))) issues.push(`unresolved profile ${ref.id}`);
    for (const ref of descriptor.conformanceSuiteRefs) if (!suiteByExactKey.has(exactDocumentKey(ref))) issues.push(`unresolved suite ${ref.id}`);
    if (!unique(descriptor.assembly.surfaces.map(({ surfaceId }) => surfaceId))) issues.push("duplicate assembly surfaceId");
    for (const surface of descriptor.assembly.surfaces) {
      const contract = contractByExactKey.get(exactContractKey(surface.contractRef));
      if (!contract) {
        issues.push(`${surface.surfaceId} contractRef does not close`);
        continue;
      }
      const roleById = new Map(contract.roles.map((role) => [role.roleId, role]));
      if (!unique(surface.bindings.map(({ bindingId }) => bindingId))) issues.push(`${surface.surfaceId} duplicate bindingId`);
      for (const binding of surface.bindings) {
        const channel = contract.channels.find(({ channelId }) => channelId === binding.channelId);
        if (!channel) issues.push(`${surface.surfaceId}/${binding.bindingId} channel does not exist`);
        else if (![channel.producerRoleId, ...channel.consumerRoleIds].includes(binding.contractRoleId)) issues.push(`${surface.surfaceId}/${binding.bindingId} role is not on channel`);
        if (!roleById.has(binding.contractRoleId)) issues.push(`${surface.surfaceId}/${binding.bindingId} role does not exist`);
      }
    }
    const configBundle = bundleByExactKey.get(exactDocumentKey(descriptor.configuration.schemaBundleRef));
    if (!configBundle?.entries.some((entry) =>
      entry.schemaRef === descriptor.configuration.schemaRef && entry.schemaContentHash === descriptor.configuration.schemaDigest)) {
      issues.push("configuration schema does not close through exact SchemaBundle");
    }
    if (descriptor.configuration.defaultsArtifactRef && !artifactByLooseKey.has(withoutHashKey(exactArtifactKey(descriptor.configuration.defaultsArtifactRef)))) {
      issues.push("configuration defaults artifact does not close");
    }
    if (descriptor.state.mode === "stateful") {
      const stateBundle = bundleByExactKey.get(exactDocumentKey(descriptor.state.schema.schemaBundleRef));
      if (!stateBundle?.entries.some((entry) =>
        entry.schemaRef === descriptor.state.schema.schemaRef && entry.schemaContentHash === descriptor.state.schema.schemaContentHash)) {
        issues.push("state schema does not close through exact SchemaBundle");
      }
      for (const migration of descriptor.state.migrations) {
        if (migration.fromStateSchema.schemaVersion === migration.toStateSchema.schemaVersion) issues.push("state migration does not advance schema version");
      }
    }
    return issues;
  };
  const allDescriptorIssues = descriptors.flatMap((descriptor) => descriptorIssues(descriptor).map((issue) => `${descriptor.identity.partId}@${descriptor.identity.version} ${issue}`));
  allDescriptorIssues.forEach((issue) => fail(`StandardPartDescriptor ${issue}`));
  if (allDescriptorIssues.length === 0) pass("StandardPartDescriptor contract, configuration, state, profile, suite, and package closure");
  const referencePermissionPolicy = companions.permissionPolicies[0];
  const permissionMappingIssues = descriptors.flatMap((descriptor) => permissionCoverageIssues(descriptor, referencePermissionPolicy));
  permissionMappingIssues.forEach((issue) => fail(`PermissionPolicy ${issue}`));
  if (permissionMappingIssues.length === 0) pass("Descriptor permission tuples map exactly to executable permission-policy rules");
  const packageIssues = companions.packages.flatMap((packageRecord) => [
    packageRecord.artifactRef,
    packageRecord.supplyChain.sbom.artifactRef,
    packageRecord.supplyChain.provenance.attestationArtifactRef,
    packageRecord.license.noticeArtifactRef,
  ].flatMap((ref) => artifactByLooseKey.has(withoutHashKey(exactArtifactKey(ref)))
    ? [] : [`${packageRecord.packageId}@${packageRecord.version} artifact ${ref.artifactId} does not close`]));
  packageIssues.forEach((issue) => fail(`PartPackage ${issue}`));
  if (packageIssues.length === 0) pass("PartPackage artifact, SBOM, provenance, notice, and signature-policy inputs close");

  const objects = [
    ...abir.objects.components,
    ...abir.objects.resources,
    ...abir.objects.policies,
    ...abir.objects.artifacts,
    ...abir.objects.interfaces,
    ...abir.objects.containers,
  ];
  const objectById = new Map(objects.map((object) => [object.id, object]));
  const portByKey = new Map();
  for (const object of objects) for (const port of object.ports ?? []) portByKey.set(`${object.id}#${port.id}`, { object, port });
  const abirIssues = (candidate) => {
    const issues = [];
    const candidateObjects = [
      ...candidate.objects.components,
      ...candidate.objects.resources,
      ...candidate.objects.policies,
      ...candidate.objects.artifacts,
      ...candidate.objects.interfaces,
      ...candidate.objects.containers,
    ];
    const candidateObjectById = new Map(candidateObjects.map((object) => [object.id, object]));
    const candidatePortByKey = new Map();
    for (const object of candidateObjects) for (const port of object.ports ?? []) {
      const key = `${object.id}#${port.id}`;
      if (candidatePortByKey.has(key)) issues.push(`duplicate port ${key}`);
      candidatePortByKey.set(key, { object, port });
    }
    if (candidateObjectById.size !== candidateObjects.length) issues.push("duplicate object id");
    if (!unique(candidate.edges.map(({ id }) => id))) issues.push("duplicate edge id");
    for (const { object, port } of candidatePortByKey.values()) {
      if (!port.contractChannel) continue;
      const contract = contractByExactKey.get(exactContractKey(port.contractChannel.contractRef));
      const channel = contract?.channels.find(({ channelId }) => channelId === port.contractChannel.channelId);
      const role = contract?.roles.find(({ roleId }) => roleId === port.contractChannel.roleId);
      if (!channel || !role) issues.push(`${object.id}#${port.id} contract channel/role does not close`);
      else {
        if (![channel.producerRoleId, ...channel.consumerRoleIds].includes(role.roleId)) issues.push(`${object.id}#${port.id} role is not on channel`);
        if (port.direction === "out" && role.kind !== "producer") issues.push(`${object.id}#${port.id} out port is not producer role`);
        if (port.direction === "in" && role.kind !== "consumer") issues.push(`${object.id}#${port.id} in port is not consumer role`);
        if (port.direction === "bidirectional") issues.push(`${object.id}#${port.id} bidirectional port cannot expose one exact role`);
      }
    }
    for (const edge of candidate.edges) {
      const source = candidatePortByKey.get(`${edge.from.objectId}#${edge.from.portId}`)?.port;
      const target = candidatePortByKey.get(`${edge.to.objectId}#${edge.to.portId}`)?.port;
      if (!source) issues.push(`${edge.id} source port is missing`);
      if (!target) issues.push(`${edge.id} target port is missing`);
      if (source && !["out", "bidirectional"].includes(source.direction)) issues.push(`${edge.id} source port cannot produce`);
      if (target && !["in", "bidirectional"].includes(target.direction)) issues.push(`${edge.id} target port cannot consume`);
    }
    for (const claim of candidate.sourceClaims) {
      if (claim.adapter?.implementationArtifactRef
        && !artifactByLooseKey.has(withoutHashKey(exactArtifactKey(claim.adapter.implementationArtifactRef)))) {
        issues.push(`${claim.id} adapter implementation artifact does not close`);
      }
    }
    return issues;
  };
  const baseAbirIssues = abirIssues(abir);
  baseAbirIssues.forEach((issue) => fail(`ABIR ${issue}`));
  if (baseAbirIssues.length === 0) pass("ABIR exact contract channel roles, port directions, and edge closure");

  const partKindToObjectType = new Map([
    ["component", "Component"],
    ["resource", "Resource"],
    ["policy", "Policy"],
    ["artifact", "Artifact"],
    ["interface", "Interface"],
    ["container", "Container"],
  ]);
  const resolveRecipeEndpoint = (candidateRecipe, endpoint) => {
    if (endpoint.abirObjectId) {
      const portRecord = portByKey.get(`${endpoint.abirObjectId}#${endpoint.abirPortId}`);
      const contractRef = portRecord?.port.contractChannel?.contractRef;
      const contract = contractRef ? contractByExactKey.get(exactContractKey(contractRef)) : undefined;
      const channelId = portRecord?.port.contractChannel?.channelId;
      const roleId = portRecord?.port.contractChannel?.roleId;
      return {
        portRecord,
        contractRef,
        contract,
        channelId,
        channel: contract?.channels.find(({ channelId: id }) => id === channelId),
        roleId,
        role: contract?.roles.find(({ roleId: id }) => id === roleId),
        directAbirEndpoint: true,
      };
    }
    const standardBinding = candidateRecipe.standardPartBindings.find(({ bindingId }) => bindingId === endpoint.standardPartBindingId);
    const descriptor = standardBinding ? descriptorByExactKey.get(exactPartKey(standardBinding.descriptorRef)) : undefined;
    const surface = descriptor?.assembly.surfaces.find(({ surfaceId }) => surfaceId === endpoint.surfaceId);
    const assemblyBinding = surface?.bindings.find(({ bindingId }) => bindingId === endpoint.assemblyBindingId);
    const surfaceMapping = standardBinding?.surfaceMappings.find(({ surfaceId }) => surfaceId === endpoint.surfaceId);
    const portMapping = surfaceMapping?.portMappings.find(({ assemblyBindingId }) => assemblyBindingId === endpoint.assemblyBindingId);
    const portRecord = portMapping ? portByKey.get(`${standardBinding.targetObjectId}#${portMapping.abirPortId}`) : undefined;
    const contract = surface ? contractByExactKey.get(exactContractKey(surface.contractRef)) : undefined;
    const channel = contract?.channels.find(({ channelId }) => channelId === assemblyBinding?.channelId);
    const role = contract?.roles.find(({ roleId }) => roleId === assemblyBinding?.contractRoleId);
    const packageRecord = standardBinding ? packageByExactKey.get(exactDocumentKey(standardBinding.packageRef)) : undefined;
    return {
      standardBinding,
      descriptor,
      surface,
      assemblyBinding,
      portMapping,
      portRecord,
      contractRef: surface?.contractRef,
      contract,
      channelId: assemblyBinding?.channelId,
      channel,
      roleId: assemblyBinding?.contractRoleId,
      role,
      packageRecord,
      directAbirEndpoint: false,
    };
  };
  const sameExactRef = (left, right, key) => left && right && key(left) === key(right);
  const recipeIssues = (candidateRecipe, candidateAbir = abir, overrides = {}) => {
    const issues = [];
    const availableMigrationPlans = overrides.migrationPlans ?? companions.contractMigrationPlans;
    const availableMigrationByExactKey = new Map(availableMigrationPlans.map((plan) => [exactDocumentKey({
      id: plan.planId,
      version: plan.version,
      contentHash: plan.contentHash,
    }), plan]));
    if (!sameExactRef(candidateRecipe.abir, { id: abir.id, version: abir.version, contentHash: abir.contentHash }, exactDocumentKey)) issues.push("ABIR exact ref drift");
    if (!unique(candidateRecipe.standardPartBindings.map(({ bindingId }) => bindingId))) issues.push("duplicate standardPart binding id");
    for (const binding of candidateRecipe.standardPartBindings) {
      const descriptor = descriptorByExactKey.get(exactPartKey(binding.descriptorRef));
      const packageRecord = packageByExactKey.get(exactDocumentKey(binding.packageRef));
      const object = objectById.get(binding.targetObjectId);
      if (!descriptor) issues.push(`${binding.bindingId} descriptor does not close`);
      if (!packageRecord) issues.push(`${binding.bindingId} package does not close`);
      if (descriptor && !sameExactRef(binding.packageRef, descriptor.packageRef, exactDocumentKey)) issues.push(`${binding.bindingId} package differs from descriptor`);
      if (descriptor && binding.partKind !== descriptor.identity.partKind) issues.push(`${binding.bindingId} partKind differs from descriptor`);
      if (object?.objectType !== partKindToObjectType.get(binding.partKind)) issues.push(`${binding.bindingId} target object category mismatch`);
      if (!unique(binding.surfaceMappings.map(({ surfaceId }) => surfaceId))) issues.push(`${binding.bindingId} repeats surface mapping`);
      for (const surfaceMapping of binding.surfaceMappings) {
        const surface = descriptor?.assembly.surfaces.find(({ surfaceId }) => surfaceId === surfaceMapping.surfaceId);
        if (!surface) issues.push(`${binding.bindingId}/${surfaceMapping.surfaceId} surface is missing`);
        if (!unique(surfaceMapping.portMappings.map(({ assemblyBindingId }) => assemblyBindingId))) issues.push(`${binding.bindingId}/${surfaceMapping.surfaceId} repeats assembly binding mapping`);
        if (!unique(surfaceMapping.portMappings.map(({ abirPortId }) => abirPortId))) issues.push(`${binding.bindingId}/${surfaceMapping.surfaceId} repeats ABIR port mapping`);
        for (const mapping of surfaceMapping.portMappings) {
          const assemblyBinding = surface?.bindings.find(({ bindingId }) => bindingId === mapping.assemblyBindingId);
          const port = portByKey.get(`${binding.targetObjectId}#${mapping.abirPortId}`)?.port;
          if (!assemblyBinding) issues.push(`${binding.bindingId}/${mapping.assemblyBindingId} assembly binding is missing`);
          if (!port?.contractChannel) issues.push(`${binding.bindingId}/${mapping.abirPortId} ABIR port lacks exact contract role`);
          if (assemblyBinding && port?.contractChannel) {
            if (!sameExactRef(surface.contractRef, port.contractChannel.contractRef, exactContractKey) ||
                assemblyBinding.channelId !== port.contractChannel.channelId ||
                assemblyBinding.contractRoleId !== port.contractChannel.roleId) {
              issues.push(`${binding.bindingId}/${mapping.abirPortId} Descriptor-to-ABIR contract mapping drift`);
            }
          }
        }
      }
      for (const surface of descriptor?.assembly.surfaces ?? []) {
        const surfaceMapping = binding.surfaceMappings.find(({ surfaceId }) => surfaceId === surface.surfaceId);
        for (const assemblyBinding of surface.bindings.filter(({ required }) => required)) {
          const count = surfaceMapping?.portMappings.filter(({ assemblyBindingId }) => assemblyBindingId === assemblyBinding.bindingId).length ?? 0;
          if (count !== 1) issues.push(`${binding.bindingId}/${surface.surfaceId}/${assemblyBinding.bindingId} required mapping count is ${count}`);
        }
      }
    }
    if (!unique(candidateRecipe.contractBindings.map(({ contractBindingId }) => contractBindingId))) issues.push("duplicate contractBindingId");
    for (const standardBinding of candidateRecipe.standardPartBindings.filter(({ enabled }) => enabled)) {
      const descriptor = descriptorByExactKey.get(exactPartKey(standardBinding.descriptorRef));
      for (const surface of descriptor?.assembly.surfaces ?? []) {
        for (const assemblyBinding of surface.bindings.filter(({ required }) => required)) {
          const endpointCount = candidateRecipe.contractBindings.flatMap(({ producer, consumer }) => [producer, consumer]).filter((endpoint) =>
            endpoint.standardPartBindingId === standardBinding.bindingId
            && endpoint.surfaceId === surface.surfaceId
            && endpoint.assemblyBindingId === assemblyBinding.bindingId).length;
          if (endpointCount !== 1) issues.push(`${standardBinding.bindingId}/${surface.surfaceId}/${assemblyBinding.bindingId} required Contract endpoint count is ${endpointCount}`);
        }
      }
    }
    for (const binding of candidateRecipe.contractBindings) {
      const producer = resolveRecipeEndpoint(candidateRecipe, binding.producer);
      const consumer = resolveRecipeEndpoint(candidateRecipe, binding.consumer);
      if (!producer.portRecord || !producer.contract || (!producer.directAbirEndpoint && (!producer.assemblyBinding || !producer.packageRecord))) issues.push(`${binding.contractBindingId} producer does not resolve`);
      if (!consumer.portRecord || !consumer.contract || (!consumer.directAbirEndpoint && (!consumer.assemblyBinding || !consumer.packageRecord))) issues.push(`${binding.contractBindingId} consumer does not resolve`);
      if (!producer.directAbirEndpoint && !producer.standardBinding?.enabled) issues.push(`${binding.contractBindingId} producer StandardPartBinding is disabled`);
      if (!consumer.directAbirEndpoint && !consumer.standardBinding?.enabled) issues.push(`${binding.contractBindingId} consumer StandardPartBinding is disabled`);
      if (producer.role?.kind !== "producer") issues.push(`${binding.contractBindingId} producer endpoint is not producer role`);
      if (consumer.role?.kind !== "consumer") issues.push(`${binding.contractBindingId} consumer endpoint is not consumer role`);
      const matchingEdge = candidateAbir.edges.some((edge) =>
        edge.from.objectId === producer.portRecord?.object.id
        && edge.from.portId === producer.portRecord?.port.id
        && edge.to.objectId === consumer.portRecord?.object.id
        && edge.to.portId === consumer.portRecord?.port.id);
      if (!matchingEdge) issues.push(`${binding.contractBindingId} has no producer-to-consumer ABIR edge`);
      if (binding.resolution.mode === "exact") {
        if (!sameExactRef(producer.contractRef, consumer.contractRef, exactContractKey) || producer.channelId !== consumer.channelId) {
          issues.push(`${binding.contractBindingId} exact resolution joins different contracts/channels`);
        }
      } else {
        const assessment = assessmentByExactKey.get(exactDocumentKey(binding.resolution.compatibilityAssessmentRef));
        if (!assessment) issues.push(`${binding.contractBindingId} compatibility assessment does not close`);
        else {
          if (!sameExactRef(assessment.sourceContract, producer.contractRef, exactContractKey) ||
              !sameExactRef(assessment.targetContract, consumer.contractRef, exactContractKey)) {
            issues.push(`${binding.contractBindingId} assessment direction is reversed`);
          }
          if (!assessment.channelMappings.some(({ sourceChannelId, sourceRoleId, targetChannelId, targetRoleId }) =>
            sourceChannelId === producer.channelId
            && sourceRoleId === producer.roleId
            && targetChannelId === consumer.channelId
            && targetRoleId === consumer.roleId)) {
            issues.push(`${binding.contractBindingId} assessment does not map its channels`);
          }
        }
        if (binding.resolution.mode === "compatible") {
          if (binding.resolution.adapterArtifactRef || binding.resolution.migrationPlanRef) issues.push(`${binding.contractBindingId} compatible mode carries adapter/migration facts`);
          if (assessment && !["exact", "compatible"].includes(assessment.outcome)) issues.push(`${binding.contractBindingId} compatible mode uses ${assessment.outcome}`);
        } else if (binding.resolution.mode === "adapter") {
          if (!binding.resolution.adapterArtifactRef) issues.push(`${binding.contractBindingId} adapter mode lacks exact artifact`);
          if (assessment && !sameExactRef(binding.resolution.adapterArtifactRef, assessment.adapterArtifactRef, exactArtifactKey)) issues.push(`${binding.contractBindingId} adapter artifact differs from assessment`);
          const plan = availableMigrationByExactKey.get(exactDocumentKey(binding.resolution.migrationPlanRef));
          if (!plan) issues.push(`${binding.contractBindingId} migration plan does not close`);
          else {
            if (!sameExactRef(plan.fromContract, producer.contractRef, exactContractKey) || !sameExactRef(plan.toContract, consumer.contractRef, exactContractKey)) {
              issues.push(`${binding.contractBindingId} migration direction is reversed`);
            }
            if (assessment && !sameExactRef(binding.resolution.migrationPlanRef, assessment.migrationPlanRef, exactDocumentKey)) {
              issues.push(`${binding.contractBindingId} migration plan differs from assessment`);
            }
            if (!sameExactRef(plan.migrationArtifactRef, binding.resolution.adapterArtifactRef, exactArtifactKey)
              || (assessment && !sameExactRef(plan.migrationArtifactRef, assessment.adapterArtifactRef, exactArtifactKey))) {
              issues.push(`${binding.contractBindingId} migration artifact differs across Recipe, Assessment, and Plan`);
            }
          }
        }
      }
    }
    for (const channel of contracts.flatMap((contract) => contract.channels)) {
      if (channel.connectionCardinality !== "one") continue;
      const count = candidateRecipe.contractBindings.filter((binding) => {
        const producer = resolveRecipeEndpoint(candidateRecipe, binding.producer);
        return producer.channelId === channel.channelId && producer.contractRef?.version === contracts.find((contract) => contract.channels.includes(channel)).identity.version;
      }).length;
      if (count > 1) issues.push(`${channel.channelId} exceeds one consumer connection`);
    }
    return issues;
  };
  for (const candidateRecipe of [recipe, targetRecipe]) {
    const issues = recipeIssues(candidateRecipe);
    issues.forEach((issue) => fail(`${candidateRecipe.id}@${candidateRecipe.version} ${issue}`));
    if (issues.length === 0) pass(`${candidateRecipe.id}@${candidateRecipe.version} Descriptor→Recipe→ABIR producer-consumer closure`);
  }

  const baseContractAspects = ["schema", "fieldSemantics", "protocol", "ordering", "delivery", "timeout", "error", "retry", "idempotency", "cancellation"];
  const applicableContractAspects = (sourceChannel, targetChannel) => [
    ...baseContractAspects,
    ...([sourceChannel?.interaction, targetChannel?.interaction].includes("stream") ? ["streaming"] : []),
    ...([sourceChannel?.interaction, targetChannel?.interaction].includes("state") ? ["state"] : []),
  ];
  const compatibilityRank = new Map(["exact", "compatible", "migrationRequired", "incompatible"].map((status, index) => [status, index]));
  const structureSlotsForChannel = (contract, channel) => {
    const ids = channel?.interaction === "message" ? [
      ["payload", channel.message.payloadStructureId],
      ...(channel.message.responseStructureId ? [["response", channel.message.responseStructureId]] : []),
      ["error", channel.message.errorStructureId],
    ] : channel?.interaction === "stream" ? [
      ["chunk", channel.stream.chunk.structureId],
      ["end", channel.stream.end.structureId],
      ["error", channel.stream.error.structureId],
    ] : channel?.interaction === "event" ? [
      ["event", channel.event.eventStructureId],
      ["error", channel.event.errorStructureId],
    ] : channel?.interaction === "state" ? [
      ["snapshot", channel.state.snapshotStructureId],
      ["delta", channel.state.deltaStructureId],
      ["error", channel.state.errorStructureId],
    ] : [];
    return ids.map(([slot, structureId]) => [
      slot,
      contract.structures.find((structure) => structure.structureId === structureId),
    ]);
  };
  const structureSchemaSignature = (contract, channel) => structureSlotsForChannel(contract, channel).map(([slot, structure]) => [
    slot,
    structure?.schema.schemaContentHash,
  ]);
  const structureFieldSignature = (contract, channel) => structureSlotsForChannel(contract, channel).map(([slot, structure]) => [
    slot,
    structure ? { fields: structure.fields, unknownFieldPolicy: structure.unknownFieldPolicy } : undefined,
  ]);
  const payloadStructureForChannel = (contract, channel) => structureSlotsForChannel(contract, channel)[0]?.[1];
  const errorSignature = (contract, channel) => {
    const errorStructure = structureSlotsForChannel(contract, channel).find(([slot]) => slot === "error")?.[1];
    return {
      handling: channel?.reliability.errorHandling,
      interactionError: channel?.interaction === "stream" ? channel.stream.error : undefined,
      structure: errorStructure ? {
        schemaContentHash: errorStructure.schema.schemaContentHash,
        fields: errorStructure.fields,
        unknownFieldPolicy: errorStructure.unknownFieldPolicy,
      } : undefined,
    };
  };
  const mandatoryAspectStatus = (aspect, sourceContract, targetContract, sourceChannel, targetChannel) => {
    if (aspect === "schema") {
      const policy = ({ mode, unknownFieldPolicy }) => ({ mode, unknownFieldPolicy });
      return isDeepStrictEqual(structureSchemaSignature(sourceContract, sourceChannel), structureSchemaSignature(targetContract, targetChannel))
        && isDeepStrictEqual(policy(sourceContract.compatibility), policy(targetContract.compatibility)) ? "exact" : "migrationRequired";
    }
    if (aspect === "fieldSemantics") {
      return isDeepStrictEqual(structureFieldSignature(sourceContract, sourceChannel), structureFieldSignature(targetContract, targetChannel))
        && isDeepStrictEqual(sourceContract.compatibility, targetContract.compatibility) ? "exact" : "migrationRequired";
    }
    const aspectValue = (channel) => {
      if (aspect === "protocol") return {
        interaction: channel.interaction,
        connectionCardinality: channel.connectionCardinality,
        protocol: channel.protocol,
      };
      if (aspect === "streaming") return channel.stream;
      if (aspect === "ordering") return channel[channel.interaction]?.ordering;
      if (aspect === "delivery") return channel.reliability.delivery;
      if (aspect === "timeout") return channel.reliability.timeout;
      if (aspect === "error") return errorSignature(sourceContract, channel);
      if (aspect === "retry") return channel.reliability.retry;
      if (aspect === "idempotency") return channel.reliability.idempotency;
      if (aspect === "cancellation") return channel.reliability.cancellation;
      if (aspect === "state") return channel.state;
      return undefined;
    };
    if (aspect === "error") return isDeepStrictEqual(errorSignature(sourceContract, sourceChannel), errorSignature(targetContract, targetChannel)) ? "exact" : "migrationRequired";
    if (aspect === "protocol" && !isDeepStrictEqual(
      { mode: sourceContract.compatibility.mode, protocolChange: sourceContract.compatibility.protocolChange },
      { mode: targetContract.compatibility.mode, protocolChange: targetContract.compatibility.protocolChange },
    )) return "migrationRequired";
    return isDeepStrictEqual(aspectValue(sourceChannel), aspectValue(targetChannel)) ? "exact" : "migrationRequired";
  };
  const dataLossApprovalWindowIssues = (plan, validity, approvalRecords = companions.dataLossApprovals) => {
    if (!plan || !validity) return [];
    const issues = [];
    const approvals = new Map(approvalRecords.map((approval) => [exactDocumentKey({
      id: approval.approvalId,
      version: approval.version,
      contentHash: approval.contentHash,
    }), approval]));
    for (const migration of plan.fieldMigrations.filter(({ dataLossPolicy }) => dataLossPolicy === "explicitDrop")) {
      const approval = approvals.get(exactDocumentKey(migration.dropApprovalRef));
      if (!approval) {
        issues.push("explicitDrop approval does not close for the assessment validity window");
        continue;
      }
      if (Date.parse(approval.decidedAt) > Date.parse(validity.assessedAt)) {
        issues.push("explicitDrop approval was decided after the assessment");
      }
      if (Date.parse(approval.expiresAt) < Date.parse(validity.expiresAt)) {
        issues.push("explicitDrop approval expires before the assessment evidence window");
      }
    }
    return issues;
  };

  const compatibilityAssessmentIssues = (assessment, overrides = {}) => {
    const issues = [];
    const source = contractByExactKey.get(exactContractKey(assessment.sourceContract));
    const target = contractByExactKey.get(exactContractKey(assessment.targetContract));
    if (!source || !target) return ["source or target contract does not close"];
    const assessmentProfile = profileByExactKey.get(exactDocumentKey(assessment.profileRef));
    const assessmentEnvironment = environmentByExactKey.get(exactDocumentKey(assessment.environmentRef));
    if (!assessmentProfile) issues.push("profileRef does not close");
    if (!assessmentEnvironment) issues.push("environmentRef does not close");
    issues.push(...profileEnvironmentIssues(assessmentProfile, assessmentEnvironment));
    if (Date.parse(assessment.assessedAt) >= Date.parse(assessment.expiresAt)) issues.push("assessment lifetime is empty or reversed");
    if (assessment.direction !== "sourceToTarget") issues.push("positive assessment must use explicit sourceToTarget direction");
    if (!unique(assessment.channelMappings.map(({ sourceChannelId, sourceRoleId, targetChannelId, targetRoleId }) => `${sourceChannelId}#${sourceRoleId}->${targetChannelId}#${targetRoleId}`))) issues.push("duplicate channel-role mapping");
    for (const mapping of assessment.channelMappings) {
      const sourceChannel = source.channels.find(({ channelId }) => channelId === mapping.sourceChannelId);
      const targetChannel = target.channels.find(({ channelId }) => channelId === mapping.targetChannelId);
      if (!sourceChannel) issues.push(`missing source channel ${mapping.sourceChannelId}`);
      if (!targetChannel) issues.push(`missing target channel ${mapping.targetChannelId}`);
      if (sourceChannel?.producerRoleId !== mapping.sourceRoleId || source.roles.find(({ roleId }) => roleId === mapping.sourceRoleId)?.kind !== "producer") issues.push(`source role ${mapping.sourceRoleId} is not the channel producer`);
      if (!targetChannel?.consumerRoleIds.includes(mapping.targetRoleId) || target.roles.find(({ roleId }) => roleId === mapping.targetRoleId)?.kind !== "consumer") issues.push(`target role ${mapping.targetRoleId} is not a channel consumer`);
    }
    const expectedAspectKeys = assessment.channelMappings.flatMap(({ sourceChannelId, sourceRoleId, targetChannelId, targetRoleId }) => {
      const sourceChannel = source.channels.find(({ channelId }) => channelId === sourceChannelId);
      const targetChannel = target.channels.find(({ channelId }) => channelId === targetChannelId);
      return applicableContractAspects(sourceChannel, targetChannel).map((aspect) => `${sourceChannelId}#${sourceRoleId}->${targetChannelId}#${targetRoleId}#${aspect}`);
    }).sort();
    const actualAspectKeys = assessment.aspectResults.map(({ sourceChannelId, sourceRoleId, targetChannelId, targetRoleId, aspect }) => `${sourceChannelId}#${sourceRoleId}->${targetChannelId}#${targetRoleId}#${aspect}`).sort();
    if (!isDeepStrictEqual(actualAspectKeys, expectedAspectKeys)) issues.push("channel-by-aspect matrix is incomplete or duplicated");
    for (const result of assessment.aspectResults) {
      for (const ref of result.evidenceArtifactRefs) if (!artifactByLooseKey.has(withoutHashKey(exactArtifactKey(ref)))) issues.push(`${result.aspect} evidence artifact does not close`);
      const sourceChannel = source.channels.find(({ channelId }) => channelId === result.sourceChannelId);
      const targetChannel = target.channels.find(({ channelId }) => channelId === result.targetChannelId);
      const mandatory = mandatoryAspectStatus(result.aspect, source, target, sourceChannel, targetChannel);
      if (compatibilityRank.get(result.status) < compatibilityRank.get(mandatory)) {
        issues.push(`${result.sourceChannelId}#${result.sourceRoleId}->${result.targetChannelId}#${result.targetRoleId} ${result.aspect} falsely reports ${result.status}; evidence requires ${mandatory}`);
      }
    }
    const worstStatus = assessment.aspectResults.reduce(
      (worst, result) => compatibilityRank.get(result.status) > compatibilityRank.get(worst) ? result.status : worst,
      "exact",
    );
    if (assessment.outcome !== worstStatus) issues.push(`outcome ${assessment.outcome} differs from worst aspect ${worstStatus}`);
    if (assessment.method === "exactDigest") {
      if (assessment.sourceContract.contentHash !== assessment.targetContract.contentHash) issues.push("exactDigest uses different contract hashes");
      if (assessment.outcome !== "exact") issues.push("exactDigest outcome is not exact");
    }
    if (assessment.method === "boundedChecker" && !artifactByLooseKey.has(withoutHashKey(exactArtifactKey(assessment.checkerArtifactRef)))) issues.push("bounded checker artifact does not close");
    if (assessment.method === "adapterEvidence" && !artifactByLooseKey.has(withoutHashKey(exactArtifactKey(assessment.adapterArtifactRef)))) issues.push("adapter artifact does not close");
    for (const ref of assessment.evidenceArtifactRefs ?? []) if (!artifactByLooseKey.has(withoutHashKey(exactArtifactKey(ref)))) issues.push("assessment evidence artifact does not close");
    if (assessment.outcome === "migrationRequired") {
      const availablePlans = overrides.migrationPlans ?? companions.contractMigrationPlans;
      const availablePlanByExactKey = new Map(availablePlans.map((plan) => [exactDocumentKey({
        id: plan.planId,
        version: plan.version,
        contentHash: plan.contentHash,
      }), plan]));
      const plan = availablePlanByExactKey.get(exactDocumentKey(assessment.migrationPlanRef));
      if (!plan) issues.push("migrationRequired outcome lacks exact plan");
      else if (!sameExactRef(plan.fromContract, assessment.sourceContract, exactContractKey) || !sameExactRef(plan.toContract, assessment.targetContract, exactContractKey)) {
        issues.push("migration plan direction differs from assessment");
      }
      if (plan) {
        for (const mapping of assessment.channelMappings) {
          if (!plan.channelMappings.some((candidate) => isDeepStrictEqual(candidate, mapping))) {
            issues.push("migration plan omits an assessed channel-role mapping");
          }
        }
        issues.push(...dataLossApprovalWindowIssues(
          plan,
          { assessedAt: assessment.assessedAt, expiresAt: assessment.expiresAt },
          overrides.dataLossApprovals ?? companions.dataLossApprovals,
        ));
      }
      if (plan && assessment.method === "adapterEvidence" && !sameExactRef(
        assessment.adapterArtifactRef,
        plan.migrationArtifactRef,
        exactArtifactKey,
      )) issues.push("assessment adapter artifact differs from migration plan artifact");
    } else if (assessment.migrationPlanRef) {
      issues.push("non-migration outcome carries migrationPlanRef");
    }
    if (assessment.method === "boundedChecker") {
      const checker = artifactByLooseKey.get(withoutHashKey(exactArtifactKey(assessment.checkerArtifactRef)));
      const evidence = artifactByLooseKey.get(withoutHashKey(exactArtifactKey(assessment.evidenceArtifactRefs[0])));
      if (checker?.verification.mode === "localFile" && evidence?.verification.mode === "localFile") {
        const sourceContractPath = contractPathByExactKey.get(exactContractKey(assessment.sourceContract));
        const targetContractPath = contractPathByExactKey.get(exactContractKey(assessment.targetContract));
        if (!sourceContractPath || !targetContractPath) issues.push("bounded checker Contract inputs do not close to local files");
        for (const mapping of assessment.channelMappings) {
          const execution = spawnSync(process.execPath, [
            checker.verification.localPath,
            sourceContractPath,
            targetContractPath,
            evidence.verification.localPath,
            mapping.sourceChannelId,
            mapping.sourceRoleId,
            mapping.targetChannelId,
            mapping.targetRoleId,
            assessment.outcome,
          ], { cwd: root, encoding: "utf8" });
          if (execution.status !== 0) issues.push(`bounded checker execution failed: ${execution.stderr || execution.stdout}`);
        }
      } else issues.push("bounded checker or corpus is not locally executable");
    }
    return issues;
  };
  const allCompatibilityIssues = companions.contractCompatibilityAssessments.flatMap((assessment) =>
    compatibilityAssessmentIssues(assessment).map((issue) => `${assessment.assessmentId} ${issue}`));
  allCompatibilityIssues.forEach((issue) => fail(`ContractCompatibilityAssessment ${issue}`));
  if (allCompatibilityIssues.length === 0) pass("directed channel-by-aspect ContractCompatibilityAssessments");

  const contractMigrationIssues = (plan, overrides = {}) => {
    const issues = [];
    const source = overrides.sourceContract ?? contractByExactKey.get(exactContractKey(plan.fromContract));
    const target = overrides.targetContract ?? contractByExactKey.get(exactContractKey(plan.toContract));
    if (!source || !target) return ["fromContract or toContract does not close"];
    const approvalRecords = overrides.dataLossApprovals ?? companions.dataLossApprovals;
    const approvalByExactKey = new Map(approvalRecords.map((approval) => [exactDocumentKey({
      id: approval.approvalId,
      version: approval.version,
      contentHash: approval.contentHash,
    }), approval]));
    if (plan.direction !== "fromTo") issues.push("migration direction is not fromTo");
    if (!unique(plan.channelMappings.map(({ sourceChannelId, sourceRoleId, targetChannelId, targetRoleId }) => `${sourceChannelId}#${sourceRoleId}->${targetChannelId}#${targetRoleId}`))) issues.push("duplicate channel-role mapping");
    if (!unique(plan.fieldMigrations.map(({ sourceStructureId, sourcePointer }) => `${sourceStructureId}#${sourcePointer}`))) issues.push("duplicate source field migration");
    if (plan.resumable && (!plan.idempotent || plan.checkpointPolicy.mode === "none")) issues.push("resumable plan lacks idempotent checkpoints");
    if (plan.checkpointPolicy.mode !== "none" && !artifactByLooseKey.has(withoutHashKey(exactArtifactKey(plan.checkpointPolicy.checkpointArtifactRef)))) issues.push("checkpoint artifact does not close");
    for (const mapping of plan.channelMappings) {
      const sourceChannel = source.channels.find(({ channelId }) => channelId === mapping.sourceChannelId);
      const targetChannel = target.channels.find(({ channelId }) => channelId === mapping.targetChannelId);
      if (!sourceChannel) issues.push(`missing source channel ${mapping.sourceChannelId}`);
      if (!targetChannel) issues.push(`missing target channel ${mapping.targetChannelId}`);
      if (sourceChannel?.producerRoleId !== mapping.sourceRoleId || source.roles.find(({ roleId }) => roleId === mapping.sourceRoleId)?.kind !== "producer") issues.push(`source migration role ${mapping.sourceRoleId} is not producer`);
      if (!targetChannel?.consumerRoleIds.includes(mapping.targetRoleId) || target.roles.find(({ roleId }) => roleId === mapping.targetRoleId)?.kind !== "consumer") issues.push(`target migration role ${mapping.targetRoleId} is not consumer`);
      const sourceSlots = new Map(structureSlotsForChannel(source, sourceChannel));
      const targetSlots = new Map(structureSlotsForChannel(target, targetChannel));
      const slots = new Set([...sourceSlots.keys(), ...targetSlots.keys()]);
      for (const slot of slots) {
        const sourceStructure = sourceSlots.get(slot);
        const targetStructure = targetSlots.get(slot);
        if (!sourceStructure || !targetStructure) {
          issues.push(`migration ${slot} structure does not resolve on both channel sides`);
          continue;
        }
        if (sourceStructure.unknownFieldPolicy !== targetStructure.unknownFieldPolicy) {
          issues.push(`migration ${slot} unknown-field policy differs without structure-level semantics`);
        }
        const sourceFields = new Map(sourceStructure.fields.map((field) => [field.path, field]));
        const targetFields = new Map(targetStructure.fields.map((field) => [field.path, field]));
        for (const [fieldPath, sourceField] of sourceFields) {
          const targetField = targetFields.get(fieldPath);
          const fieldMigration = plan.fieldMigrations.find((candidate) =>
            candidate.sourceStructureId === sourceStructure.structureId && candidate.sourcePointer === fieldPath);
          if (!targetField && !fieldMigration) issues.push(`source-only field ${sourceStructure.structureId}${fieldPath} in ${slot} lacks explicit migration`);
          if (targetField && !isDeepStrictEqual(sourceField, targetField) && !fieldMigration) {
            issues.push(`changed shared field ${sourceStructure.structureId}${fieldPath} in ${slot} lacks explicit migration`);
          }
          if (targetField?.required && fieldMigration?.dataLossPolicy === "explicitDrop") {
            issues.push(`required target field ${targetStructure.structureId}${fieldPath} cannot be explicitly dropped`);
          }
        }
        for (const [fieldPath, targetField] of targetFields) {
          if (targetField.required && !sourceFields.has(fieldPath) && !plan.fieldMigrations.some((candidate) =>
            candidate.targetStructureId === targetStructure.structureId && candidate.targetPointer === fieldPath)) {
            issues.push(`target-required field ${targetStructure.structureId}${fieldPath} in ${slot} lacks explicit migration`);
          }
        }
      }
    }
    for (const migration of plan.fieldMigrations) {
      const sourceStructure = source.structures.find(({ structureId }) => structureId === migration.sourceStructureId);
      if (!sourceStructure || !structureFieldPaths(sourceStructure).has(migration.sourcePointer)) issues.push(`missing source field ${migration.sourceStructureId}${migration.sourcePointer}`);
      if (migration.dataLossPolicy === "explicitDrop") {
        if (plan.lossPolicy !== "explicitDrop") issues.push("field drop exceeds overall lossPolicy");
        if (migration.targetStructureId || migration.targetPointer) issues.push("explicitDrop falsely identifies a target field");
        if (!migration.dropApprovalRef) issues.push("explicitDrop lacks exact approval");
        const approval = approvalByExactKey.get(exactDocumentKey(migration.dropApprovalRef));
        if (!approval) issues.push("explicitDrop approval does not resolve to a DataLossApproval");
        else {
          if (approval.decision !== "approved") issues.push("explicitDrop approval decision is not approved");
          if (!sameExactRef(approval.sourceContract, plan.fromContract, exactContractKey)
            || !sameExactRef(approval.targetContract, plan.toContract, exactContractKey)) issues.push("explicitDrop approval Contract direction differs from plan");
          if (approval.sourceStructureId !== migration.sourceStructureId || approval.sourcePointer !== migration.sourcePointer) {
            issues.push("explicitDrop approval field scope differs from migration");
          }
          if (Date.parse(approval.decidedAt) >= Date.parse(approval.expiresAt)) issues.push("explicitDrop approval lifetime is empty or reversed");
        }
      } else {
        const targetStructure = target.structures.find(({ structureId }) => structureId === migration.targetStructureId);
        if (!targetStructure || !structureFieldPaths(targetStructure).has(migration.targetPointer)) issues.push(`missing target field ${migration.targetStructureId}${migration.targetPointer}`);
      }
      if (migration.transformArtifactRef && !artifactByLooseKey.has(withoutHashKey(exactArtifactKey(migration.transformArtifactRef)))) issues.push("field transform artifact does not close");
    }
    issues.push(...dataLossApprovalWindowIssues(plan, overrides.assessmentValidity, approvalRecords));
    for (const mapping of plan.stateStructureMappings) {
      const sourceStructure = source.structures.find(({ structureId }) => structureId === mapping.sourceStructureId);
      const targetStructure = target.structures.find(({ structureId }) => structureId === mapping.targetStructureId);
      if (!sourceStructure) issues.push(`missing source state structure ${mapping.sourceStructureId}`);
      if (!targetStructure) issues.push(`missing target state structure ${mapping.targetStructureId}`);
      if (!sourceStructure || !structureFieldPaths(sourceStructure).has(mapping.sourceVersionField)) issues.push(`missing source state version field ${mapping.sourceVersionField}`);
      if (!targetStructure || !structureFieldPaths(targetStructure).has(mapping.targetVersionField)) issues.push(`missing target state version field ${mapping.targetVersionField}`);
      for (const [contract, structure, fieldPointer, label] of [
        [source, sourceStructure, mapping.sourceVersionField, "source"],
        [target, targetStructure, mapping.targetVersionField, "target"],
      ]) {
        if (!structure) continue;
        const schemaDocument = schemaDocumentByRef.get(structure.schema.schemaRef);
        const fieldSchema = schemaPropertyAt(schemaDocument, fieldPointer);
        if (fieldSchema?.type !== "integer") issues.push(`${label} state version field is not an integer`);
        const fieldSemantics = structure.fields.find(({ path: candidate }) => candidate === fieldPointer);
        if (!fieldSemantics?.required || fieldSemantics.nullable) issues.push(`${label} state version field is not required non-null`);
      }
    }
    if (!unique(plan.stateStructureMappings.map(({ sourceStructureId, targetStructureId }) => `${sourceStructureId}->${targetStructureId}`))) issues.push("duplicate state structure mapping");
    for (const ref of plan.conformanceSuiteRefs) if (!suiteByExactKey.has(exactDocumentKey(ref))) issues.push(`suite ${ref.id} does not close`);
    for (const ref of [plan.migrationArtifactRef, plan.rollbackArtifactRef]) if (!artifactByLooseKey.has(withoutHashKey(exactArtifactKey(ref)))) issues.push(`migration artifact ${ref.artifactId} does not close`);
    return issues;
  };
  const allMigrationIssues = companions.contractMigrationPlans.flatMap((plan) =>
    contractMigrationIssues(plan).map((issue) => `${plan.planId} ${issue}`));
  allMigrationIssues.forEach((issue) => fail(`ContractMigrationPlan ${issue}`));
  if (allMigrationIssues.length === 0) pass("directed, checkpointed, loss-explicit ContractMigrationPlans");

  const artifactRecordForExactRef = (ref) => {
    const record = ref && artifactByLooseKey.get(withoutHashKey(exactArtifactKey(ref)));
    return record?.contentHash === ref.contentHash ? record : undefined;
  };
  const localPathForExactArtifact = (ref) => {
    const record = artifactRecordForExactRef(ref);
    if (record?.verification.mode !== "localFile") return undefined;
    const resolved = path.resolve(root, record.verification.localPath);
    return resolved.startsWith(`${root}${path.sep}`) ? resolved : undefined;
  };
  const readJsonExactArtifact = (ref) => {
    const localPath = localPathForExactArtifact(ref);
    return localPath ? JSON.parse(fs.readFileSync(localPath, "utf8")) : undefined;
  };
  const executeAdapterRoundTrip = async (assessment, plan) => {
    const issues = [];
    if (!sameExactRef(assessment.adapterArtifactRef, plan.migrationArtifactRef, exactArtifactKey)) {
      issues.push("assessment adapter artifact differs from migration plan artifact");
    }
    const adapterPath = localPathForExactArtifact(plan.migrationArtifactRef);
    const rollbackPath = localPathForExactArtifact(plan.rollbackArtifactRef);
    const checkpointPath = localPathForExactArtifact(plan.checkpointPolicy.checkpointArtifactRef);
    if (!adapterPath) issues.push("migration adapter does not resolve to exact local bytes");
    if (!rollbackPath) issues.push("migration rollback does not resolve to exact local bytes");
    if (!checkpointPath) issues.push("migration checkpoint does not resolve to exact local bytes");
    const providerPayload = readJsonExactArtifact(responseEvent.contractExchange.producer.payloadArtifactRef);
    const consumerResponsePayload = readJsonExactArtifact(responseEvent.contractExchange.consumer.payloadArtifactRef);
    const modelRequestPayload = readJsonExactArtifact(requestEvent.contractExchange.producer.payloadArtifactRef);
    if (!providerPayload || !consumerResponsePayload || !modelRequestPayload) issues.push("adapter payload inputs do not resolve through RuntimeEvent exact refs");
    let adapterModule;
    let rollbackModule;
    let adaptedPayload;
    let restoredPayload;
    let checkpoint;
    if (adapterPath && rollbackPath && providerPayload) {
      try {
        adapterModule = await import(`${pathToFileURL(adapterPath).href}?digest=${plan.migrationArtifactRef.contentHash}`);
        rollbackModule = await import(`${pathToFileURL(rollbackPath).href}?digest=${plan.rollbackArtifactRef.contentHash}`);
        if (typeof adapterModule.adaptModelResponse !== "function") issues.push("migration artifact does not export adaptModelResponse");
        if (typeof rollbackModule.rollbackModelResponse !== "function") issues.push("rollback artifact does not export rollbackModelResponse");
        if (typeof adapterModule.adaptModelResponse === "function") {
          adaptedPayload = adapterModule.adaptModelResponse(providerPayload, (value) => { checkpoint = value; });
        }
        if (adaptedPayload && typeof rollbackModule.rollbackModelResponse === "function") {
          restoredPayload = rollbackModule.rollbackModelResponse(adaptedPayload, checkpoint);
        }
      } catch (error) {
        issues.push(`adapter execution failed: ${error.message}`);
      }
    }
    const expectedCheckpoint = checkpointPath ? JSON.parse(fs.readFileSync(checkpointPath, "utf8")) : undefined;
    if (!isDeepStrictEqual(restoredPayload, providerPayload)) issues.push("adapter rollback does not restore explicit-drop data from checkpoint");
    if (!isDeepStrictEqual(checkpoint, expectedCheckpoint)) issues.push("materialized migration checkpoint differs from forward adapter output");
    if (!isDeepStrictEqual(adaptedPayload, consumerResponsePayload)) issues.push("adapter output differs from exact consumer payload artifact");
    return {
      issues,
      adapterModule,
      rollbackModule,
      providerPayload,
      modelRequestPayload,
      consumerResponsePayload,
      adaptedPayload,
      restoredPayload,
      checkpoint,
    };
  };
  const adapterAssessment = companions.contractCompatibilityAssessments.find(({ method }) => method === "adapterEvidence");
  const adapterPlan = migrationByExactKey.get(exactDocumentKey(adapterAssessment.migrationPlanRef));
  const adapterExecution = await executeAdapterRoundTrip(adapterAssessment, adapterPlan);
  adapterExecution.issues.forEach((issue) => fail(`adapter round trip ${issue}`));
  if (adapterExecution.issues.length === 0) pass("forward adapter and checkpoint-backed rollback round trip through exact ArtifactRecords");
  const {
    adapterModule,
    providerPayload,
    modelRequestPayload,
    consumerResponsePayload,
    adaptedPayload,
    checkpoint,
  } = adapterExecution;

  const payloadAjv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(payloadAjv);
  for (const schemaDocument of schemaDocumentByRef.values()) payloadAjv.addSchema(schemaDocument);
  const payloadForParty = (party) => {
    const record = artifactByLooseKey.get(withoutHashKey(exactArtifactKey(party.payloadArtifactRef)));
    if (!record || record.verification.mode !== "localFile") return { record, bytes: undefined, value: undefined };
    const bytes = fs.readFileSync(path.join(root, record.verification.localPath));
    let value;
    try { value = JSON.parse(bytes.toString("utf8")); } catch { /* Reported as a payload validation issue. */ }
    return { record, bytes, value };
  };
  const schemaIdentityMatches = (party, structure) => structure
    && party.payloadSchema.schemaRef === structure.schema.schemaRef
    && party.payloadSchema.schemaContentHash === structure.schema.schemaContentHash
    && sameExactRef(party.payloadSchema.schemaBundleRef, structure.schema.schemaBundleRef, exactDocumentKey);
  const exchangePartyIssues = (label, party, endpoint) => {
    const issues = [];
    if (!sameExactRef(party.partRef, partRefFromDescriptor(endpoint.descriptor), exactPartKey)) issues.push(`${label} partRef differs from Descriptor`);
    if (!sameExactRef(party.packageRef, endpoint.standardBinding?.packageRef, exactDocumentKey)) issues.push(`${label} packageRef differs from Recipe binding`);
    if (!sameExactRef(party.contractRef, endpoint.contractRef, exactContractKey)) issues.push(`${label} contractRef differs from resolved Recipe endpoint`);
    if (party.channelId !== endpoint.channelId) issues.push(`${label} channelId differs from resolved Recipe endpoint`);
    if (party.roleId !== endpoint.roleId) issues.push(`${label} roleId differs from resolved Recipe endpoint`);
    const structure = payloadStructureForChannel(endpoint.contract, endpoint.channel);
    if (party.structureId !== structure?.structureId) issues.push(`${label} structureId differs from Contract channel`);
    if (!schemaIdentityMatches(party, structure)) issues.push(`${label} payload schema identity differs from Contract structure`);
    const { record, bytes, value } = payloadForParty(party);
    if (!record) issues.push(`${label} payload artifact does not close`);
    else {
      if (record.contentHash !== party.payloadArtifactRef.contentHash) issues.push(`${label} payloadArtifactRef digest drift`);
      if (!bytes || sha256(bytes) !== party.payloadDigest) issues.push(`${label} payloadDigest differs from serialized bytes`);
    }
    const validatePayload = payloadAjv.getSchema(party.payloadSchema.schemaRef);
    if (!validatePayload || value === undefined || !validatePayload(value)) issues.push(`${label} payload fails its exact schema`);
    return { issues, value };
  };
  function partRefFromDescriptor(descriptor) {
    return descriptor ? {
      partId: descriptor.identity.partId,
      version: descriptor.identity.version,
      contentHash: descriptor.contentHash,
    } : undefined;
  }
  const runtimeExchangeIssues = (candidateEvents) => {
    const issues = [];
    const byRun = Map.groupBy(candidateEvents, ({ runId }) => runId);
    for (const [runId, runEvents] of byRun) {
      const sequences = runEvents.map(({ sequence }) => sequence).sort((left, right) => left - right);
      if (!isDeepStrictEqual(sequences, sequences.map((_, index) => index))) issues.push(`${runId} sequence is not contiguous from zero`);
    }
    const messageById = new Map();
    const eventById = new Map(candidateEvents.map((event) => [event.eventId, event]));
    for (const event of candidateEvents) {
      const expectedRecipe = event.runId.endsWith("-01") ? recipe : targetRecipe;
      if (!sameExactRef(event.subject.abirRef, { id: abir.id, version: abir.version, contentHash: abir.contentHash }, exactDocumentKey)) issues.push(`${event.eventId} subject ABIR ref drift`);
      if (!sameExactRef(event.subject.recipeRef, { id: expectedRecipe.id, version: expectedRecipe.version, contentHash: expectedRecipe.contentHash }, exactDocumentKey)) issues.push(`${event.eventId} subject Recipe ref drift`);
      const producerArtifact = artifactByLooseKey.get(withoutHashKey(exactArtifactKey(event.producer.artifactRef)));
      if (!producerArtifact || producerArtifact.contentHash !== event.producer.artifactRef.contentHash) issues.push(`${event.eventId} producer artifact does not close`);
      if (event.eventType === "model.requested" && event.payload.messagesDigest !== sha256(canonicalJson(modelRequestPayload.messages))) issues.push(`${event.eventId} messagesDigest differs from materialized messages`);
      if (event.eventType === "model.responded" && event.payload.outputDigest !== sha256(canonicalJson(consumerResponsePayload.content))) issues.push(`${event.eventId} outputDigest differs from materialized output`);
      if (event.derivation) {
        const algorithmArtifact = artifactByLooseKey.get(withoutHashKey(exactArtifactKey(event.derivation.algorithmArtifactRef)));
        if (!algorithmArtifact || algorithmArtifact.contentHash !== event.derivation.algorithmArtifactRef.contentHash) issues.push(`${event.eventId} derivation algorithm artifact does not close`);
        for (const sourceEventId of event.derivation.sourceEventIds) {
          const sourceEvent = eventById.get(sourceEventId);
          if (!sourceEvent || sourceEvent.runId !== event.runId || sourceEvent.sequence >= event.sequence) issues.push(`${event.eventId} derivation source ${sourceEventId} is not an earlier same-run event`);
        }
      }
      if (event.subject.standardPartBindingId) {
        const standardBinding = expectedRecipe.standardPartBindings.find(({ bindingId }) => bindingId === event.subject.standardPartBindingId);
        if (!standardBinding) issues.push(`${event.eventId} subject StandardPartBinding does not close`);
        else {
          if (event.subject.objectId !== standardBinding.targetObjectId) issues.push(`${event.eventId} subject objectId differs from Recipe binding targetObjectId`);
          if (!sameExactRef(event.subject.partRef, standardBinding.descriptorRef, exactPartKey)) issues.push(`${event.eventId} subject partRef differs from Recipe binding`);
          if (!sameExactRef(event.subject.packageRef, standardBinding.packageRef, exactDocumentKey)) issues.push(`${event.eventId} subject packageRef differs from Recipe binding`);
          const object = Object.values(abir.objects).flat().find(({ id }) => id === event.subject.objectId);
          const port = object?.ports?.find(({ id }) => id === event.subject.portId);
          if (event.subject.portId && !port) issues.push(`${event.eventId} subject portId does not exist on its ABIR object`);
          if (event.contractExchange && port?.contractChannel) {
            const matchingParty = [event.contractExchange.producer, event.contractExchange.consumer].find((party) =>
              sameExactRef(party.partRef, event.subject.partRef, exactPartKey));
            if (!matchingParty
              || !sameExactRef(port.contractChannel.contractRef, matchingParty.contractRef, exactContractKey)
              || port.contractChannel.channelId !== matchingParty.channelId
              || port.contractChannel.roleId !== matchingParty.roleId) {
              issues.push(`${event.eventId} subject ABIR port Contract role differs from its exchange party`);
            }
          }
        }
      }
      const exchange = event.contractExchange;
      if (!exchange) continue;
      if (messageById.has(exchange.messageId)) issues.push(`${event.eventId} repeats messageId ${exchange.messageId}`);
      messageById.set(exchange.messageId, event);
      const eventRecipe = recipeByExactKey.get(exactDocumentKey(event.subject.recipeRef));
      const binding = eventRecipe?.contractBindings.find(({ contractBindingId }) => contractBindingId === exchange.contractBindingId);
      if (!binding) {
        issues.push(`${event.eventId} contractBindingId does not close to subject Recipe`);
        continue;
      }
      const producer = resolveRecipeEndpoint(eventRecipe, binding.producer);
      const consumer = resolveRecipeEndpoint(eventRecipe, binding.consumer);
      const producerPayload = exchangePartyIssues(`${event.eventId} producer`, exchange.producer, producer);
      const consumerPayload = exchangePartyIssues(`${event.eventId} consumer`, exchange.consumer, consumer);
      issues.push(...producerPayload.issues, ...consumerPayload.issues);
      if (producer.packageRecord?.packageId === consumer.packageRecord?.packageId) issues.push(`${event.eventId} does not cross two packages`);
      if (!isDeepStrictEqual(exchange.resolution, binding.resolution)) issues.push(`${event.eventId} resolution differs from Recipe contractBinding`);
      const channels = [producer.channel, consumer.channel].filter(Boolean);
      const idempotencyModes = channels.map((channel) => channel.reliability.idempotency.mode);
      const idempotencyRequired = idempotencyModes.some((mode) => ["required", "transport"].includes(mode))
        || channels.some((channel) => ["atLeastOnce", "effectivelyOnce"].includes(channel.reliability.delivery));
      if (idempotencyRequired && !exchange.idempotencyKey) issues.push(`${event.eventId} lacks required idempotencyKey`);
      if (idempotencyModes.every((mode) => mode === "none") && exchange.idempotencyKey) issues.push(`${event.eventId} supplies idempotencyKey for mode none`);
      for (const [channel, payload] of [[producer.channel, producerPayload.value], [consumer.channel, consumerPayload.value]]) {
        const keyPointer = channel?.reliability.idempotency.keyPointer;
        if (keyPointer && exchange.idempotencyKey !== resolvePointer(payload, keyPointer)) issues.push(`${event.eventId} idempotencyKey differs from ${keyPointer}`);
        if (channel && exchange.attempt > channel.reliability.retry.maxAttempts) issues.push(`${event.eventId} attempt exceeds retry limit`);
      }
      const ordered = channels.some((channel) => channel[channel.interaction]?.ordering.mode !== "none");
      if (ordered && (exchange.orderingDomain === undefined || exchange.orderingSequence === undefined)) issues.push(`${event.eventId} ordered channel lacks domain/sequence`);
      if (!ordered && (exchange.orderingDomain !== undefined || exchange.orderingSequence !== undefined)) issues.push(`${event.eventId} unordered channel invents domain/sequence`);
      const streamed = channels.some(({ interaction }) => interaction === "stream");
      if (streamed && !exchange.stream) issues.push(`${event.eventId} stream channel lacks lifecycle position`);
      if (!streamed && exchange.stream) issues.push(`${event.eventId} message channel carries stream lifecycle`);
      if (exchange.resolution.mode === "adapter") {
        if (!isDeepStrictEqual(adapterModule.adaptModelResponse(producerPayload.value, () => undefined), consumerPayload.value)) issues.push(`${event.eventId} adapter output differs from consumer payload bytes`);
      } else if (!isDeepStrictEqual(producerPayload.value, consumerPayload.value)) {
        issues.push(`${event.eventId} non-adapter exchange changes payload bytes`);
      }
    }
    for (const event of candidateEvents.filter(({ contractExchange }) => contractExchange?.causationMessageId)) {
      const exchange = event.contractExchange;
      const cause = messageById.get(exchange.causationMessageId);
      if (!cause) issues.push(`${event.eventId} causation message does not resolve`);
      else if (cause.runId !== event.runId || cause.contractExchange.correlationId !== exchange.correlationId || cause.sequence >= event.sequence) issues.push(`${event.eventId} causation is outside its earlier correlation chain`);
    }
    const streamGroups = Map.groupBy(
      candidateEvents.filter(({ contractExchange }) => contractExchange?.stream),
      ({ contractExchange }) => contractExchange.stream.streamId,
    );
    for (const [streamId, streamEvents] of streamGroups) {
      const orderedEvents = [...streamEvents].sort((left, right) => left.sequence - right.sequence);
      let state = "beforeOpen";
      let nextItem = 0;
      for (const { contractExchange: { stream } } of orderedEvents) {
        if (state === "terminal") issues.push(`${streamId} emits ${stream.phase} after terminal phase`);
        if (stream.phase === "open") {
          if (state !== "beforeOpen") issues.push(`${streamId} opens more than once`);
          state = "open";
        } else if (stream.phase === "item") {
          if (state !== "open") issues.push(`${streamId} item occurs before open`);
          if (stream.itemSequence !== nextItem) issues.push(`${streamId} item sequence gap`);
          nextItem += 1;
        } else {
          if (state !== "open") issues.push(`${streamId} terminates before open`);
          state = "terminal";
        }
      }
    }
    return issues;
  };
  const baseRuntimeIssues = runtimeExchangeIssues(events);
  baseRuntimeIssues.forEach((issue) => fail(`RuntimeEvent ${issue}`));
  if (baseRuntimeIssues.length === 0) pass("RuntimeEvent exact Recipe/ABIR bindings, dual payload schemas, reliability, and causality");

  const adapterSourceSchema = payloadAjv.getSchema(responseEvent.contractExchange.producer.payloadSchema.schemaRef);
  const adapterTargetSchema = payloadAjv.getSchema(responseEvent.contractExchange.consumer.payloadSchema.schemaRef);
  check(adapterSourceSchema(providerPayload), "adapter source payload does not validate against the source schema");
  check(adapterTargetSchema(adaptedPayload), "adapter output does not validate against the target schema");
  check(!Object.hasOwn(adaptedPayload, "providerMetadata") && Object.hasOwn(checkpoint, "providerMetadata"), "explicit semantic loss is not checkpointed");
  pass("adapterEvidence source-schema → transform → target-schema execution");

  const artifactRecordForRef = (ref) => artifactByLooseKey.get(withoutHashKey(exactArtifactKey(ref)));
  const runSuiteChecker = (vector, result, resultPathOverride, inputPathOverride) => {
    const input = artifactRecordForRef(vector.inputArtifactRef);
    const expected = artifactRecordForRef(vector.expectedArtifactRef);
    const checker = artifactRecordForRef(vector.checkerArtifactRef);
    const evidence = artifactRecordForRef(result.evidenceArtifactRef);
    if (![input, expected, checker, evidence].every((record) => record?.verification.mode === "localFile")) return { status: null, stderr: "non-local suite artifact" };
    return spawnSync(process.execPath, [
      checker.verification.localPath,
      inputPathOverride ?? input.verification.localPath,
      expected.verification.localPath,
      resultPathOverride ?? evidence.verification.localPath,
    ], { cwd: root, encoding: "utf8" });
  };
  const suite = companions.conformanceSuites[0];
  const report = companions.conformanceReports[0];
  const resultByVectorId = new Map(report.results.map((result) => [result.testVectorId, result]));
  for (const vector of suite.testVectors) {
    const result = resultByVectorId.get(vector.testVectorId);
    const execution = result ? runSuiteChecker(vector, result) : { status: null, stderr: "missing result" };
    check(execution.status === 0, `${vector.testVectorId} checker failed: ${execution.stderr || execution.stdout || "not executable"}`);
  }
  check(
    unique(report.results.map(({ evidenceArtifactRef }) => exactArtifactKey(evidenceArtifactRef))),
    "required suite vectors must have independent result artifacts",
  );
  pass(`${suite.testVectors.length} independent executable suite vectors and result artifacts`);

  const checkerMutations = new Map([
    ["test.surface-contract", (value) => { value.assertions.schemaClosed = false; }],
    ["test.chain-execution", (value) => { value.events[0].eventDigest = `sha256:${"0".repeat(64)}`; }],
    ["test.configuration", (value) => { value.schemaValid = false; }],
    ["test.permission", (value) => { value.secretValueExposed = true; }],
    ["test.migration", (value) => { value.roundTripRestored = false; }],
    ["test.acceptance", (value) => { value.responseMatched = false; }],
    ["test.rollback", (value) => { value.exactRestoration = false; }],
    ["test.reliability-recovery", (value) => { value.recoveredAttempt = 3; }],
    ["test.order-error-rejection", (value) => { value.reasons.pop(); }],
  ]);
  const checkerMutationDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "wgp-abf-checker-"));
  try {
    for (const vector of suite.testVectors) {
      const result = resultByVectorId.get(vector.testVectorId);
      const evidence = artifactRecordForRef(result.evidenceArtifactRef);
      const mutated = readJson(evidence.verification.localPath);
      checkerMutations.get(vector.testVectorId)(mutated);
      const mutationPath = path.join(checkerMutationDirectory, `${vector.testVectorId}.json`);
      fs.writeFileSync(mutationPath, `${JSON.stringify(mutated, null, 2)}\n`);
      const execution = runSuiteChecker(vector, result, mutationPath);
      if (execution.status === 0) fail(`${vector.testVectorId} checker accepted its directed result mutation`);
      else pass(`rejected checker mutation: ${vector.testVectorId}`);
    }

    const chainVector = suite.testVectors.find(({ testVectorId }) => testVectorId === "test.chain-execution");
    const chainReportResult = resultByVectorId.get(chainVector.testVectorId);
    const chainInputRecord = artifactRecordForRef(chainVector.inputArtifactRef);
    const mutatedChainInput = readJson(chainInputRecord.verification.localPath);
    const mutatedChainEvents = clone(events);
    mutatedChainEvents.find(({ eventId }) => eventId === requestEvent.eventId).contractExchange.consumer.payloadDigest = `sha256:${"0".repeat(64)}`;
    const mutatedEventsPath = path.join(checkerMutationDirectory, "chain-events-payload-drift.jsonl");
    fs.writeFileSync(mutatedEventsPath, `${mutatedChainEvents.map((event) => JSON.stringify(event)).join("\n")}\n`);
    mutatedChainInput.eventsPath = mutatedEventsPath;
    const mutatedChainInputPath = path.join(checkerMutationDirectory, "chain-input-payload-drift.json");
    fs.writeFileSync(mutatedChainInputPath, `${JSON.stringify(mutatedChainInput, null, 2)}\n`);
    const mutatedChainExecution = runSuiteChecker(chainVector, chainReportResult, undefined, mutatedChainInputPath);
    if (mutatedChainExecution.status === 0) fail("test.chain-execution checker accepted RuntimeEvent/payload digest drift");
    else pass("rejected checker source mutation: test.chain-execution RuntimeEvent/payload digest drift");

    const permissionVector = suite.testVectors.find(({ testVectorId }) => testVectorId === "test.permission");
    const permissionReportResult = resultByVectorId.get(permissionVector.testVectorId);
    const permissionInputRecord = artifactRecordForRef(permissionVector.inputArtifactRef);
    const mutatedPermissionInput = readJson(permissionInputRecord.verification.localPath);
    const mutatedPermissionDescriptor = clone(readJson(mutatedPermissionInput.descriptorPaths[0]));
    mutatedPermissionDescriptor.requirements.permissions[0].resources = ["credential.unmapped-key"];
    const mutatedPermissionDescriptorPath = path.join(checkerMutationDirectory, "permission-descriptor-unmapped.json");
    fs.writeFileSync(mutatedPermissionDescriptorPath, `${JSON.stringify(mutatedPermissionDescriptor, null, 2)}\n`);
    mutatedPermissionInput.descriptorPaths[0] = mutatedPermissionDescriptorPath;
    const mutatedPermissionInputPath = path.join(checkerMutationDirectory, "permission-input-unmapped.json");
    fs.writeFileSync(mutatedPermissionInputPath, `${JSON.stringify(mutatedPermissionInput, null, 2)}\n`);
    const mutatedPermissionExecution = runSuiteChecker(permissionVector, permissionReportResult, undefined, mutatedPermissionInputPath);
    if (mutatedPermissionExecution.status === 0) fail("test.permission checker accepted an unmapped Descriptor permission tuple");
    else pass("rejected checker source mutation: test.permission unmapped Descriptor permission tuple");
  } finally {
    fs.rmSync(checkerMutationDirectory, { recursive: true, force: true });
  }

  const reportPartyIssues = (label, actual, expected) => {
    const issues = [];
    if (!sameExactRef(actual.partRef, partRefFromDescriptor(expected.descriptor), exactPartKey)) issues.push(`${label} partRef drift`);
    if (!sameExactRef(actual.packageRef, expected.standardBinding?.packageRef, exactDocumentKey)) issues.push(`${label} packageRef drift`);
    if (!sameExactRef(actual.contractRef, expected.surface?.contractRef, exactContractKey)) issues.push(`${label} contractRef drift`);
    if (actual.channelId !== expected.assemblyBinding?.channelId) issues.push(`${label} channelId drift`);
    if (actual.roleId !== expected.assemblyBinding?.contractRoleId) issues.push(`${label} roleId drift`);
    return issues;
  };
  const selectionBindingKeys = (selections) => selections.flatMap(({ contractRef: selectedContract, bindings }) =>
    bindings.map(({ channelId, roleId }) => `${exactContractKey(selectedContract)}|${channelId}|${roleId}`));
  const conformanceReportIssues = (candidate, overrides = {}) => {
    const issues = [];
    const candidateSuite = overrides.suite ?? suiteByExactKey.get(exactDocumentKey(candidate.suiteRef));
    const candidateProfile = profileByExactKey.get(exactDocumentKey(candidate.profileRef));
    const candidateEnvironment = companions.environments.find((environment) =>
      exactDocumentKey({ id: environment.environmentId, version: environment.version, contentHash: environment.contentHash }) === exactDocumentKey(candidate.environmentRef));
    if (!candidateSuite) return ["suiteRef does not close"];
    if (!candidateProfile) issues.push("profileRef does not close");
    if (!candidateEnvironment) issues.push("environmentRef does not close");
    issues.push(...profileEnvironmentIssues(candidateProfile, candidateEnvironment));
    if (!artifactRecordForRef(candidate.executorArtifactRef)) issues.push("executor artifact does not close");
    if (Date.parse(candidate.executedAt) >= Date.parse(candidate.expiresAt)) issues.push("report validity interval is empty");
    if (!unique(candidate.chainBindings.map(({ contractBindingId }) => contractBindingId))) issues.push("duplicate chain binding");
    const reportBindingKeys = new Set();
    for (const chainBinding of candidate.chainBindings) {
      const candidateRecipe = recipeByExactKey.get(exactDocumentKey(chainBinding.recipeRef));
      const recipeBinding = candidateRecipe?.contractBindings.find(({ contractBindingId }) => contractBindingId === chainBinding.contractBindingId);
      if (!candidateRecipe || !recipeBinding) {
        issues.push(`${chainBinding.contractBindingId} does not close to exact Recipe binding`);
        continue;
      }
      const producer = resolveRecipeEndpoint(candidateRecipe, recipeBinding.producer);
      const consumer = resolveRecipeEndpoint(candidateRecipe, recipeBinding.consumer);
      issues.push(...reportPartyIssues(`${chainBinding.contractBindingId} producer`, chainBinding.producer, producer));
      issues.push(...reportPartyIssues(`${chainBinding.contractBindingId} consumer`, chainBinding.consumer, consumer));
      if (!isDeepStrictEqual(chainBinding.resolution, recipeBinding.resolution)) issues.push(`${chainBinding.contractBindingId} resolution differs from Recipe`);
      for (const party of [chainBinding.producer, chainBinding.consumer]) reportBindingKeys.add(`${exactContractKey(party.contractRef)}|${party.channelId}|${party.roleId}`);
    }
    const vectorIds = candidateSuite.testVectors.map(({ testVectorId }) => testVectorId).sort();
    const resultIds = candidate.results.map(({ testVectorId }) => testVectorId).sort();
    if (!isDeepStrictEqual(resultIds, vectorIds)) issues.push("results do not cover the Suite exactly once");
    const counts = { passed: 0, failed: 0, skipped: 0 };
    const eventById = new Map(events.map((event) => [event.eventId, event]));
    const runtimeBindingKeys = new Set();
    for (const result of candidate.results) {
      counts[result.status] += 1;
      if (Date.parse(result.startedAt) > Date.parse(result.finishedAt)) issues.push(`${result.testVectorId} time window is reversed`);
      if (Date.parse(result.finishedAt) > Date.parse(candidate.executedAt)) issues.push(`${result.testVectorId} finishes after report execution`);
      if (["passed", "failed"].includes(result.status) && !artifactRecordForRef(result.evidenceArtifactRef)) issues.push(`${result.testVectorId} evidence artifact does not close`);
      const vector = candidateSuite.testVectors.find(({ testVectorId }) => testVectorId === result.testVectorId);
      if (vector?.required && result.status !== "passed") issues.push(`${result.testVectorId} required vector did not pass`);
      if (vector?.aspects.includes("chainExecution")) {
        if (!result.runtimeEventRefs?.length) issues.push("chainExecution result lacks exact RuntimeEvent refs");
        for (const eventRef of result.runtimeEventRefs ?? []) {
          const event = eventById.get(eventRef.eventId);
          if (!event || sha256(canonicalJson(event)) !== eventRef.eventDigest) {
            issues.push(`${result.testVectorId} RuntimeEvent digest drift`);
            continue;
          }
          const observedTimes = [event.occurredAt, event.observedAt, event.contractExchange?.producer.observedAt, event.contractExchange?.consumer.observedAt].filter(Boolean).map(Date.parse);
          if (observedTimes.some((timestamp) => timestamp < Date.parse(result.startedAt) || timestamp > Date.parse(result.finishedAt))) issues.push(`${result.testVectorId} RuntimeEvent falls outside result window`);
          if (event.contractExchange) {
            for (const party of [event.contractExchange.producer, event.contractExchange.consumer]) runtimeBindingKeys.add(`${exactContractKey(party.contractRef)}|${party.channelId}|${party.roleId}`);
          }
        }
        const applicableKeys = new Set(selectionBindingKeys(vector.applicableContractChannels));
        for (const applicableKey of applicableKeys) {
          if (!reportBindingKeys.has(applicableKey)) issues.push(`Report chainBindings omit applicable Suite binding ${applicableKey}`);
          if (!runtimeBindingKeys.has(applicableKey)) issues.push(`Runtime exchanges omit applicable Suite binding ${applicableKey}`);
        }
        for (const requiredKey of selectionBindingKeys(candidateProfile?.requiredContractChannels ?? [])) {
          if (!applicableKeys.has(requiredKey)) issues.push(`chainExecution Suite omits required profile binding ${requiredKey}`);
          if (!reportBindingKeys.has(requiredKey)) issues.push(`Report chainBindings omit required profile binding ${requiredKey}`);
          if (!runtimeBindingKeys.has(requiredKey)) issues.push(`Runtime exchanges omit required profile binding ${requiredKey}`);
        }
      } else if (result.runtimeEventRefs) issues.push(`${result.testVectorId} carries unrelated RuntimeEvent refs`);
    }
    if (overrides.requireI3Evidence) {
      issues.push("v0.6 reference validator has no structured RuntimeEvent failure/recovery proof model; I3 is not claimable");
      const passedVectorIds = new Set(candidate.results.filter(({ status }) => status === "passed").map(({ testVectorId }) => testVectorId));
      const passedVectors = candidateSuite.testVectors.filter(({ testVectorId }) => passedVectorIds.has(testVectorId));
      if (!passedVectors.some(({ aspects }) => aspects.includes("chainExecution"))) issues.push("I3 report lacks a passed chainExecution vector");
      for (const requiredKey of selectionBindingKeys(candidateProfile?.requiredContractChannels ?? [])) {
        const scenarioVectors = passedVectors.filter((vector) =>
          ["invalid", "failure", "recovery"].includes(vector.scenario)
          && selectionBindingKeys(vector.applicableContractChannels).includes(requiredKey));
        if (scenarioVectors.length === 0) issues.push(`I3 report lacks failure/recovery execution for required binding ${requiredKey}`);
        if (scenarioVectors.some((vector) => !candidate.results.find(({ testVectorId }) => testVectorId === vector.testVectorId)?.runtimeEventRefs?.length)) {
          issues.push(`I3 failure/recovery evidence for ${requiredKey} is not backed by exact RuntimeEvents`);
        }
      }
    }
    const expectedSummary = {
      total: candidate.results.length,
      ...counts,
      outcome: counts.failed > 0 ? "failed" : counts.skipped > 0 ? "incomplete" : "passed",
    };
    if (!isDeepStrictEqual(candidate.summary, expectedSummary)) issues.push("summary differs from executed results");
    const statusRecords = companions.evidenceStatusRecords
      .filter(({ reportRef }) => sameExactRef(reportRef, { id: candidate.reportId, version: candidate.version, contentHash: candidate.contentHash }, exactDocumentKey))
      .sort((left, right) => right.revision - left.revision);
    if (statusRecords[0]?.action !== "active") issues.push("latest EvidenceStatusRecord is not active");
    return issues;
  };
  const reportIssues = conformanceReportIssues(report);
  reportIssues.forEach((issue) => fail(`ConformanceReport ${issue}`));
  if (reportIssues.length === 0) pass("ConformanceReport exact Recipe chains, runtime windows, and suite results (not I3 lifecycle proof)");

  const profileIssues = (candidate) => {
    const issues = [];
    const candidateDescriptors = descriptors.filter(({ identity }) => identity.partKind === candidate.targetPartKind);
    if (!unique(selectionBindingKeys(candidate.requiredContractChannels))) issues.push("duplicate required contract channel-role pair");
    for (const selection of candidate.requiredContractChannels) {
      const contract = contractByExactKey.get(exactContractKey(selection.contractRef));
      if (!contract) {
        issues.push("required contractRef does not close");
        continue;
      }
      for (const binding of selection.bindings) {
        const channel = contract.channels.find(({ channelId }) => channelId === binding.channelId);
        const role = contract.roles.find(({ roleId }) => roleId === binding.roleId);
        if (!channel || !role || ![channel.producerRoleId, ...channel.consumerRoleIds].includes(binding.roleId)) issues.push(`${binding.channelId}#${binding.roleId} does not close to the Contract`);
        const exposed = candidateDescriptors.some((descriptor) => descriptor.assembly.surfaces.some((surface) =>
          sameExactRef(surface.contractRef, selection.contractRef, exactContractKey)
          && surface.bindings.some(({ channelId, contractRoleId }) => channelId === binding.channelId && contractRoleId === binding.roleId)));
        if (!exposed) issues.push(`${binding.channelId}#${binding.roleId} is not exposed by target part-kind descriptors`);
      }
    }
    for (const suiteRef of candidate.requiredSuiteRefs) if (!suiteByExactKey.has(exactDocumentKey(suiteRef))) issues.push("required Suite does not close");
    return issues;
  };
  const allProfileIssues = companions.compatibilityProfiles.flatMap((candidate) => profileIssues(candidate).map((issue) => `${candidate.profileId} ${issue}`));
  allProfileIssues.forEach((issue) => fail(`CompatibilityProfile ${issue}`));
  if (allProfileIssues.length === 0) pass("CompatibilityProfile exact channel-role pairs and Descriptor exposure");

  const replacementPlanByExactKey = new Map(companions.replacementPlans.map((plan) => [exactDocumentKey({
    id: plan.planId,
    version: plan.version,
    contentHash: plan.contentHash,
  }), plan]));
  const reportIsActive = (candidateReport) => companions.evidenceStatusRecords
    .filter(({ reportRef }) => sameExactRef(reportRef, { id: candidateReport.reportId, version: candidateReport.version, contentHash: candidateReport.contentHash }, exactDocumentKey))
    .sort((left, right) => right.revision - left.revision)[0]?.action === "active";
  const reportsForRefs = (refs) => refs.map((ref) => reportByExactKey.get(exactDocumentKey(ref))).filter(Boolean);
  const replacementPlanIssues = (plan, { requireI4Evidence = false } = {}) => {
    const issues = [];
    const source = descriptorByExactKey.get(exactPartKey(plan.fromPart));
    const target = descriptorByExactKey.get(exactPartKey(plan.toPart));
    const candidateProfile = profileByExactKey.get(exactDocumentKey(plan.profileRef));
    if (!source || !target || !candidateProfile) return ["fromPart, toPart, or profileRef does not close"];
    if (!sameExactRef(plan.fromPackageRef, source.packageRef, exactDocumentKey)) issues.push("fromPackageRef differs from source Descriptor");
    if (!sameExactRef(plan.toPackageRef, target.packageRef, exactDocumentKey)) issues.push("toPackageRef differs from target Descriptor");
    if (plan.fromPackageRef.contentHash === plan.toPackageRef.contentHash) issues.push("replacement does not change implementation package bytes");
    if (!candidateProfile.replacementPolicy.allowedModes.includes(plan.replacementMode)) issues.push("replacementMode is outside Profile policy");
    if (!sameExactRef(plan.recipePrecondition, { id: recipe.id, version: recipe.version, contentHash: recipe.contentHash }, exactDocumentKey)) issues.push("recipePrecondition differs from base Recipe");
    if (!isDeepStrictEqual([...plan.riskAssessmentIds].sort(), diff.riskAssessments.map(({ id }) => id).sort())) issues.push("riskAssessmentIds differ from RecipeDiff risks");
    if (candidateProfile.replacementPolicy.rollbackRequired && (plan.rollbackReportRefs.length === 0 || plan.failurePolicy.onStepFailure !== "rollback" || plan.failurePolicy.onAcceptanceFailure !== "rollback")) issues.push("rollback policy is incomplete");
    if (candidateProfile.replacementPolicy.migrationEvidenceRequired && plan.migrationReportRefs.length === 0) issues.push("migration evidence required by Profile is missing");
    for (const requirement of plan.requiredAdapterCapabilities) {
      const claim = abir.sourceClaims.find(({ id }) => id === requirement.sourceClaimId);
      if (!claim) issues.push(`adapter capability claim ${requirement.sourceClaimId} is missing`);
      else {
        if (!requirement.fieldScope.every((field) => claim.fieldScope.includes(field))) issues.push(`${requirement.sourceClaimId} field scope is not covered`);
        if (!requirement.operationCapabilities.every((capability) => claim.operationCapabilities.includes(capability))) issues.push(`${requirement.sourceClaimId} operation capability is not covered`);
      }
    }
    const vectorIds = new Set(suite.testVectors.map(({ testVectorId }) => testVectorId));
    for (const step of plan.steps) for (const vectorId of step.verificationTestVectorIds) if (!vectorIds.has(vectorId)) issues.push(`${step.stepId} references missing test vector ${vectorId}`);
    const reportGroups = [
      ["migration", plan.migrationReportRefs, "migration"],
      ["acceptance", plan.acceptanceReportRefs, "behavioral"],
      ["rollback", plan.rollbackReportRefs, requireI4Evidence ? "lifecycle" : "migration"],
    ];
    for (const [label, refs, aspect] of reportGroups) {
      const reports = reportsForRefs(refs);
      if (reports.length !== refs.length || reports.length === 0) issues.push(`${label} report refs do not close`);
      for (const candidateReport of reports) {
        if (!reportIsActive(candidateReport) || candidateReport.summary.outcome !== "passed") issues.push(`${label} report is not active and passed`);
        if (!sameExactRef(candidateReport.profileRef, plan.profileRef, exactDocumentKey)) issues.push(`${label} report uses a different Profile`);
        const reportSuite = suiteByExactKey.get(exactDocumentKey(candidateReport.suiteRef));
        const passedAspects = new Set(reportSuite?.testVectors.filter((vector) =>
          candidateReport.results.some((result) => result.testVectorId === vector.testVectorId && result.status === "passed")).flatMap(({ aspects }) => aspects));
        if (!passedAspects.has(aspect)) issues.push(`${label} report does not prove ${aspect}`);
      }
    }
    return issues;
  };
  const allReplacementIssues = companions.replacementPlans.flatMap((plan) => replacementPlanIssues(plan).map((issue) => `${plan.planId} ${issue}`));
  allReplacementIssues.forEach((issue) => fail(`ReplacementPlan ${issue}`));
  if (allReplacementIssues.length === 0) pass("ReplacementPlan profile, package, RecipeDiff, capability, risk, and recipe-compensation report closure (not I4 rollback evidence)");
  const interchangeabilityAssessmentIssues = (candidate, overrides = {}) => {
    const issues = [];
    const source = overrides.sourceDescriptor ?? descriptorByExactKey.get(exactPartKey(candidate.sourcePart));
    const target = overrides.targetDescriptor ?? descriptorByExactKey.get(exactPartKey(candidate.targetPart));
    const candidateProfile = profileByExactKey.get(exactDocumentKey(candidate.profileRef));
    if (!source || !target || !candidateProfile) return ["source, target, or profile exact ref does not close"];
    const candidateEnvironment = overrides.environment ?? environmentByExactKey.get(exactDocumentKey(candidate.environmentRef));
    const environmentIssues = profileEnvironmentIssues(candidateProfile, candidateEnvironment, [source, target]);
    issues.push(...environmentIssues);
    if (source.identity.partKind !== target.identity.partKind || source.identity.partKind !== candidateProfile.targetPartKind) issues.push("I0 Closed category/Profile gate failed");
    if (source.identity.partId === target.identity.partId) issues.push("the positive replacement fixture must use two distinct implementation partIds");
    let derivedLevel = "I0";
    const requiredKeys = new Set(selectionBindingKeys(candidateProfile.requiredContractChannels));
    const descriptorBindingKeys = (descriptor) => new Set(descriptor.assembly.surfaces.flatMap((surface) => surface.bindings.map((binding) =>
      `${exactContractKey(surface.contractRef)}|${binding.channelId}|${binding.contractRoleId}`)));
    const sourceBindings = descriptorBindingKeys(source);
    const targetBindings = descriptorBindingKeys(target);
    if ([...requiredKeys].every((key) => sourceBindings.has(key) && targetBindings.has(key))) derivedLevel = "I1";
    const contractAssessments = overrides.contractAssessments
      ?? candidate.contractCompatibilityAssessmentRefs.map((ref) => assessmentByExactKey.get(exactDocumentKey(ref))).filter(Boolean);
    const assessmentCovers = (key) => contractAssessments.some((assessment) => {
      const [contractIdentity, channelId, roleId] = key.split("|");
      return assessment.channelMappings.some(({ sourceChannelId, sourceRoleId, targetChannelId, targetRoleId }) => {
        const sourceContractIdentity = exactContractKey(assessment.sourceContract);
        const targetContractIdentity = exactContractKey(assessment.targetContract);
        const sourceContract = contractByExactKey.get(sourceContractIdentity);
        const targetContract = contractByExactKey.get(targetContractIdentity);
        const sourceChannel = sourceContract?.channels.find(({ channelId: id }) => id === sourceChannelId);
        const targetChannel = targetContract?.channels.find(({ channelId: id }) => id === targetChannelId);
        return (contractIdentity === sourceContractIdentity && channelId === sourceChannelId && roleId === sourceRoleId && sourceChannel?.producerRoleId === sourceRoleId)
          || (contractIdentity === targetContractIdentity && channelId === targetChannelId && roleId === targetRoleId && targetChannel?.consumerRoleIds.includes(targetRoleId));
      });
    });
    const assessmentSupportsDataAlignment = (assessment) => {
      if (compatibilityAssessmentIssues(assessment).length > 0) return false;
      if (["exact", "compatible"].includes(assessment.outcome)) return true;
      if (assessment.outcome !== "migrationRequired" || assessment.method !== "adapterEvidence") return false;
      const migrationPlan = migrationByExactKey.get(exactDocumentKey(assessment.migrationPlanRef));
      return Boolean(migrationPlan)
        && contractMigrationIssues(migrationPlan).length === 0
        && artifactByLooseKey.has(withoutHashKey(exactArtifactKey(assessment.adapterArtifactRef)));
    };
    if (contractAssessments.some(({ outcome }) => outcome === "incompatible")) issues.push("I2 evidence includes an incompatible Contract assessment");
    if (derivedLevel === "I1"
      && environmentIssues.length === 0
      && candidate.contractCompatibilityAssessmentRefs.length > 0
      && candidate.contractCompatibilityAssessmentRefs.length === contractAssessments.length
      && contractAssessments.every((assessment) => assessmentSupportsDataAlignment(assessment)
        && sameExactRef(assessment.profileRef, candidate.profileRef, exactDocumentKey)
        && sameExactRef(assessment.environmentRef, candidate.environmentRef, exactDocumentKey)
        && Date.parse(assessment.assessedAt) <= Date.parse(candidate.assessedAt)
        && Date.parse(assessment.expiresAt) >= Date.parse(candidate.expiresAt))
      && [...requiredKeys].every(assessmentCovers)) derivedLevel = "I2";
    const reportTargetsCandidate = (candidateReport) => {
      const targetPackageRef = target.packageRef;
      const targetKeys = new Set(candidateReport.chainBindings.flatMap((binding) => [binding.producer, binding.consumer])
        .filter((party) => sameExactRef(party.partRef, candidate.targetPart, exactPartKey)
          && sameExactRef(party.packageRef, targetPackageRef, exactDocumentKey))
        .map((party) => `${exactContractKey(party.contractRef)}|${party.channelId}|${party.roleId}`));
      return [...requiredKeys].every((key) => targetKeys.has(key));
    };
    const i3Reports = overrides.i3Reports
      ?? candidate.levelEvidence.I3.map((ref) => reportByExactKey.get(exactDocumentKey(ref))).filter(Boolean);
    if (i3Reports.some((candidateReport) => !reportTargetsCandidate(candidateReport))) issues.push("I3 report omits target part/package on required Profile bindings");
    if (derivedLevel === "I2" && i3Reports.length > 0 && i3Reports.every((candidateReport) =>
      reportIsActive(candidateReport)
      && conformanceReportIssues(candidateReport, { requireI3Evidence: true }).length === 0
      && reportTargetsCandidate(candidateReport)
      && candidateReport.summary.outcome === "passed"
      && sameExactRef(candidateReport.profileRef, candidate.profileRef, exactDocumentKey)
      && sameExactRef(candidateReport.environmentRef, candidate.environmentRef, exactDocumentKey)
      && Date.parse(candidateReport.executedAt) <= Date.parse(candidate.assessedAt)
      && Date.parse(candidateReport.expiresAt) >= Date.parse(candidate.expiresAt))) derivedLevel = "I3";
    const plan = candidate.replacementPlanRef ? replacementPlanByExactKey.get(exactDocumentKey(candidate.replacementPlanRef)) : undefined;
    const i4Reports = candidate.levelEvidence.I4.map((ref) => reportByExactKey.get(exactDocumentKey(ref))).filter(Boolean);
    if (derivedLevel === "I3" && plan && i4Reports.length > 0 && replacementPlanIssues(plan, { requireI4Evidence: true }).length === 0) {
      const planReports = [...plan.migrationReportRefs, ...plan.acceptanceReportRefs, ...plan.rollbackReportRefs];
      const i4EvidenceKeys = new Set(candidate.levelEvidence.I4.map(exactDocumentKey));
      const planCloses = sameExactRef(plan.fromPart, candidate.sourcePart, exactPartKey)
        && sameExactRef(plan.toPart, candidate.targetPart, exactPartKey)
        && sameExactRef(plan.fromPackageRef, source.packageRef, exactDocumentKey)
        && sameExactRef(plan.toPackageRef, target.packageRef, exactDocumentKey)
        && plan.fromPackageRef.contentHash !== plan.toPackageRef.contentHash
        && planReports.every((ref) => reportByExactKey.has(exactDocumentKey(ref)) && i4EvidenceKeys.has(exactDocumentKey(ref)))
        && i4Reports.every((candidateReport) => reportIsActive(candidateReport)
          && candidateReport.summary.outcome === "passed"
          && sameExactRef(candidateReport.profileRef, candidate.profileRef, exactDocumentKey)
          && sameExactRef(candidateReport.environmentRef, candidate.environmentRef, exactDocumentKey)
          && Date.parse(candidateReport.executedAt) <= Date.parse(candidate.assessedAt)
          && Date.parse(candidateReport.expiresAt) >= Date.parse(candidate.expiresAt));
      if (planCloses) derivedLevel = "I4";
    }
    if (candidate.assessedLevel !== derivedLevel) issues.push(`assessedLevel ${candidate.assessedLevel} differs from maximum derived ${derivedLevel}`);
    if (["I0", "I1", "I2"].some((level) => candidate.levelEvidence[level].length > 0)) issues.push("I0-I2 must not carry executed reports");
    if (Date.parse(candidate.assessedAt) >= Date.parse(candidate.expiresAt)) issues.push("assessment validity interval is empty");
    return issues;
  };
  const assessmentIssues = companions.interchangeabilityAssessments.flatMap((candidate) =>
    interchangeabilityAssessmentIssues(candidate).map((issue) => `${candidate.assessmentId} ${issue}`));
  assessmentIssues.forEach((issue) => fail(`InterchangeabilityAssessment ${issue}`));
  if (assessmentIssues.length === 0) pass("maximum I2 derivation through Closed → Contract-exposed → Data-aligned; I3/I4 overclaim is rejected");

  const setPointer = (document, pointer, value) => {
    const tokens = pointerTokens(pointer);
    const parent = tokens.slice(0, -1).reduce((current, token) => current[token], document);
    parent[tokens.at(-1)] = clone(value);
  };
  const recipeDiffIssues = (candidate) => {
    const issues = [];
    if (candidate.recipeId !== recipe.id || candidate.baseVersion !== recipe.version || candidate.baseContentHash !== recipe.contentHash) issues.push("base Recipe identity drift");
    if (candidate.targetVersion !== targetRecipe.version || candidate.targetContentHash !== targetRecipe.contentHash) issues.push("target Recipe identity drift");
    if (!unique(candidate.operations.map(({ id }) => id))) issues.push("duplicate operation id");
    const applied = clone(recipe);
    for (const operation of candidate.operations) {
      const current = resolvePointer(recipe, operation.path);
      if (operation.precondition.contentHash !== sha256(canonicalJson(current))) issues.push(`${operation.id} precondition digest drift`);
      if (!candidate.riskAssessments.some(({ affectedPaths }) => affectedPaths.includes(operation.path))) issues.push(`${operation.id} lacks path risk coverage`);
      setPointer(applied, operation.path, operation.value);
    }
    applied.version = targetRecipe.version;
    applied.contentHash = targetRecipe.contentHash;
    if (!isDeepStrictEqual(applied, targetRecipe)) issues.push("operations do not materialize the exact target Recipe");
    const restored = clone(targetRecipe);
    for (const operation of [...candidate.operations].reverse()) {
      const current = resolvePointer(targetRecipe, operation.path);
      if (operation.compensation.precondition.contentHash !== sha256(canonicalJson(current))) issues.push(`${operation.id} compensation precondition digest drift`);
      setPointer(restored, operation.compensation.path, operation.compensation.value);
    }
    restored.version = recipe.version;
    restored.contentHash = recipe.contentHash;
    if (!isDeepStrictEqual(restored, recipe)) issues.push("compensations do not restore the exact base Recipe");
    const plan = replacementPlanByExactKey.get(exactDocumentKey(candidate.replacementPlanRef.plan));
    if (!plan || !sameExactRef(candidate.replacementPlanRef.standardPart, plan.fromPart, exactPartKey)) issues.push("replacement plan does not close to source part");
    return issues;
  };
  const diffIssues = recipeDiffIssues(diff);
  diffIssues.forEach((issue) => fail(`RecipeDiff ${issue}`));
  if (diffIssues.length === 0) pass("RecipeDiff exact preconditions, target materialization, risks, and compensation round trip");

  const evaluationIssues = (candidate) => {
    const issues = [];
    if (candidate.baseline.recipeId !== recipe.id || candidate.baseline.recipeVersion !== recipe.version || candidate.baseline.recipeContentHash !== recipe.contentHash) issues.push("baseline Recipe identity drift");
    if (candidate.candidate.recipeId !== targetRecipe.id || candidate.candidate.recipeVersion !== targetRecipe.version || candidate.candidate.recipeContentHash !== targetRecipe.contentHash) issues.push("candidate Recipe identity drift");
    if (candidate.protocol.fixture.contentHash !== canonicalHashWithout(candidate.protocol.fixture, "contentHash")) issues.push("fixture inline digest drift");
    if (candidate.protocol.modelStreamControl.contentHash !== canonicalHashWithout(candidate.protocol.modelStreamControl, "contentHash")) issues.push("model-stream inline digest drift");
    for (const control of candidate.protocol.environmentControls) {
      const artifact = artifactByLooseKey.get(withoutHashKey(exactArtifactKey(control.artifactRef)));
      if (!artifact || artifact.contentHash !== control.valueDigest || control.artifactRef.contentHash !== control.valueDigest) issues.push(`${control.name} environment-control artifact digest drift`);
    }
    const environmentDigest = sha256(canonicalJson(candidate.protocol.environmentControls));
    const eventById = new Map(events.map((event) => [event.eventId, event]));
    const referencedEventIds = [];
    for (const trial of candidate.trials) {
      const expectedRecipe = trial.variant === "baseline" ? recipe : targetRecipe;
      if (trial.recipeContentHash !== expectedRecipe.contentHash) issues.push(`${trial.trialId} Recipe digest drift`);
      if (trial.environmentDigest !== environmentDigest) issues.push(`${trial.trialId} environment digest drift`);
      if (trial.modelStreamDigest !== candidate.protocol.modelStreamControl.contentHash) issues.push(`${trial.trialId} model-stream digest drift`);
      for (const eventId of trial.eventIds) {
        const event = eventById.get(eventId);
        if (!event || event.runId !== trial.runId || !sameExactRef(event.subject.recipeRef, { id: expectedRecipe.id, version: expectedRecipe.version, contentHash: expectedRecipe.contentHash }, exactDocumentKey)) issues.push(`${trial.trialId} event ${eventId} does not close`);
        referencedEventIds.push(eventId);
      }
    }
    if (!isDeepStrictEqual([...referencedEventIds].sort(), [...eventById.keys()].sort())) issues.push("trial event closure is incomplete or duplicated");
    for (const result of candidate.results) {
      for (const variant of ["baseline", "candidate"]) {
        const values = candidate.trials.filter((trial) => trial.variant === variant).map((trial) => trial.metricValues[result.metricId]);
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
        if (result[variant].n !== values.length || result[variant].value !== mean) issues.push(`${result.metricId} ${variant} aggregate drift`);
      }
      if (result.absoluteDelta !== result.candidate.value - result.baseline.value) issues.push(`${result.metricId} absolute delta drift`);
      const relative = result.baseline.value === 0 ? 0 : (result.candidate.value - result.baseline.value) / result.baseline.value;
      if (result.relativeDelta !== relative) issues.push(`${result.metricId} relative delta drift`);
    }
    for (const claim of candidate.claims) for (const eventId of claim.evidenceEventIds) if (!eventById.has(eventId)) issues.push(`${claim.id} evidence event is missing`);
    return issues;
  };
  const baseEvaluationIssues = evaluationIssues(evaluation);
  baseEvaluationIssues.forEach((issue) => fail(`Evaluation ${issue}`));
  if (baseEvaluationIssues.length === 0) pass("illustrative Evaluation recipe, trial, event, inline-digest, and aggregate closure");

  const mutatedBundle = clone(companions.schemaBundles[0]);
  mutatedBundle.entries[0].schemaContentHash = `sha256:${"0".repeat(64)}`;
  expectIssue("SchemaBundle entry/content tamper", schemaBundleIssues([mutatedBundle]), /digest drift|closure target/);

  const mutatedContractField = clone(contracts[0]);
  mutatedContractField.structures[0].fields[0].nullable = !mutatedContractField.structures[0].fields[0].nullable;
  expectIssue("Contract field nullability drift", contractIssues(mutatedContractField), /nullability semantics drift/);

  const retryWithoutIdempotency = clone(contracts[0]);
  const retryChannel = retryWithoutIdempotency.channels.find(({ channelId }) => channelId === "channel.model-request");
  retryChannel.reliability.idempotency.mode = "none";
  delete retryChannel.reliability.idempotency.keyPointer;
  delete retryChannel.reliability.idempotency.scope;
  delete retryChannel.reliability.idempotency.retentionMs;
  expectIssue("retry without idempotency", contractIssues(retryWithoutIdempotency), /retry lacks idempotency/);

  const requestSourceChannel = contracts[0].channels.find(({ channelId }) => channelId === "channel.model-request");
  const changedTimeoutChannel = clone(contracts[1].channels.find(({ channelId }) => channelId === "channel.model-request"));
  changedTimeoutChannel.reliability.timeout.durationMs += 1;
  check(mandatoryAspectStatus("timeout", contracts[0], contracts[1], requestSourceChannel, changedTimeoutChannel) === "migrationRequired", "timeout drift was not conservatively rejected");
  pass("rejected mutation: timeout semantic drift");

  const profileRoleMismatch = clone(companions.compatibilityProfiles[0]);
  profileRoleMismatch.requiredContractChannels[0].bindings[0].roleId = "role.model-provider-input";
  expectIssue("Profile channel-role mismatch", profileIssues(profileRoleMismatch), /not exposed by target part-kind descriptors/);

  const abirDirectionMismatch = clone(abir);
  abirDirectionMismatch.objects.components[0].ports.find(({ id }) => id === "model.request").direction = "in";
  expectIssue("ABIR role/direction mismatch", abirIssues(abirDirectionMismatch), /in port is not consumer role/);

  const abirMissingEdge = clone(abir);
  abirMissingEdge.edges = abirMissingEdge.edges.filter(({ id }) => id !== "edge.model-request");
  expectIssue("Recipe contractBinding without ABIR edge", recipeIssues(targetRecipe, abirMissingEdge), /no producer-to-consumer ABIR edge/);

  const missingRequiredMapping = clone(targetRecipe);
  missingRequiredMapping.standardPartBindings[0].surfaceMappings
    .find(({ surfaceId }) => surfaceId === "surface.model-client").portMappings
    .splice(0, 1);
  expectIssue("missing required Descriptor assembly mapping", recipeIssues(missingRequiredMapping), /required mapping count is 0/);

  const missingRequiredChatBinding = clone(targetRecipe);
  missingRequiredChatBinding.contractBindings = missingRequiredChatBinding.contractBindings.filter(
    ({ contractBindingId }) => contractBindingId !== "contract-binding.chat-input",
  );
  expectIssue(
    "missing required Descriptor Contract resolution",
    recipeIssues(missingRequiredChatBinding),
    /chat\.input required Contract endpoint count is 0/,
  );

  const reversedResolution = clone(targetRecipe);
  reversedResolution.contractBindings.find(({ contractBindingId }) => contractBindingId === "contract-binding.model-request")
    .resolution.compatibilityAssessmentRef = {
    id: companions.contractCompatibilityAssessments[1].assessmentId,
    version: companions.contractCompatibilityAssessments[1].version,
    contentHash: companions.contractCompatibilityAssessments[1].contentHash,
  };
  expectIssue("request binding uses reverse assessment", recipeIssues(reversedResolution), /assessment direction is reversed/);

  const alternateMigrationPlan = clone(adapterPlan);
  alternateMigrationPlan.planId = "contract-migration.model-provider-to-orchestrator-alternate";
  alternateMigrationPlan.contentHash = canonicalHashWithout(alternateMigrationPlan, "contentHash");
  const swappedRecipeMigrationPlan = clone(targetRecipe);
  const swappedRecipeAdapterBinding = swappedRecipeMigrationPlan.contractBindings.find(
    ({ contractBindingId }) => contractBindingId === "contract-binding.model-response",
  );
  swappedRecipeAdapterBinding.resolution.migrationPlanRef = {
    id: alternateMigrationPlan.planId,
    version: alternateMigrationPlan.version,
    contentHash: alternateMigrationPlan.contentHash,
  };
  expectIssue(
    "Recipe adapter rejects a different same-direction migration plan",
    recipeIssues(swappedRecipeMigrationPlan, abir, {
      migrationPlans: [...companions.contractMigrationPlans, alternateMigrationPlan],
    }),
    /migration plan differs from assessment/,
  );

  const validateRecipeResolutionSchema = ajv.getSchema(schemas.get("spec/assembly-recipe.schema.json").$id);
  const recipeAdapterWithoutPlan = clone(targetRecipe);
  delete recipeAdapterWithoutPlan.contractBindings.find(
    ({ contractBindingId }) => contractBindingId === "contract-binding.model-response",
  ).resolution.migrationPlanRef;
  check(
    !validateRecipeResolutionSchema(recipeAdapterWithoutPlan)
      && validateRecipeResolutionSchema.errors.some(({ instancePath, keyword, params }) =>
        instancePath.endsWith("/resolution") && keyword === "required" && params.missingProperty === "migrationPlanRef"),
    "AssemblyRecipe Schema accepted adapter resolution without migrationPlanRef",
  );
  pass("rejected mutation: AssemblyRecipe adapter resolution without migrationPlanRef");

  const recipeCompatibleWithAdapter = clone(targetRecipe);
  const compatibleRecipeResolution = recipeCompatibleWithAdapter.contractBindings.find(
    ({ contractBindingId }) => contractBindingId === "contract-binding.model-request",
  ).resolution;
  compatibleRecipeResolution.adapterArtifactRef = clone(swappedRecipeAdapterBinding.resolution.adapterArtifactRef);
  check(
    !validateRecipeResolutionSchema(recipeCompatibleWithAdapter)
      && validateRecipeResolutionSchema.errors.some(({ instancePath }) => instancePath.endsWith("/resolution/adapterArtifactRef")),
    "AssemblyRecipe Schema accepted adapter facts in compatible resolution",
  );
  pass("rejected mutation: AssemblyRecipe compatible resolution carrying adapter facts");

  const runtimeAdapterWithoutPlan = clone(responseEvent);
  delete runtimeAdapterWithoutPlan.contractExchange.resolution.migrationPlanRef;
  check(
    !validateRuntime(runtimeAdapterWithoutPlan)
      && validateRuntime.errors.some(({ instancePath, keyword, params }) =>
        instancePath.endsWith("/contractExchange/resolution") && keyword === "required" && params.missingProperty === "migrationPlanRef"),
    "RuntimeEvent Schema accepted adapter resolution without migrationPlanRef",
  );
  pass("rejected mutation: RuntimeEvent adapter resolution without migrationPlanRef");

  const runtimeCompatibleWithPlan = clone(requestEvent);
  runtimeCompatibleWithPlan.contractExchange.resolution.migrationPlanRef = clone(
    responseEvent.contractExchange.resolution.migrationPlanRef,
  );
  check(
    !validateRuntime(runtimeCompatibleWithPlan)
      && validateRuntime.errors.some(({ instancePath }) => instancePath.endsWith("/contractExchange/resolution/migrationPlanRef")),
    "RuntimeEvent Schema accepted migration facts in compatible resolution",
  );
  pass("rejected mutation: RuntimeEvent compatible resolution carrying migration facts");

  const validateConformanceReportSchema = definitionValidators.get("conformanceReport");
  const reportAdapterWithoutPlan = clone(report);
  delete reportAdapterWithoutPlan.chainBindings.find(
    ({ contractBindingId }) => contractBindingId === "contract-binding.model-response",
  ).resolution.migrationPlanRef;
  check(
    !validateConformanceReportSchema(reportAdapterWithoutPlan)
      && validateConformanceReportSchema.errors.some(({ instancePath, keyword, params }) =>
        instancePath.endsWith("/resolution") && keyword === "required" && params.missingProperty === "migrationPlanRef"),
    "ConformanceReport Schema accepted adapter resolution without migrationPlanRef",
  );
  pass("rejected mutation: ConformanceReport adapter resolution without migrationPlanRef");

  const reportCompatibleWithPlan = clone(report);
  reportCompatibleWithPlan.chainBindings.find(
    ({ contractBindingId }) => contractBindingId === "contract-binding.model-request",
  ).resolution.migrationPlanRef = clone(responseEvent.contractExchange.resolution.migrationPlanRef);
  check(
    !validateConformanceReportSchema(reportCompatibleWithPlan)
      && validateConformanceReportSchema.errors.some(({ instancePath }) => instancePath.endsWith("/resolution/migrationPlanRef")),
    "ConformanceReport Schema accepted migration facts in compatible resolution",
  );
  pass("rejected mutation: ConformanceReport compatible resolution carrying migration facts");

  const falseCompatible = clone(companions.contractCompatibilityAssessments.find(({ outcome }) => outcome === "migrationRequired"));
  falseCompatible.outcome = "compatible";
  for (const result of falseCompatible.aspectResults.filter(({ aspect }) => ["schema", "fieldSemantics"].includes(aspect))) result.status = "compatible";
  expectIssue("adapter-required schema falsely reported compatible", compatibilityAssessmentIssues(falseCompatible), /evidence requires migrationRequired/);

  const targetRequiredContract = clone(contracts[1]);
  const targetRequiredStructure = targetRequiredContract.structures.find(({ structureId }) => structureId === "structure.model-request");
  targetRequiredStructure.schema.schemaContentHash = `sha256:${"1".repeat(64)}`;
  targetRequiredStructure.fields.push({
    path: "/newRequiredField",
    meaning: { "zh-CN": "目标新增必填字段。", en: "A new target-required field." },
    required: true,
    nullable: false,
    classification: "internal",
  });
  const sourceRequestChannel = contracts[0].channels.find(({ channelId }) => channelId === "channel.model-request");
  const targetRequiredChannel = targetRequiredContract.channels.find(({ channelId }) => channelId === "channel.model-request");
  expectIssue(
    "Compatibility solver rejects a target-added required field",
    mandatoryAspectStatus("schema", contracts[0], targetRequiredContract, sourceRequestChannel, targetRequiredChannel) === "migrationRequired"
      ? ["target-required field requires migration"] : [],
    /requires migration/,
  );

  const auxiliaryErrorDrift = clone(contracts[1]);
  auxiliaryErrorDrift.structures.find(({ structureId }) => structureId === "structure.exchange-error")
    .schema.schemaContentHash = `sha256:${"2".repeat(64)}`;
  const auxiliaryErrorChannel = auxiliaryErrorDrift.channels.find(({ channelId }) => channelId === "channel.model-request");
  expectIssue(
    "Compatibility solver aggregates auxiliary error schemas",
    mandatoryAspectStatus("schema", contracts[0], auxiliaryErrorDrift, sourceRequestChannel, auxiliaryErrorChannel) === "migrationRequired"
      && mandatoryAspectStatus("error", contracts[0], auxiliaryErrorDrift, sourceRequestChannel, auxiliaryErrorChannel) === "migrationRequired"
      ? ["auxiliary error schema requires migration"] : [],
    /requires migration/,
  );

  const auxiliaryFieldPolicyDrift = clone(contracts[1]);
  auxiliaryFieldPolicyDrift.structures.find(({ structureId }) => structureId === "structure.exchange-error").unknownFieldPolicy = "preserve";
  const auxiliaryFieldPolicyChannel = auxiliaryFieldPolicyDrift.channels.find(({ channelId }) => channelId === "channel.model-request");
  expectIssue(
    "Compatibility solver aggregates auxiliary field and unknown-field semantics",
    mandatoryAspectStatus("fieldSemantics", contracts[0], auxiliaryFieldPolicyDrift, sourceRequestChannel, auxiliaryFieldPolicyChannel) === "migrationRequired"
      ? ["auxiliary field policy requires migration"] : [],
    /requires migration/,
  );

  const streamEndDrift = clone(contracts[1]);
  streamEndDrift.structures.find(({ structureId }) => structureId === "structure.stream-end")
    .schema.schemaContentHash = `sha256:${"3".repeat(64)}`;
  const sourceStreamChannel = contracts[0].channels.find(({ channelId }) => channelId === "channel.chat-output");
  const targetStreamChannel = streamEndDrift.channels.find(({ channelId }) => channelId === "channel.chat-output");
  expectIssue(
    "Compatibility solver aggregates stream end schemas",
    mandatoryAspectStatus("schema", contracts[0], streamEndDrift, sourceStreamChannel, targetStreamChannel) === "migrationRequired"
      ? ["stream end schema requires migration"] : [],
    /requires migration/,
  );

  const stateDeltaDrift = clone(contracts[1]);
  stateDeltaDrift.structures.find(({ structureId }) => structureId === "structure.state-delta")
    .schema.schemaContentHash = `sha256:${"4".repeat(64)}`;
  const sourceStateChannel = contracts[0].channels.find(({ channelId }) => channelId === "channel.conversation-state");
  const targetStateChannel = stateDeltaDrift.channels.find(({ channelId }) => channelId === "channel.conversation-state");
  expectIssue(
    "Compatibility solver aggregates state delta schemas",
    mandatoryAspectStatus("schema", contracts[0], stateDeltaDrift, sourceStateChannel, targetStateChannel) === "migrationRequired"
      ? ["state delta schema requires migration"] : [],
    /requires migration/,
  );

  const interactionDrift = clone(contracts[1]);
  const interactionDriftChannel = interactionDrift.channels.find(({ channelId }) => channelId === "channel.model-request");
  interactionDriftChannel.interaction = "event";
  interactionDriftChannel.event = {
    eventStructureId: interactionDriftChannel.message.payloadStructureId,
    errorStructureId: interactionDriftChannel.message.errorStructureId,
    ordering: interactionDriftChannel.message.ordering,
  };
  delete interactionDriftChannel.message;
  expectIssue(
    "Compatibility solver rejects interaction drift",
    mandatoryAspectStatus("protocol", contracts[0], interactionDrift, sourceRequestChannel, interactionDriftChannel) === "migrationRequired"
      ? ["interaction drift requires migration"] : [],
    /requires migration/,
  );

  const cardinalityDrift = clone(contracts[1]);
  const cardinalityDriftChannel = cardinalityDrift.channels.find(({ channelId }) => channelId === "channel.model-request");
  cardinalityDriftChannel.connectionCardinality = "many";
  expectIssue(
    "Compatibility solver rejects connection-cardinality drift",
    mandatoryAspectStatus("protocol", contracts[0], cardinalityDrift, sourceRequestChannel, cardinalityDriftChannel) === "migrationRequired"
      ? ["connection cardinality requires migration"] : [],
    /requires migration/,
  );

  const compatibilityPolicyDrift = clone(contracts[1]);
  compatibilityPolicyDrift.compatibility.semanticChange = "forbidden";
  const compatibilityPolicyDriftChannel = compatibilityPolicyDrift.channels.find(({ channelId }) => channelId === "channel.model-request");
  expectIssue(
    "Compatibility solver rejects Contract compatibility-policy drift",
    mandatoryAspectStatus("fieldSemantics", contracts[0], compatibilityPolicyDrift, sourceRequestChannel, compatibilityPolicyDriftChannel) === "migrationRequired"
      ? ["compatibility policy requires migration"] : [],
    /requires migration/,
  );

  const deliveryDriftContract = clone(contracts[1]);
  const deliveryDriftChannel = deliveryDriftContract.channels.find(({ channelId }) => channelId === "channel.model-request");
  deliveryDriftChannel.reliability.delivery = "atLeastOnce";
  expectIssue(
    "Compatibility solver conservatively rejects delivery drift",
    mandatoryAspectStatus("delivery", contracts[0], deliveryDriftContract, sourceRequestChannel, deliveryDriftChannel) === "migrationRequired"
      ? ["delivery drift requires migration"] : [],
    /requires migration/,
  );

  const compatibilityTimeoutDrift = clone(contracts[1]);
  const compatibilityTimeoutChannel = compatibilityTimeoutDrift.channels.find(({ channelId }) => channelId === "channel.model-request");
  compatibilityTimeoutChannel.reliability.timeout.durationMs += 1;
  expectIssue(
    "Compatibility solver conservatively rejects timeout drift",
    mandatoryAspectStatus("timeout", contracts[0], compatibilityTimeoutDrift, sourceRequestChannel, compatibilityTimeoutChannel) === "migrationRequired"
      ? ["timeout drift requires migration"] : [],
    /requires migration/,
  );

  const incompatibleAssessment = clone(companions.contractCompatibilityAssessments.find(({ outcome }) => outcome === "compatible"));
  incompatibleAssessment.outcome = "incompatible";
  for (const result of incompatibleAssessment.aspectResults) result.status = "incompatible";
  const incompatibleSet = companions.contractCompatibilityAssessments.map((assessment) =>
    assessment.assessmentId === incompatibleAssessment.assessmentId ? incompatibleAssessment : assessment);
  expectIssue(
    "I2 rejects an incompatible Contract assessment",
    interchangeabilityAssessmentIssues(companions.interchangeabilityAssessments[0], { contractAssessments: incompatibleSet }),
    /incompatible Contract assessment/,
  );

  const currentI2Assessment = companions.interchangeabilityAssessments[0];
  const baseEnvironment = environmentByExactKey.get(exactDocumentKey(currentI2Assessment.environmentRef));
  const platformDriftEnvironment = clone(baseEnvironment);
  platformDriftEnvironment.runtime.platforms = [{ os: "windows", architecture: "x64" }];
  expectIssue("I2 rejects Environment platform drift", interchangeabilityAssessmentIssues(currentI2Assessment, { environment: platformDriftEnvironment }), /lacks required platform/);
  const resourceDriftEnvironment = clone(baseEnvironment);
  resourceDriftEnvironment.runtime.minimumResources.memoryMiB = 128;
  expectIssue("I2 rejects Environment resource drift", interchangeabilityAssessmentIssues(currentI2Assessment, { environment: resourceDriftEnvironment }), /lacks required memoryMiB/);
  const networkDriftEnvironment = clone(baseEnvironment);
  networkDriftEnvironment.runtime.network = "none";
  expectIssue("I2 rejects Environment network drift", interchangeabilityAssessmentIssues(currentI2Assessment, { environment: networkDriftEnvironment }), /network mode/);
  const policyDriftEnvironment = clone(baseEnvironment);
  policyDriftEnvironment.permissionPolicyRef = { id: "policy.other", version: "0.6.0", contentHash: `sha256:${"2".repeat(64)}` };
  expectIssue("I2 rejects Environment policy drift", interchangeabilityAssessmentIssues(currentI2Assessment, { environment: policyDriftEnvironment }), /permission policy differs/);
  const requirementDriftDescriptor = clone(descriptorByExactKey.get(exactPartKey(currentI2Assessment.targetPart)));
  requirementDriftDescriptor.requirements.runtime.minimumResources.memoryMiB = 512;
  expectIssue(
    "I2 rejects unsatisfied Descriptor runtime requirements",
    interchangeabilityAssessmentIssues(currentI2Assessment, { targetDescriptor: requirementDriftDescriptor }),
    /lacks required memoryMiB/,
  );
  const permissionDriftDescriptor = clone(descriptorByExactKey.get(exactPartKey(currentI2Assessment.targetPart)));
  permissionDriftDescriptor.requirements.permissions[0].resources = ["credential.other-key"];
  expectIssue(
    "I2 rejects Descriptor permission-requirement drift",
    interchangeabilityAssessmentIssues(currentI2Assessment, { targetDescriptor: permissionDriftDescriptor }),
    /permission requirements differ/,
  );
  const unmappedPermissionDescriptor = clone(descriptors.find(({ identity }) => identity.partId === "resource.model.deepseek"));
  unmappedPermissionDescriptor.requirements.permissions[0].resources = ["credential.unmapped-key"];
  expectIssue(
    "PermissionPolicy rejects an unmapped Descriptor permission tuple",
    permissionCoverageIssues(unmappedPermissionDescriptor, referencePermissionPolicy),
    /mapping count is 0/,
  );

  const reversedMigration = clone(companions.contractMigrationPlans[0]);
  [reversedMigration.fromContract, reversedMigration.toContract] = [reversedMigration.toContract, reversedMigration.fromContract];
  expectIssue("migration direction reversal", contractMigrationIssues(reversedMigration), /source migration role|target migration role|missing source field/);

  const unrelatedDropApproval = clone(adapterPlan);
  unrelatedDropApproval.fieldMigrations[0].dropApprovalRef = {
    id: companions.permissionPolicies[0].id,
    version: companions.permissionPolicies[0].version,
    contentHash: companions.permissionPolicies[0].contentHash,
  };
  expectIssue(
    "explicit drop rejects an unrelated permission policy",
    contractMigrationIssues(unrelatedDropApproval),
    /does not resolve to a DataLossApproval/,
  );

  const missingAssessedMigrationChannel = clone(adapterPlan);
  missingAssessedMigrationChannel.channelMappings = [{
    sourceChannelId: "channel.lifecycle-events",
    sourceRoleId: "role.orchestrator-event-output",
    targetChannelId: "channel.lifecycle-events",
    targetRoleId: "role.observer-event-input",
  }];
  expectIssue(
    "Contract assessment rejects a migration plan for another channel",
    compatibilityAssessmentIssues(adapterAssessment, { migrationPlans: [missingAssessedMigrationChannel] }),
    /omits an assessed channel-role mapping/,
  );

  const missingFieldMigration = clone(adapterPlan);
  missingFieldMigration.fieldMigrations = [];
  expectIssue(
    "migration plan rejects an uncovered source-only field",
    contractMigrationIssues(missingFieldMigration),
    /providerMetadata.*lacks explicit migration/,
  );

  const auxiliaryMigrationSource = clone(contractByExactKey.get(exactContractKey(adapterPlan.fromContract)));
  const auxiliaryMigrationChannel = auxiliaryMigrationSource.channels.find(({ channelId }) => channelId === "channel.model-response");
  const auxiliaryMigrationError = structureSlotsForChannel(auxiliaryMigrationSource, auxiliaryMigrationChannel)
    .find(([slot]) => slot === "error")[1];
  const auxiliarySourceOnlyField = clone(auxiliaryMigrationError.fields[0]);
  auxiliarySourceOnlyField.path = "/legacyProviderErrorCode";
  auxiliarySourceOnlyField.meaning = { en: "A provider-specific error code absent from the target Contract." };
  auxiliaryMigrationError.fields.push(auxiliarySourceOnlyField);
  expectIssue(
    "migration plan covers source-only fields in auxiliary error structures",
    contractMigrationIssues(adapterPlan, { sourceContract: auxiliaryMigrationSource }),
    /legacyProviderErrorCode in error lacks explicit migration/,
  );

  const wrongDropScope = clone(adapterPlan);
  wrongDropScope.fieldMigrations[0].sourcePointer = "/content";
  expectIssue("explicit drop rejects approval scope drift", contractMigrationIssues(wrongDropScope), /approval field scope differs/);

  const rejectedApproval = clone(companions.dataLossApprovals[0]);
  rejectedApproval.decision = "rejected";
  expectIssue(
    "explicit drop rejects a rejected approval",
    contractMigrationIssues(adapterPlan, { dataLossApprovals: [rejectedApproval] }),
    /decision is not approved/,
  );

  const futureApproval = clone(companions.dataLossApprovals[0]);
  futureApproval.decidedAt = "2026-08-27T08:02:00Z";
  expectIssue(
    "Contract assessment rejects data-loss approval decided after assessment",
    compatibilityAssessmentIssues(adapterAssessment, { dataLossApprovals: [futureApproval] }),
    /decided after the assessment/,
  );

  const earlyExpiryApproval = clone(companions.dataLossApprovals[0]);
  earlyExpiryApproval.expiresAt = "2027-08-27T08:00:59Z";
  expectIssue(
    "Contract assessment rejects data-loss approval expiring before evidence",
    compatibilityAssessmentIssues(adapterAssessment, { dataLossApprovals: [earlyExpiryApproval] }),
    /expires before the assessment evidence window/,
  );

  const swappedAdapterPlan = clone(adapterPlan);
  swappedAdapterPlan.migrationArtifactRef = clone(adapterPlan.rollbackArtifactRef);
  expectIssue(
    "adapter Assessment rejects a closed but different migration artifact",
    compatibilityAssessmentIssues(adapterAssessment, { migrationPlans: [swappedAdapterPlan] }),
    /adapter artifact differs/,
  );
  expectIssue(
    "adapter execution rejects a swapped migration artifact",
    (await executeAdapterRoundTrip(adapterAssessment, swappedAdapterPlan)).issues,
    /differs|does not export|execution failed/,
  );

  const swappedRollbackPlan = clone(adapterPlan);
  swappedRollbackPlan.rollbackArtifactRef = clone(adapterPlan.migrationArtifactRef);
  expectIssue(
    "adapter execution rejects a swapped rollback artifact",
    (await executeAdapterRoundTrip(adapterAssessment, swappedRollbackPlan)).issues,
    /does not export|does not restore|execution failed/,
  );

  const swappedCheckpointPlan = clone(adapterPlan);
  swappedCheckpointPlan.checkpointPolicy.checkpointArtifactRef = clone(responseEvent.contractExchange.consumer.payloadArtifactRef);
  expectIssue(
    "adapter execution rejects a swapped checkpoint artifact",
    (await executeAdapterRoundTrip(adapterAssessment, swappedCheckpointPlan)).issues,
    /checkpoint differs/,
  );

  const missingStateVersion = clone(companions.contractMigrationPlans[0]);
  missingStateVersion.stateStructureMappings[0].sourceVersionField = "/missingVersion";
  expectIssue("migration state version pointer drift", contractMigrationIssues(missingStateVersion), /missing source state version field/);

  const runtimeSchemaSwap = clone(events);
  const swappedEvent = runtimeSchemaSwap.find(({ eventId }) => eventId === responseEvent.eventId);
  swappedEvent.contractExchange.producer.payloadSchema = clone(swappedEvent.contractExchange.consumer.payloadSchema);
  expectIssue("RuntimeEvent producer/consumer schema side swap", runtimeExchangeIssues(runtimeSchemaSwap), /producer payload schema identity differs/);

  const runtimeIdempotencyDrift = clone(events);
  runtimeIdempotencyDrift.find(({ eventId }) => eventId === requestEvent.eventId).contractExchange.idempotencyKey = "wrong-key";
  expectIssue("RuntimeEvent idempotency key differs from payload", runtimeExchangeIssues(runtimeIdempotencyDrift), /idempotencyKey differs/);

  const runtimeSubjectDrift = clone(events);
  runtimeSubjectDrift.find(({ eventId }) => eventId === requestEvent.eventId).subject.objectId = "resource.model.deepseek";
  expectIssue("RuntimeEvent subject object differs from Recipe binding", runtimeExchangeIssues(runtimeSubjectDrift), /objectId differs/);

  const unresolvedCause = clone(events);
  unresolvedCause.find(({ eventId }) => eventId === responseEvent.eventId).contractExchange.causationMessageId = "message.missing";
  expectIssue("RuntimeEvent unresolved causation", runtimeExchangeIssues(unresolvedCause), /causation message does not resolve/);

  const terminalThenItem = clone(events);
  const complete = clone(responseEvent);
  complete.eventId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  complete.sequence = 3;
  complete.contractExchange.messageId = "message.stream-complete";
  complete.contractExchange.stream = { streamId: "stream.negative", phase: "complete" };
  const item = clone(responseEvent);
  item.eventId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  item.sequence = 4;
  item.contractExchange.messageId = "message.stream-item";
  item.contractExchange.stream = { streamId: "stream.negative", phase: "item", itemSequence: 0 };
  terminalThenItem.push(complete, item);
  expectIssue("stream item after complete", runtimeExchangeIssues(terminalThenItem), /emits item after terminal phase/);

  const reportDigestDrift = clone(report);
  reportDigestDrift.results.find(({ runtimeEventRefs }) => runtimeEventRefs).runtimeEventRefs[0].eventDigest = `sha256:${"0".repeat(64)}`;
  expectIssue("ConformanceReport RuntimeEvent digest drift", conformanceReportIssues(reportDigestDrift), /RuntimeEvent digest drift/);

  const reportWindowDrift = clone(report);
  reportWindowDrift.results.find(({ runtimeEventRefs }) => runtimeEventRefs).finishedAt = "2026-08-26T09:20:00.050Z";
  expectIssue("ConformanceReport event outside execution window", conformanceReportIssues(reportWindowDrift), /RuntimeEvent falls outside result window/);

  const phantomApplicableSuite = clone(suite);
  phantomApplicableSuite.testVectors.find(({ aspects }) => aspects.includes("chainExecution"))
    .applicableContractChannels[0].bindings.push({ channelId: "channel.chat-input", roleId: "role.chat-client-output" });
  expectIssue(
    "chainExecution rejects an applicable role absent from Report/runtime",
    conformanceReportIssues(report, { suite: phantomApplicableSuite }),
    /omit applicable Suite binding/,
  );

  const missingRecoverySuite = clone(suite);
  for (const vector of missingRecoverySuite.testVectors) {
    if (["invalid", "failure", "recovery"].includes(vector.scenario)) vector.scenario = "positive";
  }
  expectIssue(
    "I3 rejects missing failure/recovery execution",
    conformanceReportIssues(report, { suite: missingRecoverySuite, requireI3Evidence: true }),
    /lacks failure\/recovery execution/,
  );

  const planProfileDrift = clone(companions.replacementPlans[0]);
  planProfileDrift.profileRef = {
    id: companions.compatibilityProfiles[1].profileId,
    version: companions.compatibilityProfiles[1].version,
    contentHash: companions.compatibilityProfiles[1].contentHash,
  };
  expectIssues("ReplacementPlan wrong Profile", replacementPlanIssues(planProfileDrift));

  const currentAssessment = companions.interchangeabilityAssessments[0];
  const oldSourceReport = clone(report);
  const oldSourceDescriptor = descriptorByExactKey.get(exactPartKey(currentAssessment.sourcePart));
  const sourcePart = partRefFromDescriptor(oldSourceDescriptor);
  const sourcePackageRef = oldSourceDescriptor.packageRef;
  for (const binding of oldSourceReport.chainBindings) {
    binding.recipeRef = { id: recipe.id, version: recipe.version, contentHash: recipe.contentHash };
    for (const party of [binding.producer, binding.consumer]) {
      if (party.partRef.partId === currentAssessment.targetPart.partId) {
        party.partRef = clone(sourcePart);
        party.packageRef = clone(sourcePackageRef);
      }
    }
  }
  expectIssue(
    "I3 rejects a report executed only by the old source part",
    interchangeabilityAssessmentIssues(currentAssessment, { i3Reports: [oldSourceReport] }),
    /omits target part\/package/,
  );

  const levelOverclaim = clone(companions.interchangeabilityAssessments[0]);
  levelOverclaim.assessedLevel = "I3";
  levelOverclaim.levelEvidence.I3 = [{ id: report.reportId, version: report.version, contentHash: report.contentHash }];
  expectIssue("I3 overclaim without RuntimeEvent-backed failure/recovery evidence", interchangeabilityAssessmentIssues(levelOverclaim), /differs from maximum derived/);

  const assessmentExpiryDrift = clone(companions.interchangeabilityAssessments[0]);
  assessmentExpiryDrift.expiresAt = "2028-08-27T08:10:00Z";
  expectIssue("I-level validity exceeds evidence window", interchangeabilityAssessmentIssues(assessmentExpiryDrift), /differs from maximum derived/);

  const diffPreconditionDrift = clone(diff);
  diffPreconditionDrift.operations[0].precondition.contentHash = `sha256:${"0".repeat(64)}`;
  expectIssue("RecipeDiff precondition digest drift", recipeDiffIssues(diffPreconditionDrift), /precondition digest drift/);

  const skippedRevision = clone(companions.registryRecords[0]);
  skippedRevision.revision = 3;
  skippedRevision.previousRecordHash = companions.registryRecords[0].recordHash;
  skippedRevision.recordedAt = "2026-08-27T08:02:00Z";
  skippedRevision.recordHash = canonicalHashWithout(skippedRevision, "recordHash");
  expectIssue("append-only registry revision gap", appendOnlyRecordIssues([clone(companions.registryRecords[0]), skippedRevision]), /not contiguous/);

  if (failures === 0) pass("v0.6 cross-document closure and stable producer-consumer chain gates");
  return failures;
};

export { runV06Validation };
