import {
  LinearFeature,
  LinearRegressionModel,
} from './linear-regression-model.types';

export const DEFAULT_LINEAR_REGRESSION_MODEL: LinearRegressionModel = {
  intercept: 0,
  features: [],
  target: 'target',
  rSquared: 0,
};

export function cloneLinearRegressionModel(model: LinearRegressionModel): LinearRegressionModel {
  return structuredClone(model);
}

export function parseLinearRegressionDocument(json: unknown): LinearRegressionModel | null {
  if (!json || typeof json !== 'object') return null;

  const doc = json as Partial<LinearRegressionModel>;
  if (!Array.isArray(doc.features)) return null;

  const features: LinearFeature[] = doc.features.filter(
    (feature): feature is LinearFeature =>
      !!feature &&
      typeof feature === 'object' &&
      typeof feature.name === 'string' &&
      typeof feature.weight === 'number',
  );

  return {
    intercept: typeof doc.intercept === 'number' ? doc.intercept : 0,
    features,
    target: typeof doc.target === 'string' ? doc.target : 'target',
    rSquared: typeof doc.rSquared === 'number' ? doc.rSquared : 0,
  };
}
