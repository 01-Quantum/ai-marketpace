import { findRootNode } from './decision-tree-document';
import { formatThresholdDisplay } from './format-threshold';
import {
  BatchTestResult,
  BatchTestRow,
  IRIS_FEATURE_KEYS,
  IrisFeatureKey,
  batchRowToFeatures,
  irisClassIndex,
} from './iris-dataset';
import { DecisionNode, TreeNode } from './model-builder.types';

export interface DecisionPathStep {
  nodeIndex: number;
  kind: 'split' | 'leaf';
  rule?: string;
  comparison?: string;
  branchLabel?: string;
  leafLabel?: string;
}

export interface InferenceResult {
  className: string;
  classIndex: number;
  path: DecisionPathStep[];
}

function featureValue(features: number[], feature: string): number {
  const index = IRIS_FEATURE_KEYS.indexOf(feature as IrisFeatureKey);
  return index >= 0 ? (features[index] ?? 0) : 0;
}

function leafClassName(label: string): string {
  return label.replace(/^species\s*=\s*/i, '').trim() || 'unknown';
}

export function predictDecisionTree(nodes: TreeNode[], features: number[]): InferenceResult {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const root = findRootNode(nodes);
  if (!root) {
    return { className: 'unknown', classIndex: 0, path: [] };
  }

  const path: DecisionPathStep[] = [];
  let current: TreeNode = root;
  let stepIndex = 1;

  while (current.type === 'decision') {
    const decision = current as DecisionNode;
    const value = featureValue(features, decision.feature);
    const goesLeft = value <= decision.threshold;
    const thresholdLabel = formatThresholdDisplay(decision.threshold);

    path.push({
      nodeIndex: stepIndex++,
      kind: 'split',
      rule: `${decision.feature} <= ${thresholdLabel}`,
      comparison: `${formatThresholdDisplay(value)} ${goesLeft ? '<=' : '>'} ${thresholdLabel}`,
      branchLabel: goesLeft ? 'True' : 'False',
    });

    const nextId = goesLeft ? decision.leftBranchId : decision.rightBranchId;
    const next = byId.get(nextId);
    if (!next) break;
    current = next;
  }

  if (current.type === 'leaf') {
    const className = leafClassName(current.label);
    path.push({
      nodeIndex: stepIndex,
      kind: 'leaf',
      leafLabel: current.label,
    });
    return { className, classIndex: irisClassIndex(className), path };
  }

  return { className: 'unknown', classIndex: 0, path };
}

export function runBatchTest(nodes: TreeNode[], rows: BatchTestRow[]): BatchTestResult {
  const resultRows = rows.map((row) => {
    const prediction = predictDecisionTree(nodes, batchRowToFeatures(row));
    return {
      id: row.id,
      prediction: prediction.className,
      expected: row.expected,
      passed: prediction.className === row.expected,
    };
  });

  const passed = resultRows.filter((row) => row.passed).length;
  return { rows: resultRows, passed, total: resultRows.length };
}
