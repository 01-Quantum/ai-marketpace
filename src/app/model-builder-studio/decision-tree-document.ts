import { TreeNode } from './model-builder.types';

export interface DecisionTreeDocument {
  nodes: TreeNode[];
}

/** Default Iris decision tree in the canonical `{ nodes: [...] }` format. */
export const DEFAULT_DECISION_TREE_NODES: TreeNode[] = [
  {
    id: 1,
    type: 'decision',
    feature: 'petal_length',
    threshold: 2.45,
    leftBranchId: 2,
    rightBranchId: 3,
    layout: { top: 60, left: 540, width: 220 },
  },
  {
    id: 2,
    type: 'leaf',
    label: 'species = setosa',
    layout: { top: 220, left: 20, width: 220 },
  },
  {
    id: 5,
    type: 'leaf',
    label: 'species = versicolor',
    layout: { top: 540, left: 280, width: 220 },
  },
  {
    id: 6,
    type: 'leaf',
    label: 'species = virginica',
    layout: { top: 540, left: 540, width: 220 },
  },
  {
    id: 4,
    type: 'decision',
    feature: 'petal_length',
    threshold: 4.950000047683716,
    leftBranchId: 5,
    rightBranchId: 6,
    layout: { top: 380, left: 410, width: 220 },
  },
  {
    id: 8,
    type: 'leaf',
    label: 'species = virginica',
    layout: { top: 540, left: 800, width: 220 },
  },
  {
    id: 9,
    type: 'leaf',
    label: 'species = virginica',
    layout: { top: 540, left: 1060, width: 220 },
  },
  {
    id: 7,
    type: 'decision',
    feature: 'petal_length',
    threshold: 4.8500001430511475,
    leftBranchId: 8,
    rightBranchId: 9,
    layout: { top: 380, left: 930, width: 220 },
  },
  {
    id: 3,
    type: 'decision',
    feature: 'petal_width',
    threshold: 1.6500000357627869,
    leftBranchId: 4,
    rightBranchId: 7,
    layout: { top: 220, left: 670, width: 220 },
  },
];

export function cloneTreeNodes(nodes: TreeNode[]): TreeNode[] {
  return structuredClone(nodes);
}

export function toDecisionTreeDocument(nodes: TreeNode[]): DecisionTreeDocument {
  return { nodes: cloneTreeNodes(nodes) };
}

export function parseDecisionTreeDocument(json: unknown): TreeNode[] | null {
  if (!json || typeof json !== 'object') return null;
  const nodes = (json as DecisionTreeDocument).nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) return null;
  return cloneTreeNodes(nodes);
}

export function findRootNode(nodes: TreeNode[]): TreeNode | null {
  const childIds = new Set<number>();
  for (const node of nodes) {
    if (node.type === 'decision') {
      childIds.add(node.leftBranchId);
      childIds.add(node.rightBranchId);
    }
  }
  return nodes.find((node) => !childIds.has(node.id)) ?? null;
}
