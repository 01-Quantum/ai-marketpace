import {
  DecisionTreeModel,
  DecisionTreeNode,
} from './decision-tree-model.types';
import { IRIS_FEATURE_KEYS } from './iris-dataset';
import { FEATURE_OPTIONS, LeafNode, TreeNode } from './model-builder.types';

const FEATURE_BY_INDEX = IRIS_FEATURE_KEYS;

const NODE_WIDTH = 220;
const VERTICAL_GAP = 160;
const HORIZONTAL_GAP = 40;

function leafCount(node: DecisionTreeNode): number {
  if (node.type === 'leaf') return 1;
  return leafCount(node.left) + leafCount(node.right);
}

function featureKey(model: DecisionTreeModel, index: number): string {
  const mapped = FEATURE_BY_INDEX[index];
  if (mapped) return mapped;

  const label = model.features[index] ?? '';
  const normalized = label
    .replace(/\s*\([^)]*\)\s*/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase();

  return FEATURE_OPTIONS.includes(normalized as (typeof FEATURE_OPTIONS)[number])
    ? normalized
    : FEATURE_OPTIONS[0];
}

function walk(
  model: DecisionTreeModel,
  node: DecisionTreeNode,
  depth: number,
  leftBound: number,
  rightBound: number,
  nextId: { value: number },
  collected: TreeNode[],
): number {
  const id = nextId.value++;
  const centerX = (leftBound + rightBound) / 2;
  const top = 60 + depth * VERTICAL_GAP;
  const left = Math.max(0, centerX - NODE_WIDTH / 2);

  if (node.type === 'leaf') {
    collected.push({
      id,
      type: 'leaf',
      label: `species = ${model.classes[node.class_index] ?? 'unknown'}`,
      layout: { top, left, width: NODE_WIDTH },
    });
    return id;
  }

  const leftLeaves = leafCount(node.left);
  const rightLeaves = leafCount(node.right);
  const splitX = leftBound + ((rightBound - leftBound) * leftLeaves) / (leftLeaves + rightLeaves);

  const leftBranchId = walk(model, node.left, depth + 1, leftBound, splitX, nextId, collected);
  const rightBranchId = walk(model, node.right, depth + 1, splitX, rightBound, nextId, collected);

  collected.push({
    id,
    type: 'decision',
    feature: featureKey(model, node.feature_index),
    threshold: node.threshold,
    leftBranchId,
    rightBranchId,
    layout: { top, left, width: NODE_WIDTH },
  });

  return id;
}

export function convertDecisionTreeModelToNodes(model: DecisionTreeModel): TreeNode[] {
  const collected: TreeNode[] = [];
  const span = Math.max(leafCount(model.tree), 1) * (NODE_WIDTH + HORIZONTAL_GAP);
  walk(model, model.tree, 0, 0, span, { value: 1 }, collected);

  const childIds = new Set<number>();
  for (const node of collected) {
    if (node.type === 'decision') {
      childIds.add(node.leftBranchId);
      childIds.add(node.rightBranchId);
    }
  }

  const root = collected.find((node) => !childIds.has(node.id));
  if (!root) return collected;

  return [root, ...collected.filter((node) => node.id !== root.id)];
}

export function cloneTreeNodes(nodes: TreeNode[]): TreeNode[] {
  return structuredClone(nodes);
}
