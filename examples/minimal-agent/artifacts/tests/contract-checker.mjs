import fs from "node:fs";
import { isDeepStrictEqual } from "node:util";

const [
  sourceContractPath,
  targetContractPath,
  resultPath,
  sourceChannelId,
  sourceRoleId,
  targetChannelId,
  targetRoleId,
  expectedOutcome,
] = process.argv.slice(2);
const source = JSON.parse(fs.readFileSync(sourceContractPath, "utf8"));
const target = JSON.parse(fs.readFileSync(targetContractPath, "utf8"));
const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
const sourceChannel = source.channels.find(({ channelId }) => channelId === sourceChannelId);
const targetChannel = target.channels.find(({ channelId }) => channelId === targetChannelId);
const structureSlots = (contract, channel) => {
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
const schemaSignature = (contract, channel) => structureSlots(contract, channel).map(([slot, structure]) => [
  slot,
  structure?.schema.schemaContentHash,
]);
const fieldSignature = (contract, channel) => structureSlots(contract, channel).map(([slot, structure]) => [
  slot,
  structure ? { fields: structure.fields, unknownFieldPolicy: structure.unknownFieldPolicy } : undefined,
]);
const errorSignature = (contract, channel) => {
  const errorStructure = structureSlots(contract, channel).find(([slot]) => slot === "error")?.[1];
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
const rank = new Map([["exact", 0], ["compatible", 1], ["migrationRequired", 2], ["incompatible", 3]]);
const schemaPolicy = ({ mode, unknownFieldPolicy }) => ({ mode, unknownFieldPolicy });
const schemaStatus = isDeepStrictEqual(schemaSignature(source, sourceChannel), schemaSignature(target, targetChannel))
  && isDeepStrictEqual(schemaPolicy(source.compatibility), schemaPolicy(target.compatibility))
  ? "exact"
  : "migrationRequired";
const aspectValue = (contract, channel, aspect) => {
  if (aspect === "protocol") return {
    interaction: channel?.interaction,
    connectionCardinality: channel?.connectionCardinality,
    protocol: channel?.protocol,
    compatibilityPolicy: {
      mode: contract.compatibility.mode,
      protocolChange: contract.compatibility.protocolChange,
    },
  };
  if (aspect === "streaming") return channel?.stream;
  if (aspect === "ordering") return channel?.[channel.interaction]?.ordering;
  if (aspect === "delivery") return channel?.reliability.delivery;
  if (aspect === "timeout") return channel?.reliability.timeout;
  if (aspect === "error") return errorSignature(contract, channel);
  if (aspect === "retry") return channel?.reliability.retry;
  if (aspect === "idempotency") return channel?.reliability.idempotency;
  if (aspect === "cancellation") return channel?.reliability.cancellation;
  if (aspect === "state") return channel?.state;
  return undefined;
};
const baseAspects = [
  "schema",
  "fieldSemantics",
  "protocol",
  "ordering",
  "delivery",
  "timeout",
  "error",
  "retry",
  "idempotency",
  "cancellation",
];
const applicableAspects = [
  ...baseAspects,
  ...([sourceChannel?.interaction, targetChannel?.interaction].includes("stream") ? ["streaming"] : []),
  ...([sourceChannel?.interaction, targetChannel?.interaction].includes("state") ? ["state"] : []),
];
const mandatory = {
  schema: schemaStatus,
  fieldSemantics: isDeepStrictEqual(fieldSignature(source, sourceChannel), fieldSignature(target, targetChannel))
    && isDeepStrictEqual(source.compatibility, target.compatibility) ? "exact" : "migrationRequired",
  ...Object.fromEntries(applicableAspects.filter((aspect) => !["schema", "fieldSemantics"].includes(aspect)).map((aspect) => [
    aspect,
    isDeepStrictEqual(aspectValue(source, sourceChannel, aspect), aspectValue(target, targetChannel, aspect)) ? "exact" : "migrationRequired",
  ])),
};
const sourceRole = source.roles.find(({ roleId }) => roleId === sourceRoleId);
const targetRole = target.roles.find(({ roleId }) => roleId === targetRoleId);
const valid = sourceChannel?.producerRoleId === sourceRoleId
  && sourceRole?.kind === "producer"
  && targetChannel?.consumerRoleIds.includes(targetRoleId)
  && targetRole?.kind === "consumer"
  && result.channelId === sourceChannelId
  && sourceChannelId === targetChannelId
  && result.sourceRoleId === sourceRoleId
  && result.targetRoleId === targetRoleId
  && result.direction === `${source.identity.version}-to-${target.identity.version}`
  && result.outcome === expectedOutcome
  && sourceChannel.interaction === targetChannel.interaction
  && applicableAspects.every((aspect) => rank.has(result[aspect]) && rank.get(result[aspect]) >= rank.get(mandatory[aspect]))
  && applicableAspects.reduce(
    (worst, aspect) => rank.get(result[aspect]) > rank.get(worst) ? result[aspect] : worst,
    "exact",
  ) === result.outcome;
if (!valid) process.exitCode = 1;
