import { findRootNode } from './decision-tree-document';
import { sampleRowToFeatureInputs } from './decision-tree-features';
import { formatThresholdDisplay } from './format-threshold';
import { BatchTestResult } from './dataset';
import { DecisionNode, TreeNode } from './model-builder.types';
import { SampleDataRow } from './sample-data.types';

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

type FeatureInputs = Record<string, number | string>;

function featureValue(inputs: FeatureInputs, feature: string): number {
  const value = inputs[feature];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function leafClassName(label: string): string {
  const match = label.match(/^[^=]+=\s*(.+)$/);
  return match ? match[1].trim() : label.trim() || 'unknown';
}

export function predictDecisionTree(
  nodes: TreeNode[],
  inputs: FeatureInputs,
): InferenceResult {
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
    const value = featureValue(inputs, decision.feature);
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
    return { className, classIndex: 0, path };
  }

  return { className: 'unknown', classIndex: 0, path };
}

export function runBatchTest(nodes: TreeNode[], rows: SampleDataRow[]): BatchTestResult {
  const resultRows = rows.map((row) => {
    const prediction = predictDecisionTree(nodes, sampleRowToFeatureInputs(row));
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
