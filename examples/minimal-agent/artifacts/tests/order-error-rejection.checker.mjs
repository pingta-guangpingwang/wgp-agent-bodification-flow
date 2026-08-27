import fs from "node:fs";
import { isDeepStrictEqual } from "node:util";

const [inputPath, expectedPath, resultPath] = process.argv.slice(2);
const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
const contract = JSON.parse(fs.readFileSync(input.contractPath, "utf8"));
const channel = contract.channels.find(({ channelId }) => channelId === input.channelId);
const message = input.message;
const reasons = [];
if (message.attempt > channel.reliability.retry.maxAttempts) reasons.push("attempt-exceeds-limit");
if (channel.reliability.idempotency.mode === "none" && message.idempotencyKey !== undefined) reasons.push("idempotency-key-forbidden");
if (channel[channel.interaction].ordering.mode === "none"
  && (message.orderingDomain !== undefined || message.orderingSequence !== undefined)) reasons.push("ordering-metadata-forbidden");
const unknown = channel.reliability.errorHandling.unknownError;
if (message.error.classification === "unknown"
  && (message.error.retryable !== unknown.retryable || message.error.terminal !== unknown.terminal)) reasons.push("unknown-error-policy-mismatch");
const computed = { outcome: reasons.length > 0 ? "rejected" : "accepted", reasons: reasons.sort() };
const normalizedExpected = { ...expected, reasons: [...expected.reasons].sort() };
const normalizedResult = { ...result, reasons: [...result.reasons].sort() };
if (channel?.producerRoleId !== input.producerRoleId
  || !channel?.consumerRoleIds.includes(input.consumerRoleId)
  || !isDeepStrictEqual(computed, normalizedExpected)
  || !isDeepStrictEqual(computed, normalizedResult)) process.exitCode = 1;
