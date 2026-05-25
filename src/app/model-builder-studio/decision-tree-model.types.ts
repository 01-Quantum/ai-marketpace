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
