/** Rebuild the v0.6 example's exact-reference DAG and canonical hashes.
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalHashWithout, canonicalJson, sha256 } from "./lib/canonical-json.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const writeJson = (relativePath, value) => fs.writeFileSync(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`);
const documentRef = (id, version, contentHash = `sha256:${"0".repeat(64)}`) => ({ id, version, contentHash });
const artifactRef = (artifactId, version = "0.6.0", contentHash = `sha256:${"0".repeat(64)}`) => ({ artifactId, version, contentHash });
const contractRef = (contract) => ({
  contractId: contract.identity.contractId,
  version: contract.identity.version,
  contentHash: contract.contentHash,
});
const partRef = (descriptor) => ({
  partId: descriptor.identity.partId,
  version: descriptor.identity.version,
  contentHash: descriptor.contentHash,
});

const jsonPaths = [
  "examples/minimal-agent/abir.json",
  "examples/minimal-agent/recipe.json",
  "examples/minimal-agent/recipe-target.json",
  "examples/minimal-agent/recipe-diff.json",
  "examples/minimal-agent/evaluation.json",
  "examples/minimal-agent/module-data-contract.json",
  "examples/minimal-agent/module-data-contract-target.json",
  "examples/minimal-agent/standard-part-descriptor.json",
  "examples/minimal-agent/standard-part-descriptor-target.json",
  "examples/minimal-agent/standard-part-descriptor-model-provider.json",
  "examples/minimal-agent/standard-part-companions.json",
];
const documents = new Map(jsonPaths.map((relativePath) => [relativePath, readJson(relativePath)]));
const get = (name) => documents.get(`examples/minimal-agent/${name}`);
const abir = get("abir.json");
const recipe = get("recipe.json");
const targetRecipe = get("recipe-target.json");
const diff = get("recipe-diff.json");
const evaluation = get("evaluation.json");
const sourceContract = get("module-data-contract.json");
const targetContract = get("module-data-contract-target.json");
const sourceDescriptor = get("standard-part-descriptor.json");
const targetDescriptor = get("standard-part-descriptor-target.json");
const providerDescriptor = get("standard-part-descriptor-model-provider.json");
const companions = get("standard-part-companions.json");
const maximumAssessment = companions.interchangeabilityAssessments.find(({ assessedLevel }) => assessedLevel === "I4")
  ?? companions.interchangeabilityAssessments.find(({ assessedLevel }) => assessedLevel === "I3")
  ?? companions.interchangeabilityAssessments.find(({ assessedLevel }) => assessedLevel === "I2");
if (!maximumAssessment) throw new Error("The v0.6 fixture needs one evidence-bearing interchangeability assessment");
maximumAssessment.assessmentId = "assessment.orchestrator-i2";
maximumAssessment.assessedLevel = "I2";
maximumAssessment.levelEvidence.I3 = [];
maximumAssessment.levelEvidence.I4 = [];
delete maximumAssessment.replacementPlanRef;
companions.interchangeabilityAssessments = [maximumAssessment];
companions.permissionPolicies[0].rules = [{
  ruleId: "rule.allow-model-invoke",
  operation: "model.invoke",
  networkTarget: "api.deepseek.com",
  secretScope: "secret.deepseek-api-key",
  effect: "allow",
  promptRequired: true,
  secretValueExposed: false,
}];
const eventsPath = "examples/minimal-agent/events.jsonl";
const events = fs.readFileSync(path.join(root, eventsPath), "utf8").trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const rewriteTargetPartIdentity = (value) => {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach(rewriteTargetPartIdentity);
    return;
  }
  if (value.partId === "component.orchestrator" && value.version === "0.6.1") {
    value.partId = targetDescriptor.identity.partId;
  }
  Object.values(value).forEach(rewriteTargetPartIdentity);
};
for (const document of documents.values()) rewriteTargetPartIdentity(document);
events.forEach(rewriteTargetPartIdentity);
const chainResultPath = "examples/minimal-agent/artifacts/tests/chain-execution.result.json";
const chainResult = readJson(chainResultPath);

const schemaDirectory = "examples/minimal-agent/schemas";
const schemaNames = fs.readdirSync(path.join(root, schemaDirectory)).filter((name) => name.endsWith(".schema.json")).sort();
const schemaMetadata = new Map(schemaNames.map((name) => {
  const localPath = `${schemaDirectory}/${name}`;
  const schema = readJson(localPath);
  return [name, {
    localPath,
    schema,
    schemaRef: schema.$id,
    schemaContentHash: sha256(canonicalJson(schema)),
  }];
}));
const schemaNameByStructure = new Map([
  ["structure.chat-message", "wgp-chat-message-v1.schema.json"],
  ["structure.assistant-chunk", "wgp-assistant-chunk-v1.schema.json"],
  ["structure.stream-end", "wgp-stream-end-v1.schema.json"],
  ["structure.exchange-error", "wgp-exchange-error-v1.schema.json"],
  ["structure.model-request", "wgp-model-request-v1.schema.json"],
  ["structure.model-response", "wgp-model-response-v1.schema.json"],
  ["structure.lifecycle-event", "wgp-lifecycle-event-v1.schema.json"],
  ["structure.state-snapshot", "wgp-state-snapshot-v1.schema.json"],
  ["structure.state-delta", "wgp-state-delta-v1.schema.json"],
]);
const sourceBundle = companions.schemaBundles.find(({ version }) => version === "1.0.0");
const targetBundle = companions.schemaBundles.find(({ version }) => version === "1.1.0");
const bundleNames = (target) => [
  "wgp-chat-message-v1.schema.json",
  "wgp-assistant-chunk-v1.schema.json",
  "wgp-stream-end-v1.schema.json",
  "wgp-exchange-error-v1.schema.json",
  "wgp-model-request-v1.schema.json",
  target ? "wgp-model-response-v1.1.schema.json" : "wgp-model-response-v1.schema.json",
  "wgp-lifecycle-event-v1.schema.json",
  "wgp-state-snapshot-v1.schema.json",
  "wgp-state-delta-v1.schema.json",
  target ? "minimal-model-provider-config.schema.json" : "minimal-orchestrator-config.schema.json",
];
const materializeBundle = (bundle, names) => {
  bundle.entries = names.map((name) => {
    const metadata = schemaMetadata.get(name);
    return {
      schemaId: `schema.${name.replace(/\.schema\.json$/, "").replaceAll(/[^A-Za-z0-9._:-]/g, "-")}`,
      schemaRef: metadata.schemaRef,
      schemaContentHash: metadata.schemaContentHash,
    };
  });
  const metadataByRef = new Map([...schemaMetadata.values()].map((metadata) => [metadata.schemaRef, metadata]));
  const closure = [];
  const visit = (value, sourceSchemaRef, pointer = "") => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach((item, index) => visit(item, sourceSchemaRef, `${pointer}/${index}`));
    for (const [key, child] of Object.entries(value)) {
      const childPointer = `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
      if (key === "$ref" && typeof child === "string" && !child.startsWith("#")) {
        const targetSchemaRef = new URL(child, sourceSchemaRef).href.split("#")[0];
        const target = metadataByRef.get(targetSchemaRef);
        if (!target) throw new Error(`Unresolved external schema reference ${child} from ${sourceSchemaRef}`);
        closure.push({
          sourceSchemaRef,
          jsonPointer: childPointer,
          targetSchemaRef,
          targetSchemaContentHash: target.schemaContentHash,
        });
      }
      visit(child, sourceSchemaRef, childPointer);
    }
  };
  for (const name of names) {
    const metadata = schemaMetadata.get(name);
    visit(metadata.schema, metadata.schemaRef);
  }
  bundle.externalRefClosure = closure;
};
materializeBundle(sourceBundle, bundleNames(false));
materializeBundle(targetBundle, bundleNames(true));
companions.schemaResolutionRecords = [...schemaMetadata.values()].map((metadata) => ({
  schemaRef: metadata.schemaRef,
  schemaContentHash: metadata.schemaContentHash,
  locator: metadata.localPath,
}));

const setStructureSchemas = (contract, bundle, target) => {
  for (const structure of contract.structures) {
    let schemaName = schemaNameByStructure.get(structure.structureId);
    if (target && structure.structureId === "structure.model-response") schemaName = "wgp-model-response-v1.1.schema.json";
    const metadata = schemaMetadata.get(schemaName);
    structure.schema.schemaRef = metadata.schemaRef;
    structure.schema.schemaContentHash = metadata.schemaContentHash;
    structure.schema.schemaBundleRef = documentRef(bundle.bundleId, bundle.version, bundle.contentHash);
  }
};
setStructureSchemas(sourceContract, sourceBundle, false);
setStructureSchemas(targetContract, targetBundle, true);

const setDescriptorSchemas = (descriptor, bundle, configSchemaName) => {
  const config = schemaMetadata.get(configSchemaName);
  descriptor.configuration.schemaRef = config.schemaRef;
  descriptor.configuration.schemaDigest = config.schemaContentHash;
  descriptor.configuration.schemaBundleRef = documentRef(bundle.bundleId, bundle.version, bundle.contentHash);
  if (descriptor.state.schema) {
    const state = schemaMetadata.get("wgp-state-snapshot-v1.schema.json");
    descriptor.state.schema.schemaRef = state.schemaRef;
    descriptor.state.schema.schemaContentHash = state.schemaContentHash;
    descriptor.state.schema.schemaBundleRef = documentRef(bundle.bundleId, bundle.version, bundle.contentHash);
  }
  for (const migration of descriptor.state.migrations ?? []) {
    for (const field of ["fromStateSchema", "toStateSchema"]) {
      if (!migration[field]) continue;
      const state = schemaMetadata.get("wgp-state-snapshot-v1.schema.json");
      migration[field].schemaRef = state.schemaRef;
      migration[field].schemaContentHash = state.schemaContentHash;
      migration[field].schemaBundleRef = documentRef(bundle.bundleId, bundle.version, bundle.contentHash);
    }
  }
};
setDescriptorSchemas(sourceDescriptor, sourceBundle, "minimal-orchestrator-config.schema.json");
setDescriptorSchemas(targetDescriptor, sourceBundle, "minimal-orchestrator-config.schema.json");
setDescriptorSchemas(providerDescriptor, targetBundle, "minimal-model-provider-config.schema.json");

const channelIdsForSelection = (selection) => [
  ...new Set(selection.bindings?.map(({ channelId }) => channelId) ?? selection.channelIds ?? []),
];
const bindingsForProfileSelection = (selection, targetPartKind) => {
  const contract = selection.contractRef.version === targetContract.identity.version ? targetContract : sourceContract;
  const descriptors = targetPartKind === "resource" ? [providerDescriptor] : [sourceDescriptor, targetDescriptor];
  const channelIds = channelIdsForSelection(selection);
  const bindings = new Map();
  for (const descriptor of descriptors) {
    for (const surface of descriptor.assembly.surfaces) {
      if (surface.contractRef.version !== selection.contractRef.version) continue;
      for (const binding of surface.bindings) {
        if (channelIds.includes(binding.channelId)) {
          bindings.set(`${binding.channelId}#${binding.contractRoleId}`, {
            channelId: binding.channelId,
            roleId: binding.contractRoleId,
          });
        }
      }
    }
  }
  if (bindings.size === 0) {
    for (const channelId of channelIds) {
      const channel = contract.channels.find((candidate) => candidate.channelId === channelId);
      if (channel) [channel.producerRoleId, ...channel.consumerRoleIds].forEach((roleId) => {
        bindings.set(`${channelId}#${roleId}`, { channelId, roleId });
      });
    }
  }
  return [...bindings.values()].sort((left, right) => `${left.channelId}#${left.roleId}`.localeCompare(`${right.channelId}#${right.roleId}`));
};
for (const profile of companions.compatibilityProfiles) {
  for (const selection of profile.requiredContractChannels) {
    selection.bindings = bindingsForProfileSelection(selection, profile.targetPartKind);
    if (profile.profileId === "profile.orchestrator-controlled") {
      selection.bindings = selection.bindings.filter(({ channelId }) => channelId === "channel.model-request" || channelId === "channel.model-response");
    }
    delete selection.channelIds;
    delete selection.roleIds;
  }
}
const actualChainSelections = () => [
  {
    contractRef: contractRef(sourceContract),
    bindings: [
      { channelId: "channel.model-request", roleId: "role.orchestrator-model-output" },
      { channelId: "channel.model-response", roleId: "role.orchestrator-model-input" },
    ],
  },
  {
    contractRef: contractRef(targetContract),
    bindings: [
      { channelId: "channel.model-request", roleId: "role.model-provider-input" },
      { channelId: "channel.model-response", roleId: "role.model-provider-output" },
    ],
  },
];
const scenarioByVectorId = new Map([
  ["test.surface-contract", "boundary"],
  ["test.chain-execution", "positive"],
  ["test.configuration", "positive"],
  ["test.permission", "positive"],
  ["test.migration", "boundary"],
  ["test.acceptance", "positive"],
  ["test.rollback", "recovery"],
]);
for (const conformanceSuite of companions.conformanceSuites) {
  const scenarioVectors = [
    {
      testVectorId: "test.reliability-recovery",
      scenario: "recovery",
      aspects: ["delivery", "timeout", "retry", "idempotency", "cancellation"],
      purpose: {
        "zh-CN": "执行超时、重试、去重与取消确认恢复序列。",
        en: "Execute a timeout, retry, deduplication, and cancellation-acknowledgement recovery sequence.",
      },
      applicableContractChannels: [
        { contractRef: contractRef(sourceContract), bindings: [{ channelId: "channel.model-request", roleId: "role.orchestrator-model-output" }] },
        { contractRef: contractRef(targetContract), bindings: [{ channelId: "channel.model-request", roleId: "role.model-provider-input" }] },
      ],
    },
    {
      testVectorId: "test.order-error-rejection",
      scenario: "invalid",
      aspects: ["ordering", "error", "retry", "idempotency"],
      purpose: {
        "zh-CN": "执行并拒绝越界重试、非法排序元数据、非法幂等键与未知错误标志。",
        en: "Execute and reject an excessive retry, forbidden ordering metadata, a forbidden idempotency key, and invalid unknown-error flags.",
      },
      applicableContractChannels: [
        { contractRef: contractRef(targetContract), bindings: [{ channelId: "channel.model-response", roleId: "role.model-provider-output" }] },
        { contractRef: contractRef(sourceContract), bindings: [{ channelId: "channel.model-response", roleId: "role.orchestrator-model-input" }] },
      ],
    },
  ];
  for (const vector of scenarioVectors) {
    if (!conformanceSuite.testVectors.some(({ testVectorId }) => testVectorId === vector.testVectorId)) {
      const suffix = vector.testVectorId.slice("test.".length);
      conformanceSuite.testVectors.push({
        ...vector,
        inputArtifactRef: artifactRef(`artifact.test-input.${suffix}`),
        expectedArtifactRef: artifactRef(`artifact.test-expected.${suffix}`),
        checkerArtifactRef: artifactRef(`artifact.test-checker.${suffix}`),
        deterministic: true,
        required: true,
      });
    }
  }
  for (const vector of conformanceSuite.testVectors) {
    vector.scenario = vector.scenario ?? scenarioByVectorId.get(vector.testVectorId);
    if (vector.testVectorId === "test.surface-contract") {
      vector.aspects = ["schema", "fieldSemantics", "protocol"];
      vector.applicableContractChannels = actualChainSelections();
    }
    if (vector.testVectorId === "test.chain-execution") {
      vector.aspects = ["chainExecution"];
      vector.applicableContractChannels = actualChainSelections();
    }
    for (const selection of vector.applicableContractChannels) {
      const contract = selection.contractRef.version === targetContract.identity.version ? targetContract : sourceContract;
      selection.contractRef = contractRef(contract);
      selection.bindings = [...selection.bindings].sort((left, right) => `${left.channelId}#${left.roleId}`.localeCompare(`${right.channelId}#${right.roleId}`));
      delete selection.channelIds;
      delete selection.roleIds;
    }
  }
}

const suite = companions.conformanceSuites[0];
for (const report of companions.conformanceReports) {
  for (const vector of suite.testVectors) {
    if (!report.results.some(({ testVectorId }) => testVectorId === vector.testVectorId)) {
      report.results.push({
        testVectorId: vector.testVectorId,
        status: "passed",
        startedAt: "2026-08-26T09:19:10Z",
        finishedAt: "2026-08-26T09:19:11Z",
        evidenceArtifactRef: artifactRef(`artifact.test-result.${vector.testVectorId.slice("test.".length)}`),
      });
    }
  }
}
const profile = companions.compatibilityProfiles.find(({ profileId }) => profileId === "profile.orchestrator-controlled");
const environment = companions.environments[0];
for (const compatibilityProfile of companions.compatibilityProfiles) compatibilityProfile.packageSignaturePolicy = "unsignedAllowed";
for (const descriptor of [sourceDescriptor, targetDescriptor, providerDescriptor]) {
  descriptor.lifecycle.install.preconditions = [
    "Exact package artifact bytes must match the published ArtifactRecord.",
    "The selected CompatibilityProfile must permit the package signature status.",
  ];
}
const packageArtifactSlug = (packageRecord) => packageRecord.packageId === "package.model-provider" ? "model-provider" : "orchestrator";
for (const packageRecord of companions.packages) {
  const slug = packageArtifactSlug(packageRecord);
  packageRecord.supplyChain.sbom = {
    format: "SPDX-JSON",
    artifactRef: artifactRef(`artifact.sbom.${slug}`, packageRecord.version),
  };
  packageRecord.supplyChain.provenance = {
    builder: "wgp-reference-builder/0.6.0",
    buildType: "https://slsa.dev/provenance/v1",
    sourceRevision: packageRecord.supplyChain.source.revision,
    reproducible: true,
    attestationArtifactRef: artifactRef(`artifact.provenance.${slug}`, packageRecord.version),
  };
  packageRecord.license = {
    expression: "Apache-2.0",
    noticeArtifactRef: artifactRef("artifact.notice.wgp"),
  };
}
const localDigest = (localPath) => sha256(fs.readFileSync(path.join(root, localPath)));
const environmentControlArtifacts = new Map([
  ["operating-system", ["artifact.environment-control.os", "examples/minimal-agent/artifacts/environment-control-os.json"]],
  ["runtime-load", ["artifact.environment-control.runtime-load", "examples/minimal-agent/artifacts/environment-control-runtime-load.json"]],
]);
for (const control of evaluation.protocol.environmentControls) {
  const [artifactId, localPath] = environmentControlArtifacts.get(control.name);
  control.valueDigest = localDigest(localPath);
  control.artifactRef = artifactRef(artifactId, "0.6.0", control.valueDigest);
}
const adapterClaim = abir.sourceClaims.find(({ adapter }) => adapter);
adapterClaim.adapter = {
  name: "minimal-agent-adapter",
  version: "0.6.0",
  implementationArtifactRef: artifactRef("artifact.contract-adapter"),
};
const sourceClaimEvidence = new Map([
  ["claim.orchestrator-native", artifactRef("artifact.orchestrator-package", "0.6.0")],
  ["claim.adapter-derived", artifactRef("artifact.contract-adapter")],
  ["claim.model-declared", artifactRef("artifact.model-provider-package")],
]);
for (const sourceClaim of abir.sourceClaims) {
  const evidenceRef = sourceClaimEvidence.get(sourceClaim.id);
  if (!evidenceRef) throw new Error(`No leaf evidence artifact is assigned to SourceClaim ${sourceClaim.id}`);
  sourceClaim.evidenceRefs = [evidenceRef];
}
const runtimeArtifactRef = artifactRef("artifact.conformance-runner");
const algorithmArtifactRef = artifactRef("artifact.algorithm.occurred-at-delta");
const requestPayload = readJson("examples/minimal-agent/artifacts/model-request.json");
const responsePayload = readJson("examples/minimal-agent/artifacts/model-response-orchestrator.json");
for (const event of events) {
  event.producer.artifactRef = event.producer.name === "wgp-evaluator" ? structuredClone(algorithmArtifactRef) : structuredClone(runtimeArtifactRef);
  delete event.producer.artifactDigest;
  if (event.eventType === "model.requested") event.payload.messagesDigest = sha256(canonicalJson(requestPayload.messages));
  if (event.eventType === "model.responded") event.payload.outputDigest = sha256(canonicalJson(responsePayload.content));
  if (event.derivation) {
    event.derivation.algorithmArtifactRef = structuredClone(algorithmArtifactRef);
    delete event.derivation.algorithmDigest;
  }
}
const migrationBase = companions.contractMigrationPlans[0];
const responsePlan = {
  ...structuredClone(migrationBase),
  planId: "contract-migration.model-provider-to-orchestrator",
  contentHash: `sha256:${"0".repeat(64)}`,
  fromContract: contractRef(targetContract),
  toContract: contractRef(sourceContract),
  lossPolicy: "explicitDrop",
  channelMappings: [{
    sourceChannelId: "channel.model-response",
    sourceRoleId: "role.model-provider-output",
    targetChannelId: "channel.model-response",
    targetRoleId: "role.orchestrator-model-input",
  }],
};
responsePlan.checkpointPolicy = {
  mode: "perStep",
  checkpointArtifactRef: artifactRef("artifact.contract-migration-checkpoint"),
};
const dataLossApproval = {
  approvalId: "approval.drop-provider-metadata",
  version: "0.6.0",
  contentHash: `sha256:${"0".repeat(64)}`,
  sourceContract: contractRef(targetContract),
  targetContract: contractRef(sourceContract),
  sourceStructureId: "structure.model-response",
  sourcePointer: "/providerMetadata",
  decision: "approved",
  decidedBy: "reviewer.data-governance",
  decidedAt: "2026-08-26T08:00:00Z",
  expiresAt: "2027-08-28T08:00:00Z",
  rationale: {
    "zh-CN": "目标契约不接受提供方元数据；仅批准丢弃该精确字段并要求检查点回退。",
    en: "The target Contract rejects provider metadata; only this exact field may be dropped, with checkpoint-backed rollback.",
  },
};
companions.dataLossApprovals = [dataLossApproval];
responsePlan.fieldMigrations = [{
  sourceStructureId: "structure.model-response",
  sourcePointer: "/providerMetadata",
  dataLossPolicy: "explicitDrop",
  dropApprovalRef: documentRef(dataLossApproval.approvalId, dataLossApproval.version, dataLossApproval.contentHash),
}];
companions.contractMigrationPlans = [responsePlan];

const criticalAspects = ["schema", "fieldSemantics", "protocol", "ordering", "delivery", "timeout", "error", "retry", "idempotency", "cancellation"];
const makeContractAssessment = ({ assessmentId, source, target, sourceChannelId, sourceRoleId, targetChannelId, targetRoleId, planId, evidenceId, method, outcome }) => ({
  assessmentId,
  version: "0.6.0",
  contentHash: `sha256:${"0".repeat(64)}`,
  sourceContract: contractRef(source),
  targetContract: contractRef(target),
  direction: "sourceToTarget",
  method,
  profileRef: documentRef(profile.profileId, profile.version, profile.contentHash),
  environmentRef: documentRef(environment.environmentId, environment.version, environment.contentHash),
  checkerArtifactRef: artifactRef("artifact.contract-checker"),
  ...(method === "boundedChecker" ? {} : { adapterArtifactRef: artifactRef("artifact.contract-adapter") }),
  evidenceArtifactRefs: [artifactRef(evidenceId)],
  outcome,
  channelMappings: [{ sourceChannelId, sourceRoleId, targetChannelId, targetRoleId }],
  aspectResults: criticalAspects.map((aspect) => ({
    sourceChannelId,
    sourceRoleId,
    targetChannelId,
    targetRoleId,
    aspect,
    status: outcome === "migrationRequired" && ["schema", "fieldSemantics"].includes(aspect)
      ? "migrationRequired"
      : aspect === "state" ? "exact" : "compatible",
    evidenceArtifactRefs: [artifactRef(evidenceId)],
  })),
  ...(planId ? { migrationPlanRef: documentRef(planId, "0.6.0") } : {}),
  assessedAt: "2026-08-27T08:01:00Z",
  expiresAt: "2027-08-27T08:01:00Z",
});
const requestAssessment = makeContractAssessment({
  assessmentId: "contract-assessment.orchestrator-to-model-provider",
  source: sourceContract,
  target: targetContract,
  sourceChannelId: "channel.model-request",
  sourceRoleId: "role.orchestrator-model-output",
  targetChannelId: "channel.model-request",
  targetRoleId: "role.model-provider-input",
  evidenceId: "artifact.contract-check-result.request",
  method: "boundedChecker",
  outcome: "compatible",
});
const responseAssessment = makeContractAssessment({
  assessmentId: "contract-assessment.model-provider-to-orchestrator",
  source: targetContract,
  target: sourceContract,
  sourceChannelId: "channel.model-response",
  sourceRoleId: "role.model-provider-output",
  targetChannelId: "channel.model-response",
  targetRoleId: "role.orchestrator-model-input",
  planId: responsePlan.planId,
  evidenceId: "artifact.contract-check-result.response",
  method: "adapterEvidence",
  outcome: "migrationRequired",
});
companions.contractCompatibilityAssessments = [requestAssessment, responseAssessment];
for (const assessment of companions.interchangeabilityAssessments) {
  assessment.contractCompatibilityAssessmentRefs = ["I2", "I3", "I4"].includes(assessment.assessedLevel)
    ? [requestAssessment, responseAssessment].map((value) => documentRef(value.assessmentId, value.version, value.contentHash))
    : [];
  assessment.expiresAt = "2027-08-26T09:20:01Z";
}

const applyBindingResolution = (target, isRequest) => {
  const assessment = isRequest ? requestAssessment : responseAssessment;
  target.resolution = isRequest ? {
    mode: "compatible",
    compatibilityAssessmentRef: documentRef(assessment.assessmentId, assessment.version, assessment.contentHash),
  } : {
    mode: "adapter",
    compatibilityAssessmentRef: documentRef(assessment.assessmentId, assessment.version, assessment.contentHash),
    adapterArtifactRef: artifactRef("artifact.contract-adapter"),
    migrationPlanRef: documentRef(responsePlan.planId, responsePlan.version, responsePlan.contentHash),
  };
};
for (const currentRecipe of [recipe, targetRecipe]) {
  const chatBindings = [
    {
      contractBindingId: "contract-binding.chat-input",
      producer: { abirObjectId: "interface.chat.http", abirPortId: "request.out" },
      consumer: {
        standardPartBindingId: "binding.standard-orchestrator",
        surfaceId: "surface.chat",
        assemblyBindingId: "chat.input",
      },
      resolution: { mode: "exact" },
    },
    {
      contractBindingId: "contract-binding.chat-output",
      producer: {
        standardPartBindingId: "binding.standard-orchestrator",
        surfaceId: "surface.chat",
        assemblyBindingId: "chat.output",
      },
      consumer: { abirObjectId: "interface.chat.http", abirPortId: "response.in" },
      resolution: { mode: "exact" },
    },
  ];
  currentRecipe.contractBindings = [
    ...chatBindings,
    ...currentRecipe.contractBindings.filter(({ contractBindingId }) => !contractBindingId.startsWith("contract-binding.chat-")),
  ];
  for (const binding of currentRecipe.contractBindings.filter(({ contractBindingId }) => contractBindingId.startsWith("contract-binding.model-"))) {
    applyBindingResolution(binding, binding.contractBindingId.endsWith("model-request"));
  }
}
for (const report of companions.conformanceReports) delete report.contractRef;

const packageByIdVersion = new Map(companions.packages.map((value) => [`${value.packageId}@${value.version}`, value]));
const sourcePackage = packageByIdVersion.get("package.orchestrator@0.6.0");
const targetPackage = packageByIdVersion.get("package.orchestrator@0.6.1");
const providerPackage = packageByIdVersion.get("package.model-provider@0.6.0");
const exactPackage = (value) => documentRef(value.packageId, value.version, value.contentHash);
const reportParty = ({ descriptor, packageRecord, contract, channelId, roleId }) => ({
  partRef: partRef(descriptor),
  packageRef: exactPackage(packageRecord),
  contractRef: contractRef(contract),
  channelId,
  roleId,
});
for (const report of companions.conformanceReports) {
  report.chainBindings = [
    {
      contractBindingId: "contract-binding.model-request",
      recipeRef: documentRef(targetRecipe.id, targetRecipe.version, targetRecipe.contentHash),
      producer: reportParty({
        descriptor: targetDescriptor,
        packageRecord: targetPackage,
        contract: sourceContract,
        channelId: "channel.model-request",
        roleId: "role.orchestrator-model-output",
      }),
      consumer: reportParty({
        descriptor: providerDescriptor,
        packageRecord: providerPackage,
        contract: targetContract,
        channelId: "channel.model-request",
        roleId: "role.model-provider-input",
      }),
      resolution: structuredClone(targetRecipe.contractBindings.find(({ contractBindingId }) => contractBindingId.endsWith("model-request")).resolution),
    },
    {
      contractBindingId: "contract-binding.model-response",
      recipeRef: documentRef(targetRecipe.id, targetRecipe.version, targetRecipe.contentHash),
      producer: reportParty({
        descriptor: providerDescriptor,
        packageRecord: providerPackage,
        contract: targetContract,
        channelId: "channel.model-response",
        roleId: "role.model-provider-output",
      }),
      consumer: reportParty({
        descriptor: targetDescriptor,
        packageRecord: targetPackage,
        contract: sourceContract,
        channelId: "channel.model-response",
        roleId: "role.orchestrator-model-input",
      }),
      resolution: structuredClone(targetRecipe.contractBindings.find(({ contractBindingId }) => contractBindingId.endsWith("model-response")).resolution),
    },
  ];
  report.executedAt = "2026-08-26T09:20:01Z";
  report.expiresAt = "2027-08-26T09:20:01Z";
  report.results.forEach((result, index) => {
    const second = String(10 + index * 2).padStart(2, "0");
    const finishSecond = String(11 + index * 2).padStart(2, "0");
    result.startedAt = `2026-08-26T09:19:${second}Z`;
    result.finishedAt = `2026-08-26T09:19:${finishSecond}Z`;
    const suffix = result.testVectorId.slice("test.".length);
    result.evidenceArtifactRef = artifactRef(`artifact.test-result.${suffix}`);
    if (result.testVectorId === "test.chain-execution") {
      result.startedAt = "2026-08-26T09:20:00Z";
      result.finishedAt = "2026-08-26T09:20:01Z";
    }
  });
  const passed = report.results.filter(({ status }) => status === "passed").length;
  const failed = report.results.filter(({ status }) => status === "failed").length;
  const skipped = report.results.filter(({ status }) => status === "skipped").length;
  report.summary = {
    total: report.results.length,
    passed,
    failed,
    skipped,
    outcome: failed > 0 ? "failed" : skipped > 0 ? "incomplete" : "passed",
  };
  delete report.chainBinding;
  delete report.contractRef;
}
const payloadArtifacts = {
  request: artifactRef("artifact.payload.model-request"),
  providerResponse: artifactRef("artifact.payload.model-response-provider"),
  consumerResponse: artifactRef("artifact.payload.model-response-orchestrator"),
};
const structure = (contract, structureId) => contract.structures.find((value) => value.structureId === structureId);
const requestSourceStructure = structure(sourceContract, "structure.model-request");
const requestTargetStructure = structure(targetContract, "structure.model-request");
const responseSourceStructure = structure(targetContract, "structure.model-response");
const responseTargetStructure = structure(sourceContract, "structure.model-response");
const exchangeSide = ({ descriptor, packageRecord, roleId, observedAt, contract, channelId, contractStructure, payloadArtifactRef }) => ({
  partRef: partRef(descriptor),
  packageRef: exactPackage(packageRecord),
  roleId,
  observedAt,
  contractRef: contractRef(contract),
  channelId,
  structureId: contractStructure.structureId,
  payloadSchema: {
    schemaRef: contractStructure.schema.schemaRef,
    schemaContentHash: contractStructure.schema.schemaContentHash,
    schemaBundleRef: structuredClone(contractStructure.schema.schemaBundleRef),
  },
  payloadArtifactRef,
  payloadDigest: payloadArtifactRef.contentHash,
});
const requestEvent = events.find(({ eventId }) => eventId.startsWith("66666666"));
const responseEvent = events.find(({ eventId }) => eventId.startsWith("77777777"));
for (const event of events) {
  event.subject.abirRef = documentRef(abir.id, abir.version, abir.contentHash);
  event.subject.recipeRef = documentRef(
    event.runId.endsWith("-01") ? recipe.id : targetRecipe.id,
    event.runId.endsWith("-01") ? recipe.version : targetRecipe.version,
    event.runId.endsWith("-01") ? recipe.contentHash : targetRecipe.contentHash,
  );
  delete event.subject.abirId;
  delete event.subject.recipeId;
  delete event.subject.recipeContentHash;
  if (event.subject.standardPartBindingId === "binding.standard-orchestrator") {
    event.subject.objectId = "component.orchestrator";
    if (event.eventType === "model.requested") event.subject.portId = "model.request";
    else if (event.eventType === "model.responded") event.subject.portId = "model.response";
    else delete event.subject.portId;
  }
}
requestEvent.contractExchange = {
  contractBindingId: "contract-binding.model-request",
  messageId: "message.model-request-candidate",
  correlationId: "correlation.model-candidate",
  attempt: 1,
  idempotencyKey: readJson("examples/minimal-agent/artifacts/model-request.json").requestId,
  producer: exchangeSide({
    descriptor: targetDescriptor,
    packageRecord: targetPackage,
    roleId: "role.orchestrator-model-output",
    observedAt: "2026-08-26T09:20:00.090Z",
    contract: sourceContract,
    channelId: "channel.model-request",
    contractStructure: requestSourceStructure,
    payloadArtifactRef: payloadArtifacts.request,
  }),
  consumer: exchangeSide({
    descriptor: providerDescriptor,
    packageRecord: providerPackage,
    roleId: "role.model-provider-input",
    observedAt: "2026-08-26T09:20:00.100Z",
    contract: targetContract,
    channelId: "channel.model-request",
    contractStructure: requestTargetStructure,
    payloadArtifactRef: payloadArtifacts.request,
  }),
  resolution: structuredClone(targetRecipe.contractBindings.find(({ contractBindingId }) => contractBindingId.endsWith("model-request")).resolution),
  outcome: "accepted",
};
requestEvent.subject.objectId = "component.orchestrator";
requestEvent.subject.portId = "model.request";
requestEvent.subject.standardPartBindingId = "binding.standard-orchestrator";
requestEvent.subject.partRef = partRef(targetDescriptor);
requestEvent.subject.packageRef = exactPackage(targetPackage);
delete requestEvent.payloadSchema;
responseEvent.contractExchange = {
  contractBindingId: "contract-binding.model-response",
  messageId: "message.model-response-candidate",
  correlationId: "correlation.model-candidate",
  causationMessageId: "message.model-request-candidate",
  attempt: 1,
  producer: exchangeSide({
    descriptor: providerDescriptor,
    packageRecord: providerPackage,
    roleId: "role.model-provider-output",
    observedAt: "2026-08-26T09:20:00.870Z",
    contract: targetContract,
    channelId: "channel.model-response",
    contractStructure: responseSourceStructure,
    payloadArtifactRef: payloadArtifacts.providerResponse,
  }),
  consumer: exchangeSide({
    descriptor: targetDescriptor,
    packageRecord: targetPackage,
    roleId: "role.orchestrator-model-input",
    observedAt: "2026-08-26T09:20:00.880Z",
    contract: sourceContract,
    channelId: "channel.model-response",
    contractStructure: responseTargetStructure,
    payloadArtifactRef: payloadArtifacts.consumerResponse,
  }),
  resolution: structuredClone(targetRecipe.contractBindings.find(({ contractBindingId }) => contractBindingId.endsWith("model-response")).resolution),
  outcome: "accepted",
};
responseEvent.subject.objectId = "component.orchestrator";
responseEvent.subject.portId = "model.response";
responseEvent.subject.standardPartBindingId = "binding.standard-orchestrator";
responseEvent.subject.partRef = partRef(targetDescriptor);
responseEvent.subject.packageRef = exactPackage(targetPackage);
delete responseEvent.payloadSchema;

const localArtifactPath = (artifactId, version) => {
  if (artifactId === "artifact.payload.model-request") return "examples/minimal-agent/artifacts/model-request.json";
  if (artifactId === "artifact.payload.model-response-provider") return "examples/minimal-agent/artifacts/model-response-provider.json";
  if (artifactId === "artifact.payload.model-response-orchestrator") return "examples/minimal-agent/artifacts/model-response-orchestrator.json";
  if (artifactId === "artifact.orchestrator-defaults") return "examples/minimal-agent/artifacts/orchestrator-defaults.json";
  if (artifactId === "artifact.contract-migration-checkpoint") return "examples/minimal-agent/artifacts/migration-checkpoint.json";
  if (artifactId === "artifact.orchestrator-package" && version === "0.6.0") return "examples/minimal-agent/artifacts/package-orchestrator-0.6.0.json";
  if (artifactId === "artifact.orchestrator-package" && version === "0.6.1") return "examples/minimal-agent/artifacts/package-orchestrator-0.6.1.json";
  if (artifactId === "artifact.model-provider-package") return "examples/minimal-agent/artifacts/package-model-provider-0.6.0.json";
  if (artifactId === "artifact.system-prompt") return "examples/minimal-agent/artifacts/system-prompt.md";
  if (artifactId === "artifact.contract-adapter") return "examples/minimal-agent/artifacts/contract-adapter.mjs";
  if (artifactId === "artifact.contract-adapter-rollback") return "examples/minimal-agent/artifacts/contract-adapter-rollback.mjs";
  if (artifactId === "artifact.conformance-events") return eventsPath;
  if (artifactId === "artifact.contract-check-result.request") return "examples/minimal-agent/artifacts/tests/contract-request.result.json";
  if (artifactId === "artifact.contract-check-result.response") return "examples/minimal-agent/artifacts/tests/contract-response.result.json";
  if (artifactId === "artifact.contract-checker") return "examples/minimal-agent/artifacts/tests/contract-checker.mjs";
  if (artifactId === "artifact.conformance-runner") return "examples/minimal-agent/artifacts/tests/conformance-runner.mjs";
  if (artifactId === "artifact.algorithm.occurred-at-delta") return "examples/minimal-agent/artifacts/occurred-at-delta.mjs";
  if (artifactId === "artifact.environment-control.os") return "examples/minimal-agent/artifacts/environment-control-os.json";
  if (artifactId === "artifact.environment-control.runtime-load") return "examples/minimal-agent/artifacts/environment-control-runtime-load.json";
  if (artifactId === "artifact.notice.wgp") return "examples/minimal-agent/artifacts/supply-chain/NOTICE.txt";
  if (artifactId === "artifact.sbom.orchestrator") return `examples/minimal-agent/artifacts/supply-chain/orchestrator-${version}.sbom.json`;
  if (artifactId === "artifact.provenance.orchestrator") return `examples/minimal-agent/artifacts/supply-chain/orchestrator-${version}.provenance.json`;
  if (artifactId === "artifact.sbom.model-provider") return "examples/minimal-agent/artifacts/supply-chain/model-provider-0.6.0.sbom.json";
  if (artifactId === "artifact.provenance.model-provider") return "examples/minimal-agent/artifacts/supply-chain/model-provider-0.6.0.provenance.json";
  for (const kind of ["input", "expected", "result", "checker"]) {
    const prefix = `artifact.test-${kind}.`;
    if (artifactId.startsWith(prefix)) return `examples/minimal-agent/artifacts/tests/${artifactId.slice(prefix.length)}.${kind === "checker" ? "checker.mjs" : `${kind}.json`}`;
  }
  return undefined;
};
const mediaTypeFor = (localPath) => localPath?.endsWith(".mjs") ? "text/javascript"
  : localPath?.endsWith(".jsonl") ? "application/x-ndjson"
    : localPath?.endsWith(".txt") ? "text/plain" : "application/json";
const artifactRefs = new Map();
const collectArtifactRefs = (value) => {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) return value.forEach(collectArtifactRefs);
  if (Object.keys(value).length === 3 && "artifactId" in value && "version" in value && "contentHash" in value) {
    artifactRefs.set(`${value.artifactId}@${value.version}`, value);
  }
  Object.values(value).forEach(collectArtifactRefs);
};
for (const value of documents.values()) collectArtifactRefs(value);
events.forEach(collectArtifactRefs);
for (const assessment of companions.contractCompatibilityAssessments) collectArtifactRefs(assessment);
artifactRefs.set("artifact.conformance-events@0.6.0", artifactRef("artifact.conformance-events"));
for (const artifactObject of abir.objects.artifacts) artifactRefs.set(
  `${artifactObject.id}@${artifactObject.version}`,
  artifactRef(artifactObject.id, artifactObject.version, artifactObject.digest),
);
const externalArtifact = (artifactId, version) => {
  const packageRecord = companions.packages.find((candidate) => candidate.artifactRef.artifactId === artifactId && candidate.artifactRef.version === version);
  if (packageRecord) return { locator: packageRecord.locator, contentHash: packageRecord.artifactRef.contentHash, mediaType: packageRecord.mediaType };
  const object = abir.objects.artifacts.find((candidate) => candidate.id === artifactId && candidate.version === version);
  if (object) return { locator: object.locator, contentHash: object.digest, mediaType: object.mediaType };
  return undefined;
};
companions.artifactRecords = [...artifactRefs.values()].map((ref) => {
  const localPath = localArtifactPath(ref.artifactId, ref.version);
  if (localPath) {
    const bytes = ref.artifactId === "artifact.conformance-events"
      ? Buffer.from(`${events.map((event) => JSON.stringify(event)).join("\n")}\n`)
      : fs.readFileSync(path.join(root, localPath));
    return {
      artifactId: ref.artifactId,
      version: ref.version,
      contentHash: sha256(bytes),
      locator: `https://raw.githubusercontent.com/pingta-guangpingwang/wgp-agent-bodification-flow/v0.6.0/${localPath}`,
      mediaType: mediaTypeFor(localPath),
      verification: { mode: "localFile", localPath },
    };
  }
  const external = externalArtifact(ref.artifactId, ref.version);
  if (!external) throw new Error(`No artifact resolution record for ${ref.artifactId}@${ref.version}`);
  return {
    artifactId: ref.artifactId,
    version: ref.version,
    contentHash: external.contentHash,
    locator: external.locator,
    mediaType: external.mediaType,
    verification: { mode: "externalDigest" },
  };
}).sort((left, right) => `${left.artifactId}@${left.version}`.localeCompare(`${right.artifactId}@${right.version}`));

for (const packageRecord of companions.packages) {
  const artifactRecord = companions.artifactRecords.find(({ artifactId, version }) =>
    artifactId === packageRecord.artifactRef.artifactId && version === packageRecord.artifactRef.version);
  packageRecord.artifactRef.contentHash = artifactRecord.contentHash;
  delete packageRecord.locator;
  delete packageRecord.mediaType;
  delete packageRecord.sizeBytes;
  packageRecord.signature = { status: "unsigned" };
}
for (const artifactObject of abir.objects.artifacts) {
  const artifactRecord = companions.artifactRecords.find(({ artifactId, version }) =>
    artifactId === artifactObject.id && version === artifactObject.version);
  if (!artifactRecord) continue;
  artifactObject.digest = artifactRecord.contentHash;
  delete artifactObject.locator;
  delete artifactObject.mediaType;
}

const exactRefKey = (value) => {
  if (!value || typeof value !== "object") return undefined;
  if ("partId" in value && "version" in value && "contentHash" in value) return `part:${value.partId}@${value.version}`;
  if ("contractId" in value && "version" in value && "contentHash" in value) return `contract:${value.contractId}@${value.version}`;
  if ("artifactId" in value && "version" in value && "contentHash" in value) return `artifact:${value.artifactId}@${value.version}`;
  if ("id" in value && "version" in value && "contentHash" in value) return `document:${value.id}@${value.version}`;
  return undefined;
};
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
  sourceContract,
  targetContract,
  sourceDescriptor,
  targetDescriptor,
  providerDescriptor,
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
const referenceDocuments = [...documents.values(), ...events];
const ownerKeys = owners.map(ownerKey);
if (ownerKeys.some((key) => key === undefined)) throw new Error("Every canonical-hash owner must have an exact-reference identity");
if (new Set(ownerKeys).size !== ownerKeys.length) throw new Error("Canonical-hash owner identities must be unique");
let changedReferenceKeys = new Set();
const updateExactRefs = (value, index) => {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.reduce((changed, item) => updateExactRefs(item, index) || changed, false);
  let changed = false;
  const keys = Object.keys(value);
  if (keys.length === 3) {
    const key = exactRefKey(value);
    const hash = key ? index.get(key) : undefined;
    if (hash && value.contentHash !== hash) {
      changedReferenceKeys.add(`${key}: ${value.contentHash} -> ${hash}`);
      value.contentHash = hash;
      changed = true;
    }
  }
  for (const child of Object.values(value)) changed = updateExactRefs(child, index) || changed;
  return changed;
};
const updateRuntimeEvidence = () => {
  const digestByEventId = new Map(events.map((event) => [event.eventId, sha256(canonicalJson(event))]));
  chainResult.events = [requestEvent, responseEvent].map((event) => ({
    eventId: event.eventId,
    eventDigest: digestByEventId.get(event.eventId),
    bindingId: event.contractExchange.contractBindingId,
  }));
  for (const report of companions.conformanceReports) {
    for (const result of report.results) {
      delete result.evidenceLocator;
      delete result.evidenceDigest;
      if (["passed", "failed"].includes(result.status)) {
        const suffix = result.testVectorId.slice("test.".length);
        const evidenceRecord = companions.artifactRecords.find(({ artifactId }) => artifactId === `artifact.test-result.${suffix}`);
        result.evidenceArtifactRef = artifactRef(evidenceRecord.artifactId, evidenceRecord.version, evidenceRecord.contentHash);
      }
      const vector = suite.testVectors.find(({ testVectorId }) => testVectorId === result.testVectorId);
      if (vector?.aspects.includes("chainExecution")) {
        result.runtimeEventRefs = [requestEvent, responseEvent].map((event) => ({ eventId: event.eventId, eventDigest: digestByEventId.get(event.eventId) }));
      } else {
        delete result.runtimeEventRefs;
      }
    }
  }
};
let stabilized = false;
for (let iteration = 0; iteration < 64; iteration += 1) {
  const changedOwners = [];
  changedReferenceKeys = new Set();
  const artifactIndex = new Map(companions.artifactRecords.map((record) => [`artifact:${record.artifactId}@${record.version}`, record.contentHash]));
  const ownerIndex = new Map(owners.map((owner) => [ownerKey(owner), owner.contentHash]));
  const referenceIndex = new Map([...ownerIndex, ...artifactIndex]);
  const referencesChanged = referenceDocuments.reduce((any, value) => updateExactRefs(value, referenceIndex) || any, false);
  let changed = referencesChanged;
  for (const event of events) {
    event.subject.abirRef = documentRef(abir.id, abir.version, abir.contentHash);
    event.subject.recipeRef = documentRef(
      event.runId.endsWith("-01") ? recipe.id : targetRecipe.id,
      event.runId.endsWith("-01") ? recipe.version : targetRecipe.version,
      event.runId.endsWith("-01") ? recipe.contentHash : targetRecipe.contentHash,
    );
  }
  for (const event of [requestEvent, responseEvent]) {
    for (const side of [event.contractExchange.producer, event.contractExchange.consumer]) {
      side.payloadDigest = side.payloadArtifactRef.contentHash;
    }
  }
  updateRuntimeEvidence();
  const eventsBytes = Buffer.from(`${events.map((event) => JSON.stringify(event)).join("\n")}\n`);
  const eventsRecord = companions.artifactRecords.find(({ artifactId }) => artifactId === "artifact.conformance-events");
  const eventsHash = sha256(eventsBytes);
  if (eventsRecord.contentHash !== eventsHash) {
    eventsRecord.contentHash = eventsHash;
    changed = true;
  }
  const chainResultRecord = companions.artifactRecords.find(({ artifactId }) => artifactId === "artifact.test-result.chain-execution");
  const chainResultHash = sha256(Buffer.from(`${JSON.stringify(chainResult, null, 2)}\n`));
  if (chainResultRecord.contentHash !== chainResultHash) {
    chainResultRecord.contentHash = chainResultHash;
    changed = true;
  }
  for (const owner of owners) {
    const calculated = canonicalHashWithout(owner, "contentHash");
    if (owner.contentHash !== calculated) {
      owner.contentHash = calculated;
      changed = true;
      changedOwners.push(ownerKey(owner));
    }
  }
  if (iteration >= 60) console.error(`hash iteration ${iteration}: refs=${[...changedReferenceKeys].join(" | ")} owners=${changedOwners.join(", ")}`);
  if (!changed) {
    stabilized = true;
    break;
  }
}
if (!stabilized) throw new Error("Example exact-reference hashes did not stabilize; the object graph may contain a digest cycle");
const finalReferenceIndex = new Map([
  ...owners.map((owner) => [ownerKey(owner), owner.contentHash]),
  ...companions.artifactRecords.map((record) => [`artifact:${record.artifactId}@${record.version}`, record.contentHash]),
]);
const assertExactRefs = (value, pointer = "") => {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) return value.forEach((item, index) => assertExactRefs(item, `${pointer}/${index}`));
  const keys = Object.keys(value);
  if (keys.length === 3 && "version" in value && "contentHash" in value) {
    const key = "partId" in value ? `part:${value.partId}@${value.version}`
      : "contractId" in value ? `contract:${value.contractId}@${value.version}`
        : "artifactId" in value ? `artifact:${value.artifactId}@${value.version}`
          : "id" in value ? `document:${value.id}@${value.version}` : undefined;
    if (!key || !finalReferenceIndex.has(key)) throw new Error(`Unresolved exact reference at ${pointer || "/"}: ${key ?? "unknown shape"}`);
    if (finalReferenceIndex.get(key) !== value.contentHash) throw new Error(`Stale exact reference at ${pointer || "/"}: ${key}`);
  }
  for (const [key, child] of Object.entries(value)) assertExactRefs(child, `${pointer}/${key}`);
};
referenceDocuments.forEach((document) => assertExactRefs(document));

for (const records of [companions.evidenceStatusRecords, companions.registryRecords]) {
  const groups = Map.groupBy(records, (record) => record.reportRef ? `${record.reportRef.id}@${record.reportRef.version}` : record.registryId);
  for (const group of groups.values()) {
    group.sort((left, right) => left.revision - right.revision);
    let previous;
    for (const record of group) {
      if (record.revision > 1) record.previousRecordHash = previous;
      else delete record.previousRecordHash;
      record.recordHash = canonicalHashWithout(record, "recordHash");
      previous = record.recordHash;
    }
  }
}

const packageOperationPath = "/standardPartBindings/0/packageRef";
if (!diff.operations.some(({ path: operationPath }) => operationPath === packageOperationPath)) {
  diff.operations.splice(1, 0, {
    id: "operation.replace-standard-part-package",
    op: "replace",
    path: packageOperationPath,
    value: structuredClone(targetRecipe.standardPartBindings[0].packageRef),
    precondition: { path: packageOperationPath, exists: true, contentHash: `sha256:${"0".repeat(64)}` },
    restartRequired: true,
    reason: "Replace the source implementation package with the target part's independently pinned package.",
    compensation: {
      op: "replace",
      path: packageOperationPath,
      value: structuredClone(recipe.standardPartBindings[0].packageRef),
      precondition: { path: packageOperationPath, exists: true, contentHash: `sha256:${"0".repeat(64)}` },
    },
  });
}
const restartRisk = diff.riskAssessments.find(({ id }) => id === "risk.restart-availability");
if (restartRisk && !restartRisk.affectedPaths.includes(packageOperationPath)) restartRisk.affectedPaths.push(packageOperationPath);
const resolvePointer = (document, pointer) => pointer.split("/").slice(1).reduce(
  (current, token) => current[token.replaceAll("~1", "/").replaceAll("~0", "~")],
  document,
);
for (const operation of diff.operations) {
  operation.precondition.contentHash = sha256(canonicalJson(resolvePointer(recipe, operation.path)));
  operation.compensation.precondition.contentHash = sha256(canonicalJson(resolvePointer(targetRecipe, operation.path)));
}
diff.baseVersion = recipe.version;
diff.baseContentHash = recipe.contentHash;
diff.targetVersion = targetRecipe.version;
diff.targetContentHash = targetRecipe.contentHash;
for (const precondition of diff.preconditions) {
  if (precondition.kind === "contentHash") precondition.expectedHash = recipe.contentHash;
  if (precondition.kind === "recipeVersion") precondition.expectedVersion = recipe.version;
}
delete evaluation.subject.abirContentHash;
evaluation.baseline.recipeContentHash = recipe.contentHash;
evaluation.candidate.recipeContentHash = targetRecipe.contentHash;
evaluation.protocol.fixture.contentHash = canonicalHashWithout(evaluation.protocol.fixture, "contentHash");
evaluation.protocol.modelStreamControl.contentHash = canonicalHashWithout(evaluation.protocol.modelStreamControl, "contentHash");
const environmentDigest = sha256(canonicalJson(evaluation.protocol.environmentControls));
for (const trial of evaluation.trials) {
  trial.recipeContentHash = trial.variant === "baseline" ? recipe.contentHash : targetRecipe.contentHash;
  trial.environmentDigest = environmentDigest;
  trial.modelStreamDigest = evaluation.protocol.modelStreamControl.contentHash;
}

for (const [relativePath, value] of documents) writeJson(relativePath, value);
fs.writeFileSync(path.join(root, eventsPath), `${events.map((event) => JSON.stringify(event)).join("\n")}\n`);
writeJson(chainResultPath, chainResult);
console.log(`Updated ${owners.length} canonical content hashes, ${companions.artifactRecords.length} artifact records, and ${events.length} RuntimeEvent references.`);
