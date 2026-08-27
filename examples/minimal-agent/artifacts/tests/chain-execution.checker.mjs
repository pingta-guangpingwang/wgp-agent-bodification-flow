import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const [inputPath, expectedPath, resultPath] = process.argv.slice(2);
const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
const recipe = JSON.parse(fs.readFileSync(input.recipePath, "utf8"));
const events = fs.readFileSync(input.eventsPath, "utf8").trim().split(/\r?\n/).map(JSON.parse);
const companions = JSON.parse(fs.readFileSync(input.companionPath, "utf8"));
const canonicalJson = (value) => {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
};
const sha256 = (bytes) => `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
const hashWithout = (value, field) => {
  const copy = structuredClone(value);
  delete copy[field];
  return sha256(canonicalJson(copy));
};
const sameRef = (left, right, idField) => left?.[idField] === right?.[idField]
  && left?.version === right?.version
  && left?.contentHash === right?.contentHash;
const resultByEvent = new Map(result.events.map((event) => [event.eventId, event]));
const eventById = new Map(events.map((event) => [event.eventId, event]));
const artifactByKey = new Map(companions.artifactRecords.map((record) => [`${record.artifactId}@${record.version}#${record.contentHash}`, record]));
const standardPartById = new Map(recipe.standardPartBindings.map((binding) => [binding.bindingId, binding]));
const resolveEndpoint = (endpoint) => endpoint.standardPartBindingId ? standardPartById.get(endpoint.standardPartBindingId) : undefined;
const payloadCloses = (party) => {
  const ref = party.payloadArtifactRef;
  const record = artifactByKey.get(`${ref.artifactId}@${ref.version}#${ref.contentHash}`);
  if (!record || record.verification.mode !== "localFile") return false;
  const resolved = path.resolve(record.verification.localPath);
  const bytes = fs.readFileSync(resolved);
  return sha256(bytes) === ref.contentHash && sha256(bytes) === party.payloadDigest;
};
const derivedPackageIds = new Set();
let chainClosed = recipe.id === input.recipeId
  && recipe.version === input.recipeVersion
  && recipe.contentHash === hashWithout(recipe, "contentHash");
for (const requirement of input.requiredBindings) {
  const binding = recipe.contractBindings.find(({ contractBindingId }) => contractBindingId === requirement.bindingId);
  const event = eventById.get(requirement.eventId);
  const resultEvent = resultByEvent.get(requirement.eventId);
  const producerBinding = binding && resolveEndpoint(binding.producer);
  const consumerBinding = binding && resolveEndpoint(binding.consumer);
  const producerParty = event?.contractExchange?.producer;
  const consumerParty = event?.contractExchange?.consumer;
  const eventDigest = event && sha256(canonicalJson(event));
  chainClosed &&= Boolean(binding && event && resultEvent && producerBinding && consumerBinding)
    && resultEvent.bindingId === binding.contractBindingId
    && resultEvent.eventDigest === eventDigest
    && event.contractExchange.contractBindingId === binding.contractBindingId
    && sameRef(event.subject.recipeRef, recipe, "id")
    && JSON.stringify(event.contractExchange.resolution) === JSON.stringify(binding.resolution)
    && sameRef(producerParty?.partRef, producerBinding.descriptorRef, "partId")
    && sameRef(consumerParty?.partRef, consumerBinding.descriptorRef, "partId")
    && sameRef(producerParty?.packageRef, producerBinding.packageRef, "id")
    && sameRef(consumerParty?.packageRef, consumerBinding.packageRef, "id")
    && payloadCloses(producerParty)
    && payloadCloses(consumerParty)
    && producerBinding.packageRef.id !== consumerBinding.packageRef.id;
  if (producerBinding) derivedPackageIds.add(producerBinding.packageRef.id);
  if (consumerBinding) derivedPackageIds.add(consumerBinding.packageRef.id);
}
const valid = result.outcome === expected.outcome
  && chainClosed
  && expected.requiredEventIds.every((id) => resultByEvent.has(id) && eventById.has(id))
  && expected.requiredBindings.every((id) => input.requiredBindings.some(({ bindingId }) => bindingId === id))
  && (!expected.requireDistinctPackages || derivedPackageIds.size >= 2)
  && JSON.stringify([...result.distinctPackageIds].sort()) === JSON.stringify([...derivedPackageIds].sort());
if (!valid) process.exitCode = 1;
