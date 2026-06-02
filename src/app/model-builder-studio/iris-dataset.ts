export const IRIS_FEATURE_NAMES = [
  'sepal length (cm)',
  'sepal width (cm)',
  'petal length (cm)',
  'petal width (cm)',
] as const;

export const IRIS_FEATURE_KEYS = [
  'sepal_length',
  'sepal_width',
  'petal_length',
  'petal_width',
] as const;

export type IrisFeatureKey = (typeof IRIS_FEATURE_KEYS)[number];

export const IRIS_CLASSES = ['setosa', 'versicolor', 'virginica'] as const;

export type IrisClass = (typeof IRIS_CLASSES)[number];

export interface BatchTestRow {
  id: number;
  sepal_length: number;
  sepal_width: number;
  petal_length: number;
  petal_width: number;
  expected: string;
}

export type BatchField = keyof Omit<BatchTestRow, 'id'>;

export interface BatchTestResultRow {
  id: number;
  prediction: string;
  expected: string;
  passed: boolean;
}

export interface BatchTestResult {
  rows: BatchTestResultRow[];
  passed: number;
  total: number;
}

export interface BatchRegressionResultRow {
  id: number;
  prediction: number;
  expected: number;
  residual: number;
}

export interface BatchRegressionResult {
  rows: BatchRegressionResultRow[];
  meanAbsoluteError: number;
  total: number;
}

export function batchRowToFeatures(row: {
  sepal_length: number;
  sepal_width: number;
  petal_length: number;
  petal_width: number;
}): number[] {
  return [row.sepal_length, row.sepal_width, row.petal_length, row.petal_width];
}

export function defaultIrisSample(): number[] {
  return [0, 0, 0, 0];
}

export function irisClassIndex(className: string): number {
  const index = IRIS_CLASSES.indexOf(className as IrisClass);
  return index === -1 ? 0 : index;
}
