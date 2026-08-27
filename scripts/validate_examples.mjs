/** Validate WGP-ABF schemas, positive and negative examples, and example closure.
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));

const schemaJobs = [
  ["spec/abir.schema.json", "examples/minimal-agent/abir.json"],
  ["spec/assembly-recipe.schema.json", "examples/minimal-agent/recipe.json"],
  ["spec/recipe-diff.schema.json", "examples/minimal-agent/recipe-diff.json"],
  ["spec/evaluation.schema.json", "examples/minimal-agent/evaluation.json"],
  ["spec/standard-part-descriptor.schema.json", "examples/minimal-agent/standard-part-descriptor.json"],
];
const runtimeSchemaPath = "spec/runtime-event.schema.json";
const schemaPaths = [...schemaJobs.map(([schemaPath]) => schemaPath), runtimeSchemaPath];
const expectedRepository = "https://raw.githubusercontent.com/pingta-guangpingwang/wgp-agent-bodification-flow";
const releaseTag = "v0.5.0";

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
const checkUnique = (values, label) => {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) fail(`duplicate ${label}: ${value}`);
    seen.add(value);
  }
};
const nearlyEqual = (left, right, epsilon = 1e-12) =>
  Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= epsilon * Math.max(1, Math.abs(left), Math.abs(right));

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const schemaByPath = new Map(schemaPaths.map((schemaPath) => [schemaPath, readJson(schemaPath)]));
for (const schema of schemaByPath.values()) ajv.addSchema(schema);

const packageMetadata = readJson("package.json");
check(packageMetadata.version === "0.5.0", "package version must be 0.5.0 for the v0.5.0 schema set");
for (const [schemaPath, schema] of schemaByPath) {
  const expectedId = `${expectedRepository}/${releaseTag}/${schemaPath}`;
  check(schema.$id === expectedId, `${schemaPath} $id must be ${expectedId}`);
  check(schema.$schema === "https://json-schema.org/draft/2020-12/schema", `${schemaPath} must declare JSON Schema 2020-12`);
  check(
    schemaPath === "spec/standard-part-descriptor.schema.json"
      ? schema.properties.format.const === "wgp-standard-part-descriptor/0.5"
      : schema.properties.format.const.endsWith("/0.5"),
    `${schemaPath} must belong to the /0.5 format family`,
  );
}

const abirSchema = schemaByPath.get("spec/abir.schema.json");
const sourceClaimProperties = abirSchema.$defs.sourceClaim.properties;
check(
  isDeepStrictEqual(sourceClaimProperties.structuralProvenance.enum, ["F3", "F2", "F1", "F0"]),
  "structuralProvenance values must remain F3/F2/F1/F0",
);
check(
  isDeepStrictEqual(
    sourceClaimProperties.structuralProvenance.oneOf.map(({ const: value, title }) => [value, title]),
    [
      ["F3", "Native"],
      ["F2", "Exported"],
      ["F1", "Inferred"],
      ["F0", "Manual"],
    ],
  ),
  "structuralProvenance display labels changed",
);
check(
  isDeepStrictEqual(sourceClaimProperties.operationCapabilities.items.enum, [
    "view",
    "edit",
    "compile",
    "roundTrip",
    "hotReload",
    "replace",
  ]),
  "operationCapabilities values must remain view/edit/compile/roundTrip/hotReload/replace",
);
check(!("adapterCapability" in sourceClaimProperties), "legacy adapterCapability must not reappear");

const runtimeSchema = schemaByPath.get(runtimeSchemaPath);
check(isDeepStrictEqual(runtimeSchema.properties.storageClass.enum, ["durable", "ephemeral"]), "storageClass values changed");
check(isDeepStrictEqual(runtimeSchema.properties.origin.enum, ["primary", "derived"]), "origin values changed");
check(
  isDeepStrictEqual(runtimeSchema.properties.replayRole.enum, [
    "input",
    "expectedOutcome",
    "verificationOnly",
    "projectionOnly",
    "excluded",
  ]),
  "replayRole values changed",
);

const diffSchema = schemaByPath.get("spec/recipe-diff.schema.json");
check(diffSchema.required.includes("riskAssessments"), "RecipeDiff must require riskAssessments");
check(
  diffSchema.$defs.operation.required.includes("compensation"),
  "each RecipeDiff operation must retain an inverse compensation",
);
check(
  diffSchema.$defs.compensationPlan.required.includes("externalSideEffects"),
  "RecipeDiff compensation must explicitly cover external side effects",
);
check(
  ["residualRisk", "approval"].every((field) => diffSchema.$defs.riskAssessment.required.includes(field)),
  "each risk assessment must retain residualRisk and approval",
);
check(
  ["effectId", "description", "action", "verification", "idempotent", "owner", "status"].every((field) =>
    diffSchema.$defs.externalSideEffectCompensation.required.includes(field),
  ),
  "external side-effect compensation fields changed",
);
const standardPartSchema = schemaByPath.get("spec/standard-part-descriptor.schema.json");
check(
  isDeepStrictEqual(standardPartSchema.$defs.partKind.enum, [
    "component",
    "resource",
    "policy",
    "artifact",
    "interface",
    "container",
  ]),
  "StandardPart partKind must map exactly to the six ABIR object categories",
);
check(
  isDeepStrictEqual(standardPartSchema.$defs.interchangeabilityLevel.enum, ["I0", "I1", "I2", "I3", "I4"]),
  "interchangeability levels must remain I0-I4",
);
check(
  isDeepStrictEqual(
    standardPartSchema.$defs.interchangeabilityLevel.oneOf.map(({ const: value, title }) => [value, title]),
    [
      ["I0", "Closed"],
      ["I1", "Adapter-wrapped"],
      ["I2", "Interface-conformant"],
      ["I3", "Behavior-verified"],
      ["I4", "Evidence-backed controlled interchangeability"],
    ],
  ),
  "I0-I4 display meanings changed",
);
check(
  standardPartSchema.$defs.interchangeabilityLevel.enum.every((value) => !sourceClaimProperties.structuralProvenance.enum.includes(value)),
  "I0-I4 interchangeability values must not overlap F3-F0 provenance values",
);
check(
  ["registryRecord", "interchangeabilityAssessmentRefs", "conformanceReportRefs", "replacementPlanRefs"].every(
    (field) => !(field in standardPartSchema.properties),
  ),
  "immutable StandardPartDescriptor must not embed or reverse-reference registry and post-publication evidence",
);
check(
  ["packageRef", "compatibilityProfileRefs", "conformanceSuiteRefs"].every((field) =>
    standardPartSchema.required.includes(field),
  ),
  "StandardPartDescriptor must pin package, compatibility-profile, and conformance-suite definitions",
);
check(
  ["standardId", "version", "contentHash", "specRef"].every((field) =>
    standardPartSchema.$defs.standardReference.required.includes(field),
  ) &&
    [
      "portId",
      "abirPortId",
      "direction",
      "protocolId",
      "protocolVersion",
      "schemaRef",
      "schemaContentHash",
      "mediaType",
      "cardinality",
      "required",
    ].every((field) => standardPartSchema.$defs.assemblyPort.required.includes(field)),
  "standard assembly surfaces must pin protocol and schema identities at port level",
);
check(
  ["sourcePart", "targetPart", "profileRef", "environmentRef", "assessedLevel", "levelEvidence", "assessedAt", "expiresAt"].every(
    (field) => standardPartSchema.$defs.interchangeabilityAssessment.required.includes(field),
  ) &&
    !("assessedLevel" in standardPartSchema.$defs.compatibilityProfile.properties),
  "stable CompatibilityProfile and directed InterchangeabilityAssessment must remain separate",
);
check(
  ["profileRef", "environmentRef", "executedAt", "expiresAt"].every((field) =>
    standardPartSchema.$defs.conformanceReport.required.includes(field),
  ) &&
    !("revocationStatus" in standardPartSchema.$defs.conformanceReport.properties) &&
    !("reportDigest" in standardPartSchema.$defs.conformanceReport.properties),
  "ConformanceReport must be immutable, time-bounded, context-pinned evidence with one canonical hash",
);
check(
  ["reportRef", "revision", "recordHash", "action", "recordedAt"].every((field) =>
    standardPartSchema.$defs.evidenceStatusRecord.required.includes(field),
  ) &&
    isDeepStrictEqual(standardPartSchema.$defs.evidenceStatusRecord.properties.action.enum, ["active", "revoke", "tombstone"]),
  "EvidenceStatusRecord must externalize append-only report activation, revocation, and tombstones",
);
check(
  standardPartSchema.$defs.replacementPlan.required.includes("profileRef") &&
    standardPartSchema.$defs.replacementPlan.required.includes("replacementMode") &&
    !standardPartSchema.$defs.replacementPlan.required.includes("profileId"),
  "ReplacementPlan must pin an exact profile and keep replacementMode independent from I-level",
);
check(
  standardPartSchema.properties.contentHash.description.includes("RFC 8785") &&
    standardPartSchema.$defs.registryRecord.properties.recordHash.description.includes("RFC 8785"),
  "root hashes must define RFC 8785 canonicalization with the root hash member omitted",
);
pass("schema identities and normative enum sets");

for (const [schemaPath, documentPath] of schemaJobs) {
  const schema = schemaByPath.get(schemaPath);
  const validate = ajv.getSchema(schema.$id);
  const document = readJson(documentPath);
  if (!validate(document)) fail(`${documentPath}\n${ajv.errorsText(validate.errors, { separator: "\n" })}`);
  else pass(documentPath);
}

const standardPartCompanions = readJson("examples/minimal-agent/standard-part-companions.json");
check(
  standardPartCompanions.format === "wgp-standard-part-companions/0.5",
  "standard-part companion bundle must belong to the /0.5 format family",
);
const companionDefinitions = [
  ["descriptors", "exactPartRef", true],
  ["permissionPolicies", "exactDocumentRef", true],
  ["environments", "compatibilityEnvironment", true],
  ["packages", "partPackage", true],
  ["compatibilityProfiles", "compatibilityProfile", true],
  ["conformanceSuites", "conformanceSuite", true],
  ["conformanceReports", "conformanceReport", true],
  ["evidenceStatusRecords", "evidenceStatusRecord", true],
  ["interchangeabilityAssessments", "interchangeabilityAssessment", true],
  ["replacementPlans", "replacementPlan", true],
  ["registryRecords", "registryRecord", true],
];
const companionValidators = new Map();
for (const [property, definition, isArray] of companionDefinitions) {
  const validate = ajv.compile({ $ref: `${standardPartSchema.$id}#/$defs/${definition}` });
  companionValidators.set(definition, validate);
  const values = isArray ? standardPartCompanions[property] : [standardPartCompanions[property]];
  check(Array.isArray(values), `companion collection ${property} must be present`);
  for (const [index, value] of (values ?? []).entries()) {
    if (!validate(value)) {
      fail(
        `examples/minimal-agent/standard-part-companions.json ${property}[${index}]\n${ajv.errorsText(validate.errors, { separator: "\n" })}`,
      );
    }
  }
}
pass("examples/minimal-agent/standard-part-companions.json (typed companion records)");
const targetStandardPartDescriptor = readJson("examples/minimal-agent/standard-part-descriptor-target.json");
const validateStandardPartDescriptor = ajv.getSchema(standardPartSchema.$id);
if (!validateStandardPartDescriptor(targetStandardPartDescriptor)) {
  fail(
    `examples/minimal-agent/standard-part-descriptor-target.json\n${ajv.errorsText(validateStandardPartDescriptor.errors, { separator: "\n" })}`,
  );
} else {
  pass("examples/minimal-agent/standard-part-descriptor-target.json");
}

const validateRuntime = ajv.getSchema(runtimeSchema.$id);
const eventLines = fs
  .readFileSync(path.join(root, "examples/minimal-agent/events.jsonl"), "utf8")
  .split(/\r?\n/)
  .filter((line) => line.trim().length > 0);
const events = [];
for (const [index, line] of eventLines.entries()) {
  try {
    const event = JSON.parse(line);
    events.push(event);
    if (!validateRuntime(event)) {
      fail(`examples/minimal-agent/events.jsonl line ${index + 1}\n${ajv.errorsText(validateRuntime.errors, { separator: "\n" })}`);
    }
  } catch (error) {
    fail(`examples/minimal-agent/events.jsonl line ${index + 1} is not JSON: ${error.message}`);
  }
}
if (events.length === eventLines.length && events.every((event) => validateRuntime(event))) {
  pass(`examples/minimal-agent/events.jsonl (${events.length} events)`);
}

const invalidJobs = [
  {
    schemaPath: "spec/abir.schema.json",
    documentPath: "examples/invalid/abir-legacy-source-claim.json",
    expected: (errors) =>
      errors.some(
        (error) => error.keyword === "enum" && error.instancePath === "/sourceClaims/0/structuralProvenance",
      ) &&
      errors.some((error) => error.keyword === "required" && error.params.missingProperty === "operationCapabilities") &&
      errors.some(
        (error) => error.keyword === "additionalProperties" && error.params.additionalProperty === "adapterCapability",
      ),
    reason: "legacy provenance and adapter capability",
  },
  {
    schemaPath: "spec/assembly-recipe.schema.json",
    documentPath: "examples/invalid/assembly-recipe-undeclared-secret.json",
    expected: (errors) =>
      errors.some(
        (error) => error.keyword === "additionalProperties" && error.params.additionalProperty === "embeddedSecret",
      ),
    reason: "undeclared recipe-envelope property",
  },
  {
    schemaPath: "spec/standard-part-descriptor.schema.json",
    documentPath: "examples/invalid/standard-part-descriptor-category-confusion.json",
    expected: (errors) =>
      errors.some((error) => error.keyword === "enum" && error.instancePath === "/identity/partKind"),
    reason: "ABIR category case confusion",
  },
  {
    definition: "replacementPlan",
    documentPath: "examples/invalid/standard-part-replacement-hot-reload-without-capability.json",
    expected: (errors) =>
      errors.some(
        (error) => error.keyword === "contains" && error.instancePath === "/requiredAdapterCapabilities",
      ),
    reason: "hot-reload mode without field-level hotReload capability",
  },
  {
    schemaPath: "spec/recipe-diff.schema.json",
    documentPath: "examples/invalid/recipe-diff-missing-risk-assessments.json",
    expected: (errors) =>
      errors.some((error) => error.keyword === "required" && error.params.missingProperty === "riskAssessments"),
    reason: "missing required risk assessment",
  },
  {
    schemaPath: "spec/recipe-diff.schema.json",
    documentPath: "examples/invalid/recipe-diff-incomplete-external-compensation.json",
    expected: (errors) =>
      errors.some(
        (error) =>
          error.keyword === "required" &&
          error.instancePath === "/compensation/externalSideEffects/0" &&
          error.params.missingProperty === "status",
      ),
    reason: "incomplete external side-effect compensation",
  },
  {
    schemaPath: runtimeSchemaPath,
    documentPath: "examples/invalid/runtime-event-legacy-timestamp.json",
    expected: (errors) =>
      errors.some((error) => error.keyword === "required" && error.params.missingProperty === "occurredAt") &&
      errors.some((error) => error.keyword === "additionalProperties" && error.params.additionalProperty === "timestamp"),
    reason: "legacy timestamp field",
  },
  {
    schemaPath: "spec/evaluation.schema.json",
    documentPath: "examples/invalid/evaluation-causal-overclaim.json",
    expected: (errors) =>
      errors.some((error) => error.keyword === "const" && error.instancePath === "/claims/0/attribution"),
    reason: "causal maturity without causal attribution",
  },
];

for (const { schemaPath, definition, documentPath, expected, reason } of invalidJobs) {
  const validate = definition
    ? companionValidators.get(definition)
    : ajv.getSchema(schemaByPath.get(schemaPath).$id);
  const accepted = validate(readJson(documentPath));
  const errors = validate.errors ?? [];
  if (accepted) fail(`${documentPath} was accepted but must be rejected (${reason})`);
  else if (!expected(errors)) {
    fail(`${documentPath} was rejected for the wrong reason\n${ajv.errorsText(errors, { separator: "\n" })}`);
  } else {
    pass(`rejected ${documentPath} (${reason})`);
  }
}

const abir = readJson("examples/minimal-agent/abir.json");
const recipe = readJson("examples/minimal-agent/recipe.json");
const diff = readJson("examples/minimal-agent/recipe-diff.json");
const evaluation = readJson("examples/minimal-agent/evaluation.json");
const standardPartDescriptor = readJson("examples/minimal-agent/standard-part-descriptor.json");

const objectGroups = [
  ["components", "Component"],
  ["resources", "Resource"],
  ["policies", "Policy"],
  ["artifacts", "Artifact"],
  ["interfaces", "Interface"],
  ["containers", "Container"],
];
const objects = objectGroups.flatMap(([group]) => abir.objects[group]);
checkUnique(objects.map((object) => object.id), "ABIR object id");
const objectById = new Map(objects.map((object) => [object.id, object]));
for (const [group, objectType] of objectGroups) {
  for (const object of abir.objects[group]) check(object.objectType === objectType, `${object.id} is stored in the wrong object category`);
}
const isObjectType = (id, type) => objectById.get(id)?.objectType === type;
const portByRef = new Map();
for (const object of objects) {
  const ports = object.ports ?? [];
  checkUnique(ports.map((port) => port.id), `port id on ${object.id}`);
  for (const port of ports) portByRef.set(`${object.id}#${port.id}`, port);
}
const getPort = ({ objectId, portId }) => portByRef.get(`${objectId}#${portId}`);

checkUnique(abir.edges.map((edge) => edge.id), "edge id");
for (const edge of abir.edges) {
  const fromPort = getPort(edge.from);
  const toPort = getPort(edge.to);
  check(objectById.has(edge.from.objectId), `edge ${edge.id} references missing source object ${edge.from.objectId}`);
  check(objectById.has(edge.to.objectId), `edge ${edge.id} references missing target object ${edge.to.objectId}`);
  check(fromPort, `edge ${edge.id} references missing source port ${edge.from.objectId}:${edge.from.portId}`);
  check(toPort, `edge ${edge.id} references missing target port ${edge.to.objectId}:${edge.to.portId}`);
  if (fromPort) check(["out", "bidirectional"].includes(fromPort.direction), `edge ${edge.id} starts from an input-only port`);
  if (toPort) check(["in", "bidirectional"].includes(toPort.direction), `edge ${edge.id} ends at an output-only port`);
  if (fromPort && toPort) check(fromPort.protocol === toPort.protocol, `edge ${edge.id} connects incompatible port protocols`);
}

checkUnique(abir.sourceClaims.map((claim) => claim.id), "source claim id");
for (const claim of abir.sourceClaims) {
  check(objectById.has(claim.subjectId), `source claim ${claim.id} references missing object ${claim.subjectId}`);
  checkUnique(claim.fieldScope, `field scope in ${claim.id}`);
  checkUnique(claim.operationCapabilities, `operation capability in ${claim.id}`);
}
checkUnique(abir.projectionProfiles.map((profile) => profile.id), "projection profile id");
for (const component of abir.objects.components) {
  if (component.implementationArtifactId) {
    check(isObjectType(component.implementationArtifactId, "Artifact"), `${component.id} references a missing implementation artifact`);
  }
}
for (const resource of abir.objects.resources) {
  if (resource.artifactId) check(isObjectType(resource.artifactId, "Artifact"), `${resource.id} references a missing artifact`);
}
for (const policy of abir.objects.policies) {
  for (const subjectId of policy.appliesTo ?? []) check(objectById.has(subjectId), `${policy.id} applies to missing object ${subjectId}`);
}
for (const container of abir.objects.containers) {
  for (const containedId of container.contains) check(objectById.has(containedId), `${container.id} contains missing object ${containedId}`);
  if (container.runtimeArtifactId) {
    check(isObjectType(container.runtimeArtifactId, "Artifact"), `${container.id} references a missing runtime artifact`);
  }
}

const exactDocumentKey = ({ id, version, contentHash }) => `${id}@${version}#${contentHash}`;
const exactPartKey = ({ partId, version, contentHash }) => `${partId}@${version}#${contentHash}`;
const exactRecordKey = (record, idField) => exactDocumentKey({
  id: record[idField],
  version: record.version,
  contentHash: record.contentHash,
});
const indexCompanions = (records, idField, label) => {
  checkUnique(records.map((record) => exactRecordKey(record, idField)), label);
  return new Map(records.map((record) => [exactRecordKey(record, idField), record]));
};
const permissionPolicyByRef = new Map(
  standardPartCompanions.permissionPolicies.map((record) => [exactDocumentKey(record), record]),
);
checkUnique([...permissionPolicyByRef.keys()], "permission-policy exact reference");
const environmentByRef = indexCompanions(
  standardPartCompanions.environments,
  "environmentId",
  "compatibility environment exact reference",
);
const packageByRef = indexCompanions(standardPartCompanions.packages, "packageId", "standard-part package exact reference");
const profileByRef = indexCompanions(
  standardPartCompanions.compatibilityProfiles,
  "profileId",
  "compatibility profile exact reference",
);
const suiteByRef = indexCompanions(
  standardPartCompanions.conformanceSuites,
  "suiteId",
  "conformance suite exact reference",
);
const reportByRef = indexCompanions(
  standardPartCompanions.conformanceReports,
  "reportId",
  "conformance report exact reference",
);
const assessmentByRef = indexCompanions(
  standardPartCompanions.interchangeabilityAssessments,
  "assessmentId",
  "interchangeability assessment exact reference",
);
const planByRef = indexCompanions(
  standardPartCompanions.replacementPlans,
  "planId",
  "replacement plan exact reference",
);

const descriptorPartRef = {
  partId: standardPartDescriptor.identity.partId,
  version: standardPartDescriptor.identity.version,
  contentHash: standardPartDescriptor.contentHash,
};
const targetDescriptorPartRef = {
  partId: targetStandardPartDescriptor.identity.partId,
  version: targetStandardPartDescriptor.identity.version,
  contentHash: targetStandardPartDescriptor.contentHash,
};
const descriptorByPartRef = new Map([
  [exactPartKey(descriptorPartRef), standardPartDescriptor],
  [exactPartKey(targetDescriptorPartRef), targetStandardPartDescriptor],
]);
checkUnique(standardPartCompanions.descriptors.map(exactPartKey), "companion descriptor exact reference");
for (const ref of standardPartCompanions.descriptors) {
  check(descriptorByPartRef.has(exactPartKey(ref)), `companion bundle references missing descriptor ${ref.partId}@${ref.version}`);
}
const partKindToObjectType = new Map([
  ["component", "Component"],
  ["resource", "Resource"],
  ["policy", "Policy"],
  ["artifact", "Artifact"],
  ["interface", "Interface"],
  ["container", "Container"],
]);
const describedObject = objectById.get(standardPartDescriptor.identity.partId);
check(describedObject, "StandardPartDescriptor identity references a missing ABIR object");
check(
  describedObject?.objectType === partKindToObjectType.get(standardPartDescriptor.identity.partKind),
  "StandardPartDescriptor partKind does not map to the described ABIR object category",
);
check(
  packageByRef.has(exactDocumentKey(standardPartDescriptor.packageRef)),
  "StandardPartDescriptor packageRef does not close over an exact package record",
);
for (const ref of standardPartDescriptor.compatibilityProfileRefs) {
  check(profileByRef.has(exactDocumentKey(ref)), `StandardPartDescriptor references missing compatibility profile ${ref.id}`);
}
for (const ref of standardPartDescriptor.conformanceSuiteRefs) {
  check(suiteByRef.has(exactDocumentKey(ref)), `StandardPartDescriptor references missing conformance suite ${ref.id}`);
}

const surfaceById = new Map();
const standardPortByRef = new Map();
checkUnique(standardPartDescriptor.assembly.surfaces.map((surface) => surface.surfaceId), "standard assembly surface id");
for (const surface of standardPartDescriptor.assembly.surfaces) {
  surfaceById.set(surface.surfaceId, surface);
  checkUnique(surface.ports.map((port) => port.portId), `standard port id on ${surface.surfaceId}`);
  for (const port of surface.ports) {
    standardPortByRef.set(`${surface.surfaceId}#${port.portId}`, port);
    const abirPort = describedObject?.ports?.find((candidate) => candidate.id === port.abirPortId);
    check(abirPort, `standard port ${surface.surfaceId}:${port.portId} references missing ABIR port ${port.abirPortId}`);
    if (abirPort) {
      check(abirPort.direction === port.direction, `standard port ${surface.surfaceId}:${port.portId} changes direction`);
      check(
        abirPort.protocol === `${port.protocolId}/${port.protocolVersion}`,
        `standard port ${surface.surfaceId}:${port.portId} changes protocol identity`,
      );
      check(abirPort.mediaType === port.mediaType, `standard port ${surface.surfaceId}:${port.portId} changes media type`);
      check(abirPort.cardinality === port.cardinality, `standard port ${surface.surfaceId}:${port.portId} changes cardinality`);
    }
  }
}
checkUnique(standardPartDescriptor.capabilities.map((capability) => capability.capabilityId), "standard-part capability id");
for (const capability of standardPartDescriptor.capabilities) {
  for (const surfaceId of capability.surfaceIds) {
    check(surfaceById.has(surfaceId), `capability ${capability.capabilityId} references missing surface ${surfaceId}`);
  }
}
checkUnique(
  standardPartDescriptor.requirements.dependencies.map((dependency) => dependency.dependencyId),
  "standard-part dependency id",
);
checkUnique(
  standardPartDescriptor.requirements.permissions.map((permission) => permission.permissionId),
  "standard-part permission id",
);

for (const environment of standardPartCompanions.environments) {
  check(
    permissionPolicyByRef.has(exactDocumentKey(environment.permissionPolicyRef)),
    `environment ${environment.environmentId} references a missing permission policy`,
  );
}
for (const profile of standardPartCompanions.compatibilityProfiles) {
  check(
    permissionPolicyByRef.has(exactDocumentKey(profile.permissionPolicyRef)),
    `profile ${profile.profileId} references a missing permission policy`,
  );
  for (const surfaceId of profile.requiredSurfaceIds) {
    check(surfaceById.has(surfaceId), `profile ${profile.profileId} references missing surface ${surfaceId}`);
  }
  for (const suiteRef of profile.requiredSuiteRefs) {
    check(suiteByRef.has(exactDocumentKey(suiteRef)), `profile ${profile.profileId} references missing suite ${suiteRef.id}`);
  }
}

const testVectorById = new Map();
for (const suite of standardPartCompanions.conformanceSuites) {
  checkUnique(suite.testVectors.map((vector) => vector.testVectorId), `test vector id in ${suite.suiteId}`);
  for (const vector of suite.testVectors) {
    testVectorById.set(vector.testVectorId, vector);
    for (const surfaceId of vector.applicableSurfaceIds) {
      check(surfaceById.has(surfaceId), `test vector ${vector.testVectorId} references missing surface ${surfaceId}`);
    }
  }
}
const reportCountsAreClosed = (report) => {
  const counts = { passed: 0, failed: 0, skipped: 0 };
  for (const result of report.results) counts[result.status] += 1;
  return (
    report.summary.total === report.results.length &&
    report.summary.passed === counts.passed &&
    report.summary.failed === counts.failed &&
    report.summary.skipped === counts.skipped
  );
};
const reportRequiredTestsPassed = (report) => {
  const suite = suiteByRef.get(exactDocumentKey(report.suiteRef));
  if (!suite) return false;
  const resultByTest = new Map(report.results.map((result) => [result.testVectorId, result]));
  return suite.testVectors
    .filter((vector) => vector.required)
    .every((vector) => resultByTest.get(vector.testVectorId)?.status === "passed");
};
const evidenceStatusChainIssues = (records) => {
  const issues = [];
  const groups = new Map();
  const ids = new Set();
  for (const record of records) {
    if (ids.has(record.statusRecordId)) issues.push(`duplicate status record ${record.statusRecordId}`);
    ids.add(record.statusRecordId);
    const key = exactDocumentKey(record.reportRef);
    if (!reportByRef.has(key)) issues.push(`status record ${record.statusRecordId} references a missing report`);
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }
  for (const [reportKey, group] of groups) {
    group.sort((left, right) => left.revision - right.revision);
    for (const [index, record] of group.entries()) {
      if (record.revision !== index + 1) issues.push(`${reportKey} status revisions are not contiguous from one`);
      if (index === 0) {
        if (record.action !== "active") issues.push(`${reportKey} first status is not active`);
        if (record.previousRecordHash) issues.push(`${reportKey} first status has a predecessor`);
      } else {
        const previous = group[index - 1];
        if (record.previousRecordHash !== previous.recordHash) issues.push(`${reportKey} status hash chain is broken`);
        if (Date.parse(record.recordedAt) < Date.parse(previous.recordedAt)) issues.push(`${reportKey} status time moves backwards`);
      }
    }
  }
  return issues;
};
for (const issue of evidenceStatusChainIssues(standardPartCompanions.evidenceStatusRecords)) fail(`evidence status: ${issue}`);
const reportCurrentStatus = (report, statusRecords = standardPartCompanions.evidenceStatusRecords) => {
  const key = exactRecordKey(report, "reportId");
  const records = statusRecords
    .filter((record) => exactDocumentKey(record.reportRef) === key)
    .sort((left, right) => left.revision - right.revision);
  return records.at(-1)?.action;
};
const reportAdmissibleAt = (report, at, statusRecords = standardPartCompanions.evidenceStatusRecords) =>
  reportCurrentStatus(report, statusRecords) === "active" &&
  Date.parse(report.executedAt) <= at &&
  at <= Date.parse(report.expiresAt) &&
  report.summary.outcome === "passed" &&
  report.summary.failed === 0 &&
  reportRequiredTestsPassed(report);
for (const report of standardPartCompanions.conformanceReports) {
  const suite = suiteByRef.get(exactDocumentKey(report.suiteRef));
  check(suite, `report ${report.reportId} references a missing exact suite`);
  check(profileByRef.has(exactDocumentKey(report.profileRef)), `report ${report.reportId} references a missing exact profile`);
  check(
    environmentByRef.has(exactDocumentKey(report.environmentRef)),
    `report ${report.reportId} references a missing exact environment`,
  );
  check(Date.parse(report.executedAt) < Date.parse(report.expiresAt), `report ${report.reportId} expires before execution`);
  check(descriptorByPartRef.has(exactPartKey(report.partRef)), `report ${report.reportId} references a missing exact descriptor`);
  checkUnique(report.results.map((result) => result.testVectorId), `test result in ${report.reportId}`);
  for (const result of report.results) {
    check(suite?.testVectors.some((vector) => vector.testVectorId === result.testVectorId), `report ${report.reportId} has an undeclared test result`);
    check(Date.parse(result.startedAt) <= Date.parse(result.finishedAt), `test ${result.testVectorId} finishes before it starts`);
  }
  check(reportCountsAreClosed(report), `report ${report.reportId} summary counts do not equal its results`);
  if (report.summary.outcome === "passed") {
    check(reportRequiredTestsPassed(report) && report.summary.failed === 0, `report ${report.reportId} passes without every required test passing`);
  }
}

const claimById = new Map(abir.sourceClaims.map((claim) => [claim.id, claim]));
for (const plan of standardPartCompanions.replacementPlans) {
  const profile = profileByRef.get(exactDocumentKey(plan.profileRef));
  check(profile, `replacement plan ${plan.planId} references a missing exact profile`);
  check(
    profile?.replacementPolicy.allowedModes.includes(plan.replacementMode),
    `replacement plan ${plan.planId} uses a mode forbidden by its profile`,
  );
  check(descriptorByPartRef.has(exactPartKey(plan.fromPart)), `replacement plan ${plan.planId} has an unknown source descriptor`);
  check(descriptorByPartRef.has(exactPartKey(plan.toPart)), `replacement plan ${plan.planId} has an unknown target descriptor`);
  check(
    exactDocumentKey(plan.recipePrecondition) === exactDocumentKey({
      id: recipe.id,
      version: recipe.version,
      contentHash: recipe.contentHash,
    }),
    `replacement plan ${plan.planId} does not pin the example recipe precondition`,
  );
  for (const riskId of plan.riskAssessmentIds) {
    check(diff.riskAssessments.some((risk) => risk.id === riskId), `replacement plan ${plan.planId} references missing risk ${riskId}`);
  }
  for (const requirement of plan.requiredAdapterCapabilities) {
    const claim = claimById.get(requirement.sourceClaimId);
    check(claim, `replacement plan ${plan.planId} references missing source claim ${requirement.sourceClaimId}`);
    for (const pointer of requirement.fieldScope) {
      check(claim?.fieldScope.includes(pointer), `replacement plan ${plan.planId} uses an unclaimed field scope ${pointer}`);
    }
    for (const capability of requirement.operationCapabilities) {
      check(claim?.operationCapabilities.includes(capability), `replacement plan ${plan.planId} requires unsupported ${capability}`);
    }
  }
  for (const ref of [...plan.migrationReportRefs, ...plan.acceptanceReportRefs, ...plan.rollbackReportRefs]) {
    check(reportByRef.has(exactDocumentKey(ref)), `replacement plan ${plan.planId} references missing report ${ref.id}`);
  }
  checkUnique(plan.steps.map((step) => step.stepId), `replacement step id in ${plan.planId}`);
  for (const step of plan.steps) {
    for (const testVectorId of step.verificationTestVectorIds) {
      check(testVectorById.has(testVectorId), `replacement step ${step.stepId} references missing test ${testVectorId}`);
    }
  }
  check(
    plan.failurePolicy.recipeDiffCompensationRequired === (diff.compensation.strategy !== "none"),
    `replacement plan ${plan.planId} disagrees with RecipeDiff compensation`,
  );
  check(
    plan.failurePolicy.compensateExternalSideEffects === (diff.compensation.externalSideEffects.length > 0),
    `replacement plan ${plan.planId} disagrees with RecipeDiff external compensation`,
  );
}

const hasAdapterIdentity = (partRef) => {
  const descriptor = descriptorByPartRef.get(exactPartKey(partRef));
  if (!descriptor || !objectById.has(descriptor.identity.partId)) return false;
  return abir.sourceClaims.some(
    (claim) =>
      claim.subjectId === descriptor.identity.partId &&
      typeof claim.adapter?.name === "string" &&
      typeof claim.adapter?.version === "string" &&
      typeof claim.adapter?.implementationDigest === "string",
  );
};
const platformMatches = (required, available) =>
  (required.os === "any" || required.os === available.os) &&
  (required.architecture === "any" || required.architecture === available.architecture);
const enginesSupported = (required, available) =>
  required.every((engine) =>
    available.some(
      (candidate) => candidate.name === engine.name && candidate.versionRange === engine.versionRange,
    ),
  );
const resourcesSupported = (required, available) =>
  required.cpuCores <= available.cpuCores &&
  required.memoryMiB <= available.memoryMiB &&
  required.storageMiB <= available.storageMiB &&
  (required.accelerator === undefined ||
    required.accelerator === "none" ||
    required.accelerator === "any" ||
    available.accelerator === required.accelerator ||
    available.accelerator === "any");
const runtimeSupported = (required, available) =>
  enginesSupported(required.engines, available.engines) &&
  required.platforms.every((platform) => available.platforms.some((candidate) => platformMatches(platform, candidate))) &&
  resourcesSupported(required.minimumResources, available.minimumResources) &&
  required.network === available.network;
const staticI2Closure = (assessment, profile) => {
  const targetDescriptor = descriptorByPartRef.get(exactPartKey(assessment.targetPart));
  const sourceBinding = recipe.standardPartBindings.find(
    (binding) => exactPartKey(binding.descriptorRef) === exactPartKey(assessment.sourcePart),
  );
  const environment = environmentByRef.get(exactDocumentKey(assessment.environmentRef));
  if (!targetDescriptor || !sourceBinding || !environment) return false;
  const targetSurfaces = new Map(targetDescriptor.assembly.surfaces.map((surface) => [surface.surfaceId, surface]));
  const mappings = new Map(sourceBinding.surfaceMappings.map((mapping) => [mapping.surfaceId, mapping]));
  const surfacesClosed = profile.requiredSurfaceIds.every((surfaceId) => {
    const surface = targetSurfaces.get(surfaceId);
    const mapping = mappings.get(surfaceId);
    if (!surface || !mapping) return false;
    const mappedPorts = new Set(mapping.portMappings.map((port) => port.partPortId));
    return surface.ports.filter((port) => port.required).every((port) => mappedPorts.has(port.portId));
  });
  const componentBinding = recipe.componentBindings.find(
    (binding) => binding.componentId === targetDescriptor.identity.partId,
  );
  const configurationClosed =
    profile.configurationPolicy === "directRequired" &&
    componentBinding?.configSchemaRef === targetDescriptor.configuration.schemaRef &&
    exactDocumentKey(sourceBinding.packageRef) === exactDocumentKey(targetDescriptor.packageRef);
  const permissionsClosed =
    exactDocumentKey(environment.permissionPolicyRef) === exactDocumentKey(profile.permissionPolicyRef);
  const runtimeClosed =
    runtimeSupported(targetDescriptor.requirements.runtime, environment.runtime) &&
    runtimeSupported(profile.runtimeConstraints, environment.runtime) &&
    targetDescriptor.requirements.runtime.engines.every((engine) =>
      profile.runtimeConstraints.engines.some(
        (constraint) => constraint.name === engine.name && constraint.versionRange === engine.versionRange,
      ),
    ) &&
    profile.runtimeConstraints.platforms.every((platform) =>
      targetDescriptor.requirements.runtime.platforms.some((candidate) => platformMatches(candidate, platform)),
    ) &&
    targetDescriptor.requirements.runtime.network === profile.runtimeConstraints.network;
  return surfacesClosed && configurationClosed && permissionsClosed && runtimeClosed;
};
const reportKinds = (report) => {
  const suite = suiteByRef.get(exactDocumentKey(report.suiteRef));
  const resultByTest = new Map(report.results.map((result) => [result.testVectorId, result]));
  return new Set(
    (suite?.testVectors ?? [])
      .filter((vector) => resultByTest.get(vector.testVectorId)?.status === "passed")
      .map((vector) => vector.kind),
  );
};
const assessmentReport = (assessment, ref, statusRecords) => {
  const report = reportByRef.get(exactDocumentKey(ref));
  if (!report) return undefined;
  const assessedAt = Date.parse(assessment.assessedAt);
  if (exactDocumentKey(report.profileRef) !== exactDocumentKey(assessment.profileRef)) return undefined;
  if (exactDocumentKey(report.environmentRef) !== exactDocumentKey(assessment.environmentRef)) return undefined;
  if (exactPartKey(report.partRef) !== exactPartKey(assessment.targetPart)) return undefined;
  if (Date.parse(report.expiresAt) < Date.parse(assessment.expiresAt)) return undefined;
  if (!reportAdmissibleAt(report, assessedAt, statusRecords)) return undefined;
  return report;
};
const levelSupportsKinds = (assessment, level, kinds, statusRecords) => {
  const refs = assessment.levelEvidence[level];
  if (refs.length === 0) return false;
  const observedKinds = new Set();
  for (const ref of refs) {
    const report = assessmentReport(assessment, ref, statusRecords);
    if (!report) return false;
    for (const kind of reportKinds(report)) observedKinds.add(kind);
  }
  return kinds.every((kind) => observedKinds.has(kind));
};
const deriveMaxInterchangeabilityLevel = (
  assessment,
  statusRecords = standardPartCompanions.evidenceStatusRecords,
) => {
  const profile = profileByRef.get(exactDocumentKey(assessment.profileRef));
  if (!profile) return "I0";
  if (
    !hasAdapterIdentity(assessment.sourcePart) ||
    !hasAdapterIdentity(assessment.targetPart) ||
    !levelSupportsKinds(assessment, "I1", ["surfaceContract"], statusRecords)
  ) return "I0";
  if (
    !staticI2Closure(assessment, profile) ||
    !levelSupportsKinds(assessment, "I2", ["configuration", "permission"], statusRecords)
  ) return "I1";
  if (!levelSupportsKinds(assessment, "I3", ["behavioral"], statusRecords)) return "I2";
  const plan = assessment.replacementPlanRef
    ? planByRef.get(exactDocumentKey(assessment.replacementPlanRef))
    : undefined;
  if (!plan || !levelSupportsKinds(assessment, "I4", ["stateMigration", "behavioral", "lifecycle"], statusRecords)) {
    return "I3";
  }
  const i4Evidence = new Set(assessment.levelEvidence.I4.map(exactDocumentKey));
  const planEvidenceClosed = [
    [plan.migrationReportRefs, "stateMigration"],
    [plan.acceptanceReportRefs, "behavioral"],
    [plan.rollbackReportRefs, "lifecycle"],
  ].every(([refs, kind]) =>
    refs.every((ref) =>
      i4Evidence.has(exactDocumentKey(ref)) &&
      levelSupportsKinds({ ...assessment, levelEvidence: { ...assessment.levelEvidence, I4: [ref] } }, "I4", [kind], statusRecords),
    ),
  );
  return planEvidenceClosed ? "I4" : "I3";
};
const levelRank = new Map(["I0", "I1", "I2", "I3", "I4"].map((level, rank) => [level, rank]));
const assessmentIssues = (
  assessment,
  statusRecords = standardPartCompanions.evidenceStatusRecords,
) => {
  const issues = [];
  const profile = profileByRef.get(exactDocumentKey(assessment.profileRef));
  const environment = environmentByRef.get(exactDocumentKey(assessment.environmentRef));
  const plan = assessment.replacementPlanRef ? planByRef.get(exactDocumentKey(assessment.replacementPlanRef)) : undefined;
  if (!profile) issues.push("missing profile");
  if (!environment) issues.push("missing environment");
  if (!descriptorByPartRef.has(exactPartKey(assessment.sourcePart))) issues.push("missing source descriptor");
  if (!descriptorByPartRef.has(exactPartKey(assessment.targetPart))) issues.push("missing target descriptor");
  if (exactPartKey(assessment.sourcePart) === exactPartKey(assessment.targetPart)) issues.push("source equals target");
  if (Date.parse(assessment.assessedAt) >= Date.parse(assessment.expiresAt)) issues.push("invalid assessment lifetime");
  for (const refs of Object.values(assessment.levelEvidence)) {
    for (const ref of refs) {
      if (!assessmentReport(assessment, ref, statusRecords)) issues.push("inadmissible level report");
    }
  }
  if (assessment.assessedLevel === "I4") {
    if (!plan) issues.push("missing replacement plan");
    else {
      if (exactPartKey(plan.fromPart) !== exactPartKey(assessment.sourcePart)) issues.push("source direction mismatch");
      if (exactPartKey(plan.toPart) !== exactPartKey(assessment.targetPart)) issues.push("target direction mismatch");
      if (exactDocumentKey(plan.profileRef) !== exactDocumentKey(assessment.profileRef)) issues.push("plan profile mismatch");
    }
  }
  const derivedLevel = deriveMaxInterchangeabilityLevel(assessment, statusRecords);
  if (levelRank.get(assessment.assessedLevel) > levelRank.get(derivedLevel)) {
    issues.push(`assessed level overclaims derived ${derivedLevel}`);
  }
  return issues;
};
for (const assessment of standardPartCompanions.interchangeabilityAssessments) {
  for (const issue of assessmentIssues(assessment)) fail(`assessment ${assessment.assessmentId}: ${issue}`);
  check(
    deriveMaxInterchangeabilityLevel(assessment) === assessment.assessedLevel,
    `assessment ${assessment.assessmentId} does not demonstrate its exact positive level`,
  );
}
check(
  isDeepStrictEqual(
    [...new Set(standardPartCompanions.interchangeabilityAssessments.map((assessment) => assessment.assessedLevel))].sort(),
    ["I0", "I1", "I2", "I3", "I4"],
  ),
  "minimal companions must include positive I0-I4 assessments",
);

const registryGroups = new Map();
for (const record of standardPartCompanions.registryRecords) {
  const records = registryGroups.get(record.registryId) ?? [];
  records.push(record);
  registryGroups.set(record.registryId, records);
  check(exactPartKey(record.partRef) === exactPartKey(descriptorPartRef), `registry record ${record.registryId}:${record.revision} pins another descriptor`);
}
for (const [registryId, records] of registryGroups) {
  records.sort((left, right) => left.revision - right.revision);
  for (const [index, record] of records.entries()) {
    check(record.revision === index + 1, `registry ${registryId} revisions must be append-only and contiguous from one`);
    if (index === 0) check(!record.previousRecordHash, `registry ${registryId} first record must not have a predecessor`);
    else check(record.previousRecordHash === records[index - 1].recordHash, `registry ${registryId} hash chain is broken`);
  }
}

const packageRecord = packageByRef.get(exactDocumentKey(standardPartDescriptor.packageRef));
const packageArtifact = packageRecord ? objectById.get(packageRecord.artifactRef.artifactId) : undefined;
check(packageArtifact?.objectType === "Artifact", "standard-part package references a missing ABIR Artifact");
if (packageRecord && packageArtifact) {
  check(packageArtifact.version === packageRecord.artifactRef.version, "standard-part package artifact version does not match ABIR");
  check(packageArtifact.digest === packageRecord.artifactRef.contentHash, "standard-part package artifact digest does not match ABIR");
  check(packageArtifact.locator === packageRecord.locator, "standard-part package locator does not match ABIR");
  check(packageArtifact.mediaType === packageRecord.mediaType, "standard-part package media type does not match ABIR");
}

const reversedAssessment = readJson("examples/invalid/standard-part-assessment-reversed.json");
const validateAssessment = companionValidators.get("interchangeabilityAssessment");
if (!validateAssessment(reversedAssessment)) {
  fail(`semantic negative assessment is not schema-valid\n${ajv.errorsText(validateAssessment.errors, { separator: "\n" })}`);
} else if (!assessmentIssues(reversedAssessment).some((issue) => issue.includes("direction mismatch"))) {
  fail("reversed A-to-B assessment was not rejected by direction closure");
} else {
  pass("rejected examples/invalid/standard-part-assessment-reversed.json (directed assessment closure)");
}
const overclaimAssessment = readJson("examples/invalid/standard-part-assessment-level-overclaim.json");
if (!validateAssessment(overclaimAssessment)) {
  fail(`semantic overclaim assessment is not schema-valid\n${ajv.errorsText(validateAssessment.errors, { separator: "\n" })}`);
} else if (!assessmentIssues(overclaimAssessment).some((issue) => issue.includes("overclaims"))) {
  fail("I4 assessment skipped a prerequisite evidence level without rejection");
} else {
  pass("rejected examples/invalid/standard-part-assessment-level-overclaim.json (cumulative I-level evidence)");
}
const revokedStatusRecord = readJson("examples/invalid/standard-part-conformance-report-revoked.json");
const validateEvidenceStatusRecord = companionValidators.get("evidenceStatusRecord");
const revokedStatusChain = [...standardPartCompanions.evidenceStatusRecords, revokedStatusRecord];
const i4Assessment = standardPartCompanions.interchangeabilityAssessments.find(
  (assessment) => assessment.assessedLevel === "I4",
);
if (!validateEvidenceStatusRecord(revokedStatusRecord)) {
  fail(`semantic negative status record is not schema-valid\n${ajv.errorsText(validateEvidenceStatusRecord.errors, { separator: "\n" })}`);
} else if (evidenceStatusChainIssues(revokedStatusChain).length > 0) {
  fail(`semantic negative status chain is malformed: ${evidenceStatusChainIssues(revokedStatusChain).join("; ")}`);
} else if (!assessmentIssues(i4Assessment, revokedStatusChain).includes("inadmissible level report")) {
  fail("revoked ConformanceReport was allowed to support an InterchangeabilityAssessment");
} else {
  pass("rejected examples/invalid/standard-part-conformance-report-revoked.json (external revocation chain)");
}
const stalePackageDescriptor = readJson("examples/invalid/standard-part-descriptor-stale-package-ref.json");
const validateDescriptor = ajv.getSchema(standardPartSchema.$id);
if (!validateDescriptor(stalePackageDescriptor)) {
  fail(`semantic negative descriptor is not schema-valid\n${ajv.errorsText(validateDescriptor.errors, { separator: "\n" })}`);
} else if (packageByRef.has(exactDocumentKey(stalePackageDescriptor.packageRef))) {
  fail("stale exact package hash was accepted by companion closure");
} else {
  pass("rejected examples/invalid/standard-part-descriptor-stale-package-ref.json (exact hash closure)");
}

check(
  recipe.abir.id === abir.id && recipe.abir.version === abir.version && recipe.abir.contentHash === abir.contentHash,
  "recipe ABIR pin does not match id, version, and hash of the example ABIR",
);
checkUnique(recipe.standardPartBindings.map((binding) => binding.bindingId), "standard-part binding id");
for (const binding of recipe.standardPartBindings) {
  check(
    exactPartKey(binding.descriptorRef) === exactPartKey(descriptorPartRef),
    `standard-part binding ${binding.bindingId} does not pin the example descriptor exactly`,
  );
  check(
    exactDocumentKey(binding.packageRef) === exactDocumentKey(standardPartDescriptor.packageRef) &&
      packageByRef.has(exactDocumentKey(binding.packageRef)),
    `standard-part binding ${binding.bindingId} does not pin the descriptor package exactly`,
  );
  check(
    binding.partKind === standardPartDescriptor.identity.partKind,
    `standard-part binding ${binding.bindingId} changes the descriptor partKind`,
  );
  check(
    objectById.get(binding.targetObjectId)?.objectType === partKindToObjectType.get(binding.partKind),
    `standard-part binding ${binding.bindingId} targets the wrong ABIR category`,
  );
  checkUnique(binding.surfaceMappings.map((mapping) => mapping.surfaceId), `surface mapping in ${binding.bindingId}`);
  const mappedSurfaceIds = new Set(binding.surfaceMappings.map((mapping) => mapping.surfaceId));
  for (const profileRef of standardPartDescriptor.compatibilityProfileRefs) {
    for (const surfaceId of profileByRef.get(exactDocumentKey(profileRef))?.requiredSurfaceIds ?? []) {
      check(mappedSurfaceIds.has(surfaceId), `standard-part binding ${binding.bindingId} omits required surface ${surfaceId}`);
    }
  }
  for (const mapping of binding.surfaceMappings) {
    const surface = surfaceById.get(mapping.surfaceId);
    check(surface, `standard-part binding ${binding.bindingId} references missing surface ${mapping.surfaceId}`);
    checkUnique(mapping.portMappings.map((port) => port.partPortId), `part-port mapping on ${mapping.surfaceId}`);
    const mappedPortIds = new Set(mapping.portMappings.map((port) => port.partPortId));
    for (const requiredPort of surface?.ports.filter((port) => port.required) ?? []) {
      check(mappedPortIds.has(requiredPort.portId), `surface mapping ${mapping.surfaceId} omits required port ${requiredPort.portId}`);
    }
    for (const portMapping of mapping.portMappings) {
      const standardPort = standardPortByRef.get(`${mapping.surfaceId}#${portMapping.partPortId}`);
      check(standardPort, `surface mapping ${mapping.surfaceId} references missing standard port ${portMapping.partPortId}`);
      check(
        standardPort?.abirPortId === portMapping.targetPortId &&
          getPort({ objectId: binding.targetObjectId, portId: portMapping.targetPortId }),
        `surface mapping ${mapping.surfaceId}:${portMapping.partPortId} does not close over its ABIR port`,
      );
    }
  }
}
checkUnique(recipe.componentBindings.map((binding) => binding.componentId), "component binding");
for (const binding of recipe.componentBindings) {
  check(isObjectType(binding.componentId, "Component"), `component binding references missing component ${binding.componentId}`);
  check(
    isObjectType(binding.implementationArtifactId, "Artifact"),
    `component binding references missing implementation artifact ${binding.implementationArtifactId}`,
  );
}
checkUnique(recipe.resourceBindings.map((binding) => binding.resourceId), "resource binding");
for (const binding of recipe.resourceBindings) {
  check(isObjectType(binding.resourceId, "Resource"), `resource binding references missing resource ${binding.resourceId}`);
  if (binding.artifactId) check(isObjectType(binding.artifactId, "Artifact"), `resource binding references missing artifact ${binding.artifactId}`);
}
checkUnique(recipe.policyBindings.map((binding) => binding.policyId), "policy binding");
for (const binding of recipe.policyBindings) {
  check(isObjectType(binding.policyId, "Policy"), `policy binding references missing policy ${binding.policyId}`);
  for (const enforcerId of binding.enforcedBy) check(objectById.has(enforcerId), `policy binding references missing enforcer ${enforcerId}`);
}
checkUnique(recipe.containerPlacements.map((placement) => placement.containerId), "container placement");
for (const placement of recipe.containerPlacements) {
  check(isObjectType(placement.containerId, "Container"), `placement references missing container ${placement.containerId}`);
  for (const objectId of placement.objectIds) check(objectById.has(objectId), `placement references missing object ${objectId}`);
}
checkUnique(recipe.interfaceBindings.map((binding) => binding.interfaceId), "interface binding");
for (const binding of recipe.interfaceBindings) {
  check(isObjectType(binding.interfaceId, "Interface"), `interface binding references missing interface ${binding.interfaceId}`);
}
check(isObjectType(recipe.runtime.entryComponentId, "Component"), "runtime entryComponentId must reference a Component");
const requiredEnvironment = new Set(recipe.runtime.environment.requiredVariables);
for (const variable of recipe.runtime.environment.optionalVariables) {
  check(!requiredEnvironment.has(variable), `environment variable ${variable} cannot be both required and optional`);
}
checkUnique(recipe.verificationPlan.map((verification) => verification.id), "verification-plan id");

const decodePointerToken = (token) => token.replace(/~1/g, "/").replace(/~0/g, "~");
const resolvePointer = (document, pointer) => {
  if (pointer === "") return { found: true, value: document };
  if (!pointer.startsWith("/")) return { found: false };
  let current = document;
  for (const token of pointer.slice(1).split("/").map(decodePointerToken)) {
    if (current === null || typeof current !== "object" || !Object.hasOwn(current, token)) return { found: false };
    current = current[token];
  }
  return { found: true, value: current };
};
const pathsOverlap = (left, right) => left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);

for (const claim of abir.sourceClaims) {
  for (const pointer of claim.fieldScope) {
    check(resolvePointer(abir, pointer).found, `source claim ${claim.id} references missing field scope ${pointer}`);
  }
}

check(diff.recipeId === recipe.id, "RecipeDiff recipeId does not match the example recipe");
check(diff.baseVersion === recipe.version, "RecipeDiff baseVersion does not match the example recipe");
check(diff.baseContentHash === recipe.contentHash, "RecipeDiff baseContentHash does not match the example recipe");
check(diff.targetVersion !== diff.baseVersion, "RecipeDiff targetVersion must differ from baseVersion");
check(diff.targetContentHash !== diff.baseContentHash, "RecipeDiff targetContentHash must differ from baseContentHash");
const linkedReplacementPlan = planByRef.get(exactDocumentKey(diff.replacementPlanRef.plan));
check(linkedReplacementPlan, "RecipeDiff replacementPlanRef does not close over an exact ReplacementPlan");
if (linkedReplacementPlan) {
  check(
    exactPartKey(diff.replacementPlanRef.standardPart) === exactPartKey(linkedReplacementPlan.fromPart),
    "RecipeDiff standard-part precondition does not match ReplacementPlan.fromPart",
  );
  const descriptorReplacement = diff.operations.find(
    (operation) => operation.op === "replace" && operation.path === "/standardPartBindings/0/descriptorRef",
  );
  check(descriptorReplacement, "RecipeDiff does not replace the standard-part descriptor pin");
  check(
    descriptorReplacement && exactPartKey(descriptorReplacement.value) === exactPartKey(linkedReplacementPlan.toPart),
    "RecipeDiff descriptor replacement does not match ReplacementPlan.toPart",
  );
}
for (const precondition of diff.preconditions) {
  if (precondition.kind === "contentHash") {
    check(precondition.expectedHash === recipe.contentHash, "RecipeDiff contentHash precondition does not match the recipe");
  } else if (precondition.kind === "recipeVersion") {
    check(precondition.expectedVersion === recipe.version, "RecipeDiff recipeVersion precondition does not match the recipe");
  } else if (precondition.kind === "pathExists") {
    check(resolvePointer(recipe, precondition.path).found === precondition.expectedExists, `pathExists precondition is stale at ${precondition.path}`);
  } else if (precondition.kind === "pathValue") {
    const resolved = resolvePointer(recipe, precondition.path);
    check(resolved.found && isDeepStrictEqual(resolved.value, precondition.expectedValue), `pathValue precondition is stale at ${precondition.path}`);
  }
}
checkUnique(diff.operations.map((operation) => operation.id), "RecipeDiff operation id");
check(diff.restartRequired === diff.operations.some((operation) => operation.restartRequired), "RecipeDiff restartRequired is not the operation aggregate");
for (const operation of diff.operations) {
  const target = resolvePointer(recipe, operation.path);
  check(operation.precondition.path === operation.path, `operation ${operation.id} precondition targets a different path`);
  check(operation.precondition.exists === target.found, `operation ${operation.id} has a stale existence precondition`);
  if (operation.op === "replace") {
    check(target.found, `replace operation ${operation.id} targets a missing path`);
    check(operation.compensation.op === "replace", `replace operation ${operation.id} must use replace compensation`);
    check(operation.compensation.path === operation.path, `operation ${operation.id} compensates a different path`);
    check(
      target.found && isDeepStrictEqual(operation.compensation.value, target.value),
      `operation ${operation.id} compensation does not restore the original value`,
    );
  } else if (operation.op === "add") {
    check(operation.compensation.op === "remove" && operation.compensation.path === operation.path, `add operation ${operation.id} lacks inverse remove`);
  } else if (operation.op === "remove") {
    check(operation.compensation.op === "add" && operation.compensation.path === operation.path, `remove operation ${operation.id} lacks inverse add`);
  }
}
checkUnique(diff.riskAssessments.map((risk) => risk.id), "risk assessment id");
const severityRank = new Map([
  ["low", 0],
  ["medium", 1],
  ["high", 2],
  ["critical", 3],
]);
for (const risk of diff.riskAssessments) {
  check(
    severityRank.get(risk.residualRisk.severity) <= severityRank.get(risk.severity),
    `risk ${risk.id} mitigation increases residual severity`,
  );
  if (["high", "critical"].includes(risk.severity)) check(risk.approval.required, `risk ${risk.id} must require approval`);
  for (const affectedPath of risk.affectedPaths) {
    check(
      diff.operations.some((operation) => pathsOverlap(affectedPath, operation.path)),
      `risk ${risk.id} does not cover an operation path: ${affectedPath}`,
    );
  }
}
checkUnique(diff.compensation.externalSideEffects.map((effect) => effect.effectId), "external side-effect compensation id");
if (diff.riskAssessments.some((risk) => risk.category === "externalSideEffect")) {
  check(diff.compensation.externalSideEffects.length > 0, "external-side-effect risk requires an external compensation record");
}
if (diff.compensation.externalSideEffects.length > 0) {
  check(
    diff.riskAssessments.some((risk) => risk.category === "externalSideEffect"),
    "external compensation requires a matching externalSideEffect risk",
  );
  check(diff.compensation.strategy !== "none", "external compensation cannot use strategy none");
  check(diff.compensation.trigger !== "never", "external compensation cannot use trigger never");
}

checkUnique(events.map((event) => event.eventId), "runtime event id");
const eventById = new Map(events.map((event) => [event.eventId, event]));
const runGroups = new Map();
const standardPartBindingById = new Map(recipe.standardPartBindings.map((binding) => [binding.bindingId, binding]));
for (const event of events) {
  const group = runGroups.get(event.runId) ?? [];
  group.push(event);
  runGroups.set(event.runId, group);
  check(event.subject.abirId === abir.id, `event ${event.eventId} references a different ABIR`);
  if (event.subject.objectId) check(objectById.has(event.subject.objectId), `event ${event.eventId} references missing object ${event.subject.objectId}`);
  if (event.subject.portId) check(getPort(event.subject), `event ${event.eventId} references missing port ${event.subject.objectId}:${event.subject.portId}`);
  check(event.subject.recipeId === recipe.id, `event ${event.eventId} references a different recipe`);
  check(
    [diff.baseContentHash, diff.targetContentHash].includes(event.subject.recipeContentHash),
    `event ${event.eventId} references a recipe hash outside the evaluated lineage`,
  );
  const standardPartExecutionEvent =
    event.eventType.startsWith("model.") || event.subject.objectId === standardPartDescriptor.identity.partId;
  if (standardPartExecutionEvent) {
    const binding = standardPartBindingById.get(event.subject.standardPartBindingId);
    check(binding, `event ${event.eventId} omits or misidentifies its standard-part binding`);
    const expectedPart = event.subject.recipeContentHash === diff.baseContentHash
      ? linkedReplacementPlan?.fromPart
      : linkedReplacementPlan?.toPart;
    check(
      expectedPart && exactPartKey(event.subject.partRef) === exactPartKey(expectedPart),
      `event ${event.eventId} does not pin the part version actually selected by the recipe lineage`,
    );
    check(
      binding && exactDocumentKey(event.subject.packageRef) === exactDocumentKey(binding.packageRef),
      `event ${event.eventId} does not pin the bound standard-part package`,
    );
    check(
      packageByRef.has(exactDocumentKey(event.subject.packageRef)),
      `event ${event.eventId} packageRef does not close over the package record`,
    );
  }
  const occurredAt = Date.parse(event.occurredAt);
  check(Number.isFinite(occurredAt), `event ${event.eventId} has an invalid occurredAt`);
  if (event.observedAt) {
    check(Date.parse(event.observedAt) >= occurredAt, `event ${event.eventId} was observed before it occurred`);
  }
}
for (const [runId, group] of runGroups) {
  group.sort((left, right) => left.sequence - right.sequence);
  for (const [index, event] of group.entries()) {
    check(event.sequence === index, `run ${runId} sequence must be contiguous from zero`);
    if (index > 0) {
      check(Date.parse(event.occurredAt) >= Date.parse(group[index - 1].occurredAt), `run ${runId} occurrence time moves backwards`);
    }
    for (const sourceId of event.derivation?.sourceEventIds ?? []) {
      const source = eventById.get(sourceId);
      check(source, `derived event ${event.eventId} references missing source event ${sourceId}`);
      if (source) {
        check(source.runId === event.runId, `derived event ${event.eventId} references another run`);
        check(source.sequence < event.sequence, `derived event ${event.eventId} references a non-prior source`);
        check(Date.parse(source.occurredAt) <= Date.parse(event.occurredAt), `derived event ${event.eventId} precedes its source`);
      }
    }
    if (event.derivation?.algorithm === "occurred-at-delta") {
      const [startId, endId] = event.derivation.sourceEventIds;
      const start = eventById.get(startId);
      const end = eventById.get(endId);
      if (start && end) {
        check(event.payload.value === Date.parse(end.occurredAt) - Date.parse(start.occurredAt), `derived event ${event.eventId} has the wrong occurred-at delta`);
      }
    }
  }
}

check(
  evaluation.baseline.label === "baseline" && evaluation.candidate.label === "candidate",
  "evaluation variant labels are reversed",
);
check(
  evaluation.baseline.recipeId === recipe.id &&
    evaluation.baseline.recipeVersion === diff.baseVersion &&
    evaluation.baseline.recipeContentHash === diff.baseContentHash,
  "evaluation baseline does not match the RecipeDiff base",
);
check(
  evaluation.candidate.recipeId === recipe.id &&
    evaluation.candidate.recipeVersion === diff.targetVersion &&
    evaluation.candidate.recipeContentHash === diff.targetContentHash &&
    evaluation.candidate.recipeDiffId === diff.id,
  "evaluation candidate does not match the RecipeDiff target",
);
for (const objectId of evaluation.subject.objectIds) check(objectById.has(objectId), `evaluation subject references missing object ${objectId}`);
checkUnique(evaluation.trials.map((trial) => trial.trialId), "evaluation trial id");
checkUnique(evaluation.metrics.map((metric) => metric.id), "evaluation metric id");
checkUnique(evaluation.results.map((result) => result.metricId), "evaluation result metric id");
checkUnique(evaluation.claims.map((claim) => claim.id), "evaluation claim id");
const metricById = new Map(evaluation.metrics.map((metric) => [metric.id, metric]));
const fixtureCases = new Set(evaluation.protocol.fixture.caseIds);
const referencedEventIds = new Set();
const trialsByVariant = new Map([
  ["baseline", []],
  ["candidate", []],
]);
for (const trial of evaluation.trials) {
  trialsByVariant.get(trial.variant)?.push(trial);
  const variant = evaluation[trial.variant];
  check(trial.recipeContentHash === variant.recipeContentHash, `trial ${trial.trialId} recipe hash does not match ${trial.variant}`);
  check(fixtureCases.has(trial.fixtureCaseId), `trial ${trial.trialId} references an undeclared fixture case`);
  check(evaluation.protocol.randomSeeds.includes(trial.seed), `trial ${trial.trialId} uses an undeclared seed`);
  check(trial.modelStreamDigest === evaluation.protocol.modelStreamControl.contentHash, `trial ${trial.trialId} uses a different model stream`);
  checkUnique(trial.eventIds, `event reference in ${trial.trialId}`);
  const runEvents = runGroups.get(trial.runId) ?? [];
  check(runEvents.length > 0, `trial ${trial.trialId} references missing run ${trial.runId}`);
  const trialEventSet = new Set(trial.eventIds);
  check(
    runEvents.length === trialEventSet.size && runEvents.every((event) => trialEventSet.has(event.eventId)),
    `trial ${trial.trialId} does not close over every event in run ${trial.runId}`,
  );
  for (const eventId of trial.eventIds) {
    const event = eventById.get(eventId);
    check(event, `trial ${trial.trialId} references missing event ${eventId}`);
    if (event) {
      referencedEventIds.add(eventId);
      check(event.runId === trial.runId, `trial ${trial.trialId} includes an event from another run`);
      check(event.subject.recipeContentHash === trial.recipeContentHash, `trial ${trial.trialId} includes an event from another recipe version`);
    }
  }
  for (const metricId of Object.keys(trial.metricValues)) check(metricById.has(metricId), `trial ${trial.trialId} reports undeclared metric ${metricId}`);
  for (const event of runEvents.filter((candidate) => candidate.eventType === "metric.derived")) {
    if (event.payload.metricId in trial.metricValues) {
      check(trial.metricValues[event.payload.metricId] === event.payload.value, `trial ${trial.trialId} disagrees with derived metric event ${event.eventId}`);
    }
  }
}
for (const [variant, trials] of trialsByVariant) {
  check(trials.length === evaluation.protocol.repetitionsPerVariant, `${variant} trial count does not match repetitionsPerVariant`);
}
check(referencedEventIds.size === events.length, "evaluation trials do not reference every event in the example log");

const aggregate = (values, kind) => {
  const sorted = [...values].sort((left, right) => left - right);
  if (kind === "sum") return values.reduce((sum, value) => sum + value, 0);
  if (["mean", "rate"].includes(kind)) return values.reduce((sum, value) => sum + value, 0) / values.length;
  if (["median", "p50"].includes(kind)) {
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }
  const percentile = { p90: 0.9, p95: 0.95, p99: 0.99 }[kind];
  if (percentile) return sorted[Math.max(0, Math.ceil(percentile * sorted.length) - 1)];
  return undefined;
};
for (const result of evaluation.results) {
  const metric = metricById.get(result.metricId);
  check(metric, `result references missing metric ${result.metricId}`);
  if (!metric) continue;
  const baselineValues = trialsByVariant.get("baseline").map((trial) => trial.metricValues[result.metricId]);
  const candidateValues = trialsByVariant.get("candidate").map((trial) => trial.metricValues[result.metricId]);
  check(baselineValues.every(Number.isFinite), `baseline trials omit ${result.metricId}`);
  check(candidateValues.every(Number.isFinite), `candidate trials omit ${result.metricId}`);
  check(result.baseline.n === baselineValues.length && result.candidate.n === candidateValues.length, `result ${result.metricId} has wrong sample counts`);
  const baselineValue = aggregate(baselineValues, metric.aggregation);
  const candidateValue = aggregate(candidateValues, metric.aggregation);
  check(nearlyEqual(result.baseline.value, baselineValue), `result ${result.metricId} has wrong baseline aggregate`);
  check(nearlyEqual(result.candidate.value, candidateValue), `result ${result.metricId} has wrong candidate aggregate`);
  check(nearlyEqual(result.absoluteDelta, candidateValue - baselineValue), `result ${result.metricId} has wrong absolute delta`);
  if (baselineValue !== 0) {
    check(nearlyEqual(result.relativeDelta, (candidateValue - baselineValue) / baselineValue), `result ${result.metricId} has wrong relative delta`);
  }
}
const claimRank = new Map([
  ["observation", 0],
  ["regression", 1],
  ["controlledExperiment", 2],
  ["causalClaim", 3],
]);
for (const claim of evaluation.claims) {
  check(claimRank.get(claim.maturity) <= claimRank.get(evaluation.protocol.claimCeiling), `claim ${claim.id} exceeds the protocol ceiling`);
  for (const eventId of claim.evidenceEventIds) check(eventById.has(eventId), `claim ${claim.id} references missing evidence event ${eventId}`);
}

if (failures) {
  console.error(`\n${failures} validation failure(s).`);
  process.exit(1);
}
pass(
  "example closure: unique IDs; ABIR and standard surface mappings; exact descriptor/package/profile/suite/report/plan references; adapter and runtime/permission closure; derived cumulative I0-I4 evidence; append-only report-status and Registry chains; RecipeDiff/ReplacementPlan linkage; executed part/package identity; risk and recovery; event order/derivation; evaluation evidence",
);
