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

