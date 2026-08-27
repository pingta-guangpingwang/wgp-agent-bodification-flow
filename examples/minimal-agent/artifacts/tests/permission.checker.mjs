import fs from "node:fs";

const [inputPath, expectedPath, resultPath] = process.argv.slice(2);
const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
const companions = JSON.parse(fs.readFileSync(input.companionPath, "utf8"));
const policy = companions.permissionPolicies.find(({ id }) => id === input.policyId);
const descriptors = input.descriptorPaths.map((descriptorPath) => JSON.parse(fs.readFileSync(descriptorPath, "utf8")));
const coveredTuples = [];
const mappedRules = [];
for (const descriptor of descriptors) {
  for (const requirement of descriptor.requirements.permissions.filter(({ required }) => required)) {
    for (const action of requirement.actions) {
      for (const resource of requirement.resources) {
        const mapping = policy?.requirementMappings.find((candidate) => candidate.permissionId === requirement.permissionId
          && candidate.scope === requirement.scope
          && candidate.action === action
          && candidate.resource === resource);
        const rule = policy?.rules.find(({ ruleId }) => ruleId === mapping?.ruleId);
        if (!mapping || !rule) process.exitCode = 1;
        else {
          coveredTuples.push(`${descriptor.identity.partId}#${requirement.permissionId}#${requirement.scope}#${action}#${resource}`);
          mappedRules.push(rule);
        }
      }
    }
  }
}
const descriptorPartIds = descriptors.map(({ identity }) => identity.partId).sort();
const valid = result.outcome === expected.outcome
  && policy.id === expected.requiredPolicyId
  && JSON.stringify(descriptorPartIds) === JSON.stringify([...expected.requiredDescriptorPartIds].sort())
  && coveredTuples.length === expected.requiredPermissionTupleCount
  && mappedRules.length === coveredTuples.length
  && mappedRules.every((rule) => rule.effect === expected.decision
    && rule.promptRequired === expected.promptRequired
    && rule.secretValueExposed === expected.secretValueExposed)
  && result.decision === expected.decision
  && result.matchedPolicyId === policy.id
  && JSON.stringify([...result.coveredDescriptorPartIds].sort()) === JSON.stringify(descriptorPartIds)
  && result.coveredPermissionTupleCount === coveredTuples.length
  && result.prompted === expected.promptRequired
  && result.secretValueExposed === expected.secretValueExposed;
if (!valid) process.exitCode = 1;
