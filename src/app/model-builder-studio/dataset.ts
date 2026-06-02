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

export function batchRowToFeatureVector(
  row: Record<string, number | string>,
  keys: readonly string[],
): number[] {
  return keys.map((key) => {
    const value = row[key];
    if (typeof value === 'number') return value;
    const parsed = Number.parseFloat(String(value ?? 0));
    return Number.isNaN(parsed) ? 0 : parsed;
  });
}

export function defaultFeatureVector(length = 0): number[] {
  return Array.from({ length }, () => 0);
}

export function parseExpectedValue(expected: string): number {
  const parsed = Number.parseFloat(expected);
  return Number.isNaN(parsed) ? 0 : parsed;
}
