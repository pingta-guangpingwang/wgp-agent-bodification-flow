import fs from "node:fs";

const [inputPath, expectedPath, resultPath] = process.argv.slice(2);
const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
const recipe = JSON.parse(fs.readFileSync(input.recipePath, "utf8"));
const descriptor = JSON.parse(fs.readFileSync(input.descriptorPath, "utf8"));
const schema = JSON.parse(fs.readFileSync(input.schemaPath, "utf8"));
const defaults = JSON.parse(fs.readFileSync(input.defaultsPath, "utf8"));
const configuration = recipe.componentBindings.find(({ componentId }) => componentId === input.componentId)?.config;
const schemaValid = configuration
  && schema.required.every((field) => Object.hasOwn(configuration, field))
  && Object.keys(configuration).every((field) => Object.hasOwn(schema.properties, field))
  && typeof configuration.systemPromptArtifactId === "string"
  && Number.isInteger(configuration.maxTokens)
  && configuration.maxTokens >= schema.properties.maxTokens.minimum
  && typeof configuration.stream === "boolean";
const overriddenFields = Object.keys(defaults).filter((field) => configuration[field] !== defaults[field]);
const valid = result.outcome === expected.outcome
  && schemaValid === expected.schemaValid
  && result.schemaValid === schemaValid
  && descriptor.configuration.schemaRef === schema.$id
  && expected.overriddenFields.every((field) => overriddenFields.includes(field))
  && result.defaultsApplied === expected.defaultsApplied
  && result.overriddenFields.every((field) => overriddenFields.includes(field))
  && result.resolvedMaxTokens === configuration.maxTokens;
if (!valid) process.exitCode = 1;
