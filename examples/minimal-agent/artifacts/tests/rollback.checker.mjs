import fs from "node:fs";

const [inputPath, expectedPath, resultPath] = process.argv.slice(2);
const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
const source = JSON.parse(fs.readFileSync(input.sourceRecipePath, "utf8"));
const target = JSON.parse(fs.readFileSync(input.targetRecipePath, "utf8"));
const diff = JSON.parse(fs.readFileSync(input.recipeDiffPath, "utf8"));
const pointerTokens = (pointer) => pointer.slice(1).split("/").map((token) => token.replaceAll("~1", "/").replaceAll("~0", "~"));
const setPointer = (document, pointer, value) => {
  const tokens = pointerTokens(pointer);
  const parent = tokens.slice(0, -1).reduce((current, token) => current[token], document);
  parent[tokens.at(-1)] = structuredClone(value);
};
const applied = structuredClone(source);
for (const operation of diff.operations) setPointer(applied, operation.path, operation.value);
applied.version = target.version;
applied.contentHash = target.contentHash;
const restoredRecipe = structuredClone(target);
for (const operation of [...diff.operations].reverse()) setPointer(restoredRecipe, operation.compensation.path, operation.compensation.value);
restoredRecipe.version = source.version;
restoredRecipe.contentHash = source.contentHash;
const exactTarget = JSON.stringify(applied) === JSON.stringify(target);
const restored = JSON.stringify(restoredRecipe) === JSON.stringify(source);
const distinct = source.standardPartBindings[0].packageRef.contentHash !== target.standardPartBindings[0].packageRef.contentHash;
const valid = result.outcome === expected.outcome
  && (!expected.requireDistinctReplacementPackage || distinct)
  && (!expected.requireExactTarget || exactTarget)
  && (!expected.requireExactRestoration || restored)
  && result.replacementWasDistinct === distinct
  && result.exactTarget === exactTarget
  && result.exactRestoration === restored
  && result.recipeCompensationRestored === restored;
if (!valid) process.exitCode = 1;
