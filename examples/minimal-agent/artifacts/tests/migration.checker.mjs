import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

const [inputPath, expectedPath, resultPath] = process.argv.slice(2);
const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
const source = JSON.parse(fs.readFileSync(input.sourcePayloadPath, "utf8"));
const expectedAdapted = JSON.parse(fs.readFileSync(input.adaptedPayloadPath, "utf8"));
const expectedCheckpoint = JSON.parse(fs.readFileSync(input.checkpointPath, "utf8"));
const migration = await import(pathToFileURL(path.resolve(input.migrationModulePath)).href);
const rollback = await import(pathToFileURL(path.resolve(input.rollbackModulePath)).href);
let checkpoint;
const adapted = migration.adaptModelResponse(source, (value) => { checkpoint = value; });
const restored = rollback.rollbackModelResponse(adapted, checkpoint);
const valid = result.outcome === expected.outcome
  && result.lossPolicy === expected.lossPolicy
  && !Object.hasOwn(adapted, input.droppedField)
  && isDeepStrictEqual(adapted, expectedAdapted)
  && isDeepStrictEqual(checkpoint, expectedCheckpoint)
  && isDeepStrictEqual(restored, source)
  && result.checkpointed === expected.checkpointed
  && result.roundTripRestored === expected.roundTripRestored;
if (!valid) process.exitCode = 1;
