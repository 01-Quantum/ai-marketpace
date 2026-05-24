import { DecisionTreeModel, DecisionTreeNode } from './decision-tree-model.types';
import { formatThresholdDisplay } from './format-threshold';

const FEATURE_KEYS = ['sepal_length', 'sepal_width', 'petal_length', 'petal_width'];

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

function featureKey(model: DecisionTreeModel, index: number): string {
  return FEATURE_KEYS[index] ?? model.features[index] ?? `feature_${index}`;
}

export function predictDecisionTree(
  model: DecisionTreeModel,
  features: number[],
): InferenceResult {
  const path: DecisionPathStep[] = [];
  let nodeIndex = 1;
  let node: DecisionTreeNode = model.tree;

  while (node.type === 'split') {
    const value = features[node.feature_index] ?? 0;
    const threshold = node.threshold;
    const goesLeft = value <= threshold;
    const thresholdLabel = formatThresholdDisplay(threshold);

    path.push({
      nodeIndex: nodeIndex++,
      kind: 'split',
      rule: `${featureKey(model, node.feature_index)} <= ${thresholdLabel}`,
      comparison: `${formatThresholdDisplay(value)} ${goesLeft ? '<=' : '>'} ${thresholdLabel}`,
      branchLabel: goesLeft ? 'True' : 'False',
    });

    node = goesLeft ? node.left : node.right;
  }

  const className = model.classes[node.class_index] ?? 'unknown';
  path.push({
    nodeIndex: nodeIndex,
    kind: 'leaf',
    leafLabel: `species = ${className}`,
  });

  return { className, classIndex: node.class_index, path };
}
