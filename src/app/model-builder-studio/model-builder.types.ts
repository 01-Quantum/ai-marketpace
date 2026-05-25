export type ModelType = 'tree' | 'logistic' | 'linear';

export interface LibraryModel {
  id: string;
  name: string;
  version: string;
  updated: string;
  iconKind: 'tree' | 'scatter' | 'shield' | 'trending';
  type: ModelType;
}

export interface NodeLayout {
  top: number;
  left: number;
  width: number;
}

export interface DecisionNode {
  id: number;
  type: 'decision';
  feature: string;
  threshold: number;
  leftBranchId: number;
  rightBranchId: number;
  layout: NodeLayout;
}

export interface LeafNode {
  id: number;
  type: 'leaf';
  label: string;
  layout: NodeLayout;
}

export type TreeNode = DecisionNode | LeafNode;

export interface TreeEdge {
  fromId: number;
  toId: number;
  label: string;
  branch: 'true' | 'false';
}

export interface TreeNodeView {
  id: number;
  title: string;
  type: 'decision' | 'leaf';
  top: number;
  left: number;
  width: number;
}

export const FEATURE_OPTIONS = [
  'petal_length',
  'petal_width',
  'sepal_length',
  'sepal_width',
] as const;
