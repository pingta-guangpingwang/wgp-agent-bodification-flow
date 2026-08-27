export const adaptModelRequest = (value) => structuredClone(value);

export const adaptModelResponse = ({ providerMetadata, ...value }, saveCheckpoint) => {
  saveCheckpoint({ providerMetadata: structuredClone(providerMetadata) });
  return value;
};
