import {
  BatchRegressionResult,
  batchRowToFeatureVector,
  parseExpectedValue,
} from './dataset';
import { LinearPrediction, LinearRegressionModel } from './linear-regression-model.types';
import { SampleDataRow } from './sample-data.types';

export function predictLinearRegression(
  model: LinearRegressionModel,
  inputs: number[],
): LinearPrediction {
  const contributions = model.features.map((feature, index) => {
    const input = inputs[index] ?? 0;
    return {
      name: feature.name,
      weight: feature.weight,
      input,
      contribution: feature.weight * input,
    };
  });

  const value =
    model.intercept + contributions.reduce((sum, row) => sum + row.contribution, 0);

  return { value, contributions };
}

export function runLinearRegressionBatch(
  model: LinearRegressionModel,
  rows: SampleDataRow[],
): BatchRegressionResult {
  const featureKeys = model.features.map((feature) => feature.name);

  const resultRows = rows.map((row) => {
    const prediction = predictLinearRegression(model, batchRowToFeatureVector(row, featureKeys));
    const expected = parseExpectedValue(row.expected);
    return {
      id: row.id,
      prediction: prediction.value,
      expected,
      residual: prediction.value - expected,
    };
  });

  const meanAbsoluteError =
    resultRows.length === 0
      ? 0
      : resultRows.reduce((sum, row) => sum + Math.abs(row.residual), 0) / resultRows.length;

  return { rows: resultRows, meanAbsoluteError, total: resultRows.length };
}

export function describeLinearTarget(model: LinearRegressionModel): string {
  return model.target;
}
