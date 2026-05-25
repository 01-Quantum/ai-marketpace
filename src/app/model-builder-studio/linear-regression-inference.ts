import {
  BatchRegressionResult,
  BatchTestRow,
  IRIS_CLASSES,
  batchRowToFeatures,
  irisClassIndex,
} from './iris-dataset';
import { LinearPrediction, LinearRegressionModel } from './linear-regression-model.types';

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
  rows: BatchTestRow[],
): BatchRegressionResult {
  const resultRows = rows.map((row) => {
    const prediction = predictLinearRegression(model, batchRowToFeatures(row));
    const expected = irisClassIndex(row.expected);
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
  const classNames = IRIS_CLASSES.join(' / ');
  return `${model.target} (${classNames})`;
}
