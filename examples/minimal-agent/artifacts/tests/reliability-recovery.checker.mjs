import fs from "node:fs";
import { isDeepStrictEqual } from "node:util";

const [inputPath, expectedPath, resultPath] = process.argv.slice(2);
const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
const contract = JSON.parse(fs.readFileSync(input.contractPath, "utf8"));
const channel = contract.channels.find(({ channelId }) => channelId === input.channelId);
const accepted = input.sequence.filter(({ phase }) => phase === "accepted");
const timeout = input.sequence.find(({ phase }) => phase === "timeout");
const retry = input.sequence.find(({ phase }) => phase === "retry");
const duplicate = input.sequence.find(({ phase }) => phase === "duplicate");
const cancel = input.sequence.find(({ phase }) => phase === "cancel");
const key = accepted[0]?.idempotencyKey;
const recovered = channel?.producerRoleId === input.producerRoleId
  && channel?.consumerRoleIds.includes(input.consumerRoleId)
  && timeout?.elapsedMs >= channel.reliability.timeout.durationMs
  && channel.reliability.timeout.onTimeout === "retry"
  && retry?.attempt === timeout.attempt + 1
  && retry.attempt <= channel.reliability.retry.maxAttempts
  && channel.reliability.retry.retryOn.includes(retry.reason)
  && retry.idempotencyKey === key
  && accepted[1]?.attempt === retry.attempt
  && accepted[1]?.idempotencyKey === key;
const duplicateSafe = channel?.reliability.idempotency.mode === "required"
  && duplicate?.idempotencyKey === key
  && duplicate?.disposition === channel.reliability.idempotency.duplicatePolicy
  && duplicate?.sideEffectExecuted === false
  && channel.reliability.delivery === "atMostOnce";
const cancelled = channel?.reliability.cancellation.supported
  && cancel?.propagation === channel.reliability.cancellation.propagation
  && cancel?.acknowledgementMs <= channel.reliability.cancellation.acknowledgementTimeoutMs
  && cancel?.terminal === channel.reliability.cancellation.terminal;
const computed = {
  outcome: recovered && duplicateSafe && cancelled ? "passed" : "failed",
  recoveredAttempt: retry?.attempt,
  duplicateDisposition: duplicate?.disposition,
  sideEffectCount: duplicateSafe ? 1 : 2,
  cancellationAcknowledged: Boolean(cancelled),
};
if (!isDeepStrictEqual(result, computed) || !isDeepStrictEqual(result, expected)) process.exitCode = 1;
