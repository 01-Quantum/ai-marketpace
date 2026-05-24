import {
  LogisticFeatureView,
  LogisticPrediction,
  LogisticRegressionModel,
} from './logistic-regression-model.types';

export function toFeatureViews(
  model: LogisticRegressionModel,
  inputs?: number[],
): LogisticFeatureView[] {
  return model.features.map((feature, index) => {
    const inputValue = inputs?.[index] ?? feature.inputValue;
    return {
      ...feature,
      inputValue,
      contribution: feature.weight * inputValue,
    };
  });
}

export function predictLogisticRegression(
  model: LogisticRegressionModel,
  inputs?: number[],
): LogisticPrediction {
  const views = toFeatureViews(model, inputs);
  const linearScore = model.intercept + views.reduce((sum, row) => sum + row.contribution, 0);
  const probability = 1 / (1 + Math.exp(-linearScore));
  const classIndex = probability >= model.threshold ? 0 : 1;
  const className = model.classes[classIndex] ?? model.classes[0];

  return { linearScore, probability, className, classIndex };
}

export function topContributions(
  views: LogisticFeatureView[],
  direction: 'positive' | 'negative',
  limit = 8,
): LogisticFeatureView[] {
  const filtered =
    direction === 'positive'
      ? views.filter((row) => row.contribution > 0)
      : views.filter((row) => row.contribution < 0);

  return [...filtered]
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, limit);
}
