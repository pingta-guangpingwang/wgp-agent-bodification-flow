export const rollbackModelRequest = (value) => structuredClone(value);

export const rollbackModelResponse = (value, checkpoint) => ({
  ...value,
  providerMetadata: structuredClone(checkpoint.providerMetadata),
});
