import { ModelType } from './model-builder.types';

function countCoefficientParams(modelJson: unknown): number {
  if (!modelJson || typeof modelJson !== 'object') return 0;
  const features = (modelJson as { features?: unknown }).features;
  const featureCount = Array.isArray(features) ? features.length : 0;
  return featureCount;
}

function countTreeParams(modelJson: unknown): number {
  if (!modelJson || typeof modelJson !== 'object') return 0;
  const nodes = (modelJson as { nodes?: unknown }).nodes;
  return Array.isArray(nodes) ? nodes.length : 0;
}

export function computeParamsCount(modelType: ModelType, modelJson: unknown): number {
  switch (modelType) {
    case 'logistic':
      return countCoefficientParams(modelJson);
    case 'tree':
      return countTreeParams(modelJson);
  }
}
