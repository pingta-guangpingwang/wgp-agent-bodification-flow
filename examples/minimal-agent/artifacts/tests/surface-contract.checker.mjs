import fs from "node:fs";
import { isDeepStrictEqual } from "node:util";

const [inputPath, expectedPath, resultPath] = process.argv.slice(2);
const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
const load = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const structureFor = (contract, channel) => contract.structures.find(({ structureId }) => structureId === (
  channel.interaction === "message" ? channel.message.payloadStructureId
    : channel.interaction === "stream" ? channel.stream.chunk.structureId
      : channel.interaction === "event" ? channel.event.eventStructureId
        : channel.state.snapshotStructureId
));
const checks = input.bindings.map((binding) => {
  const source = load(binding.sourceContractPath);
  const target = load(binding.targetContractPath);
  const sourceChannel = source.channels.find(({ channelId }) => channelId === binding.sourceChannelId);
  const targetChannel = target.channels.find(({ channelId }) => channelId === binding.targetChannelId);
  const sourceRole = source.roles.find(({ roleId }) => roleId === binding.sourceRoleId);
  const targetRole = target.roles.find(({ roleId }) => roleId === binding.targetRoleId);
  const sourceStructure = structureFor(source, sourceChannel);
  const targetStructure = structureFor(target, targetChannel);
  const fieldsEqual = isDeepStrictEqual(sourceStructure.fields, targetStructure.fields);
  return {
    bindingId: binding.bindingId,
    schemaClosed: Boolean(sourceStructure.schema.schemaContentHash && targetStructure.schema.schemaContentHash
      && sourceStructure.schema.schemaBundleRef.contentHash && targetStructure.schema.schemaBundleRef.contentHash),
    fieldSemanticsAccountedFor: fieldsEqual || binding.resolution === "adapter",
    protocolComposable: sourceChannel.interaction === targetChannel.interaction
      && isDeepStrictEqual(sourceChannel.protocol, targetChannel.protocol),
    rolesDirected: sourceChannel.producerRoleId === binding.sourceRoleId
      && sourceRole?.kind === "producer"
      && targetChannel.consumerRoleIds.includes(binding.targetRoleId)
      && targetRole?.kind === "consumer",
    responseAdapterPinned: binding.bindingId !== "contract-binding.model-response" || binding.resolution === "adapter",
  };
});
const computed = {
  outcome: checks.every((check) => Object.values(check).slice(1).every(Boolean)) ? "passed" : "failed",
  verifiedBindings: checks.filter((check) => Object.values(check).slice(1).every(Boolean)).map(({ bindingId }) => bindingId),
  assertions: {
    schemaClosed: checks.every(({ schemaClosed }) => schemaClosed),
    fieldSemanticsAccountedFor: checks.every(({ fieldSemanticsAccountedFor }) => fieldSemanticsAccountedFor),
    protocolComposable: checks.every(({ protocolComposable }) => protocolComposable),
    rolesDirected: checks.every(({ rolesDirected }) => rolesDirected),
    responseAdapterPinned: checks.every(({ responseAdapterPinned }) => responseAdapterPinned),
  },
};
if (!isDeepStrictEqual(result, computed)
  || result.outcome !== expected.outcome
  || !expected.requiredBindings.every((bindingId) => result.verifiedBindings.includes(bindingId))
  || !expected.requiredAssertions.every((assertion) => result.assertions[assertion] === true)) process.exitCode = 1;
