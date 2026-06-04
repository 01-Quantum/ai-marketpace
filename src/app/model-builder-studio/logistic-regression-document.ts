import {
  LogisticFeature,
  LogisticRegressionModel,
} from './logistic-regression-model.types';

export const DEFAULT_LOGISTIC_REGRESSION_MODEL: LogisticRegressionModel = {
  intercept: 0,
  features: [],
  classes: [],
  threshold: 0.5,
};

export function cloneLogisticRegressionModel(model: LogisticRegressionModel): LogisticRegressionModel {
  return structuredClone(model);
}

export function parseLogisticRegressionDocument(json: unknown): LogisticRegressionModel | null {
  if (!json || typeof json !== 'object') return null;

  const doc = json as Partial<LogisticRegressionModel>;
  if (!Array.isArray(doc.features)) return null;

  const features: LogisticFeature[] = doc.features.filter(
    (feature): feature is LogisticFeature =>
      !!feature &&
      typeof feature === 'object' &&
      typeof feature.name === 'string' &&
      typeof feature.weight === 'number' &&
      typeof feature.inputValue === 'number',
  );

  const classes = Array.isArray(doc.classes)
    ? doc.classes.filter((value): value is string => typeof value === 'string')
    : [];

  return {
    intercept: typeof doc.intercept === 'number' ? doc.intercept : 0,
    features,
    classes,
    threshold: typeof doc.threshold === 'number' ? doc.threshold : 0.5,
  };
}
