export interface DecisionTreeLeaf {
  type: 'leaf';
  class_index: number;
}

export interface DecisionTreeSplit {
  type: 'split';
  feature_index: number;
  threshold: number;
  left: DecisionTreeNode;
  right: DecisionTreeNode;
}

export type DecisionTreeNode = DecisionTreeLeaf | DecisionTreeSplit;

export interface DecisionTreeModel {
  features: string[];
  classes: string[];
  tree: DecisionTreeNode;
}

export interface BatchTestRow {
  id: number;
  sepal_length: number;
  sepal_width: number;
  petal_length: number;
  petal_width: number;
  expected: string;
}

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

export function batchRowToFeatures(row: BatchTestRow): number[] {
  return [row.sepal_length, row.sepal_width, row.petal_length, row.petal_width];
}
