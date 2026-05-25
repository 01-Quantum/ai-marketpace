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

export const IRIS_PUBLISHED_TEST_DATA: BatchTestRow[] = [
  { id: 1, sepal_length: 5.1, sepal_width: 3.5, petal_length: 1.4, petal_width: 0.2, expected: 'setosa' },
  { id: 2, sepal_length: 4.9, sepal_width: 3.0, petal_length: 1.4, petal_width: 0.2, expected: 'setosa' },
  { id: 3, sepal_length: 4.7, sepal_width: 3.2, petal_length: 1.3, petal_width: 0.2, expected: 'setosa' },
  { id: 4, sepal_length: 6.0, sepal_width: 2.9, petal_length: 4.5, petal_width: 1.5, expected: 'versicolor' },
  { id: 5, sepal_length: 5.5, sepal_width: 2.4, petal_length: 3.8, petal_width: 1.1, expected: 'versicolor' },
  { id: 6, sepal_length: 6.3, sepal_width: 3.3, petal_length: 6.0, petal_width: 2.5, expected: 'virginica' },
  { id: 7, sepal_length: 6.5, sepal_width: 3.0, petal_length: 5.8, petal_width: 2.2, expected: 'virginica' },
];

export function batchRowToFeatures(row: BatchTestRow): number[] {
  return [row.sepal_length, row.sepal_width, row.petal_length, row.petal_width];
}

export function defaultIrisSample(): number[] {
  return batchRowToFeatures(IRIS_PUBLISHED_TEST_DATA[0]);
}

export function irisClassIndex(className: string): number {
  const index = IRIS_CLASSES.indexOf(className as IrisClass);
  return index === -1 ? 0 : index;
}
