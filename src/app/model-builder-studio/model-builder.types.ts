export type ModelType = 'tree' | 'logistic' | 'linear';

export interface LibraryModel {
  /** Local key used within the studio (matches Supabase row id as string for saved models). */
  id: string;
  /** Supabase row id — present only after the model has been saved to the DB. */
  remoteId?: number;
  name: string;
  version: string;
  updated: string;
  iconKind: 'tree' | 'scatter' | 'shield' | 'trending';
  type: ModelType;
  /** Whether the model matches the last saved Supabase state. */
  isSaved?: boolean;
  /** Whether the model is published to the enclave (from Supabase `published`). */
  published?: boolean;
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

