import fs from "node:fs";

const [inputPath, expectedPath, resultPath] = process.argv.slice(2);
const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
const events = fs.readFileSync(input.eventsPath, "utf8").trim().split(/\r?\n/).map(JSON.parse);
const event = events.find(({ eventId }) => eventId === input.responseEventId);
const payload = JSON.parse(fs.readFileSync(input.consumerPayloadPath, "utf8"));
const valid = result.outcome === expected.outcome
  && event?.contractExchange?.outcome === expected.expectedOutcome
  && event.contractExchange.contractBindingId === expected.expectedBindingId
  && event.contractExchange.consumer.payloadArtifactRef.artifactId === "artifact.payload.model-response-orchestrator"
  && payload.content === expected.expectedContent
  && result.responseMatched === true
  && result.exchangeAccepted === true
  && result.bindingMatched === true
  && result.requestId === payload.requestId;
if (!valid) process.exitCode = 1;
