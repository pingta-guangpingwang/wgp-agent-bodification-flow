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
];
const runtimeSchemaPath = "spec/runtime-event.schema.json";
const schemaPaths = [...schemaJobs.map(([schemaPath]) => schemaPath), runtimeSchemaPath];
const expectedRepository = "https://raw.githubusercontent.com/pingta-guangpingwang/wgp-agent-bodification-flow";
const releaseTag = "v0.4.0";

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
check(packageMetadata.version === "0.4.0", "package version must remain 0.4.0 for the v0.4.0 schema set");
for (const [schemaPath, schema] of schemaByPath) {
  const expectedId = `${expectedRepository}/${releaseTag}/${schemaPath}`;
  check(schema.$id === expectedId, `${schemaPath} $id must be ${expectedId}`);
  check(schema.$schema === "https://json-schema.org/draft/2020-12/schema", `${schemaPath} must declare JSON Schema 2020-12`);
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
pass("schema identities and normative enum sets");

for (const [schemaPath, documentPath] of schemaJobs) {
  const schema = schemaByPath.get(schemaPath);
  const validate = ajv.getSchema(schema.$id);
  const document = readJson(documentPath);
  if (!validate(document)) fail(`${documentPath}\n${ajv.errorsText(validate.errors, { separator: "\n" })}`);
  else pass(documentPath);
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

for (const { schemaPath, documentPath, expected, reason } of invalidJobs) {
  const validate = ajv.getSchema(schemaByPath.get(schemaPath).$id);
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

check(
  recipe.abir.id === abir.id && recipe.abir.version === abir.version && recipe.abir.contentHash === abir.contentHash,
  "recipe ABIR pin does not match id, version, and hash of the example ABIR",
);
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
checkUnique(recipe.verification.map((verification) => verification.id), "verification id");

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
  "example closure: unique IDs; object/port/binding references; recipe and guarded-diff lineage; risk and recovery records; event time/order/derivation; evaluation run, metric, and evidence closure",
);
