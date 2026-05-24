import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, map, Observable, shareReplay } from 'rxjs';
import {
  BranchOption,
  DecisionNode,
  FEATURE_OPTIONS,
  LeafNode,
  LibraryModel,
  TreeEdge,
  TreeNode,
  TreeNodeView,
} from './model-builder.types';

const IRIS_TREE_NODES: TreeNode[] = [
  {
    id: 1,
    type: 'decision',
    feature: 'petal_length',
    threshold: 2.4,
    leftBranchId: 2,
    rightBranchId: 3,
    layout: { top: 60, left: 340, width: 220 },
  },
  {
    id: 2,
    type: 'leaf',
    label: 'species = setosa',
    layout: { top: 220, left: 60, width: 220 },
  },
  {
    id: 3,
    type: 'decision',
    feature: 'petal_width',
    threshold: 1.8,
    leftBranchId: 4,
    rightBranchId: 5,
    layout: { top: 220, left: 460, width: 220 },
  },
  {
    id: 4,
    type: 'leaf',
    label: 'species = versicolor',
    layout: { top: 380, left: 320, width: 220 },
  },
  {
    id: 5,
    type: 'leaf',
    label: 'species = virginica',
    layout: { top: 380, left: 600, width: 220 },
  },
];

const LIBRARY_MODELS: LibraryModel[] = [
  {
    id: 'iris-dt',
    name: 'Iris Decision Tree',
    version: 'v1.2.0',
    updated: 'Updated 2d ago',
    iconKind: 'tree',
    type: 'tree',
  },
  {
    id: 'logreg-classifier',
    name: 'Logistic Regression',
    version: 'v1.0.0',
    updated: 'Updated 5d ago',
    iconKind: 'scatter',
    type: 'logistic',
  },
  {
    id: 'risk-classifier',
    name: 'Risk Classifier',
    version: 'v0.9.1',
    updated: 'Updated 1w ago',
    iconKind: 'shield',
    type: 'tree',
  },
];

function nodeTitle(node: TreeNode): string {
  return node.type === 'leaf' ? node.label : `${node.feature} < ${node.threshold}`;
}

function toNodeView(node: TreeNode): TreeNodeView {
  return {
    id: node.id,
    title: nodeTitle(node),
    type: node.type,
    ...node.layout,
  };
}

function buildEdges(nodes: TreeNode[]): TreeEdge[] {
  return nodes.flatMap((node) =>
    node.type !== 'decision'
      ? []
      : [
          {
            fromId: node.id,
            toId: node.leftBranchId,
            branch: 'true' as const,
            label: `True (\u2264 ${node.threshold})`,
          },
          {
            fromId: node.id,
            toId: node.rightBranchId,
            branch: 'false' as const,
            label: `False (> ${node.threshold})`,
          },
        ],
  );
}

function collectSubtreeIds(nodes: TreeNode[], rootId: number): Set<number> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const ids = new Set<number>();
  const stack = [rootId];

  while (stack.length) {
    const id = stack.pop()!;
    if (ids.has(id)) continue;
    ids.add(id);
    const node = byId.get(id);
    if (node?.type === 'decision') {
      stack.push(node.leftBranchId, node.rightBranchId);
    }
  }

  return ids;
}

function placeholderLeaf(
  id: number,
  parent: DecisionNode,
  side: 'left' | 'right',
): LeafNode {
  const { top, left, width } = parent.layout;
  return {
    id,
    type: 'leaf',
    label: 'species = unknown',
    layout: {
      top: top + 160,
      left: side === 'left' ? Math.max(0, left - 140) : left + 140,
      width,
    },
  };
}

@Injectable({ providedIn: 'root' })
export class ModelBuilderService {
  private readonly libraryModelsSubject = new BehaviorSubject<LibraryModel[]>(LIBRARY_MODELS);
  private readonly selectedModelIdSubject = new BehaviorSubject<string>('iris-dt');
  private readonly selectedNodeIdSubject = new BehaviorSubject<number>(3);
  private readonly nodesByModelSubject = new BehaviorSubject<Record<string, TreeNode[]>>({
    'iris-dt': structuredClone(IRIS_TREE_NODES),
    'risk-classifier': structuredClone(IRIS_TREE_NODES),
  });

  readonly libraryModels$ = this.libraryModelsSubject.asObservable();
  readonly selectedModelId$ = this.selectedModelIdSubject.asObservable();
  readonly selectedNodeId$ = this.selectedNodeIdSubject.asObservable();

  readonly selectedModel$ = combineLatest([
    this.libraryModelsSubject,
    this.selectedModelIdSubject,
  ]).pipe(
    map(([models, id]) => models.find((model) => model.id === id) ?? null),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly nodes$ = combineLatest([this.selectedModelIdSubject, this.nodesByModelSubject]).pipe(
    map(([modelId, nodesByModel]) => nodesByModel[modelId] ?? []),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly nodeViews$ = this.nodes$.pipe(map((nodes) => nodes.map(toNodeView)));

  readonly edges$ = this.nodes$.pipe(map(buildEdges));

  readonly selectedNode$ = combineLatest([this.nodes$, this.selectedNodeIdSubject]).pipe(
    map(([nodes, nodeId]) => nodes.find((node) => node.id === nodeId) ?? null),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly branchOptions$: Observable<BranchOption[]> = this.nodes$.pipe(
    map((nodes) =>
      nodes.map((node) => ({ id: node.id, label: `Node ${node.id} (${nodeTitle(node)})` })),
    ),
  );

  selectModel(modelId: string): void {
    const model = this.libraryModelsSubject.value.find((entry) => entry.id === modelId);
    if (!model) return;

    this.selectedModelIdSubject.next(modelId);

    const nodes = this.nodesByModelSubject.value[modelId] ?? [];
    if (!nodes.some((node) => node.id === this.selectedNodeIdSubject.value)) {
      this.selectedNodeIdSubject.next(nodes[0]?.id ?? this.selectedNodeIdSubject.value);
    }
  }

  renameModel(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;

    const modelId = this.selectedModelIdSubject.value;
    this.libraryModelsSubject.next(
      this.libraryModelsSubject.value.map((model) =>
        model.id === modelId ? { ...model, name: trimmed } : model,
      ),
    );
  }

  selectNode(nodeId: number): void {
    this.selectedNodeIdSubject.next(nodeId);
  }

  patchNode(nodeId: number, patch: Partial<TreeNode>): void {
    this.updateNodes((nodes) =>
      nodes.map((node) => (node.id === nodeId ? ({ ...node, ...patch } as TreeNode) : node)),
    );
  }

  moveNode(nodeId: number, top: number, left: number): void {
    this.updateNodes((nodes) =>
      nodes.map((node) =>
        node.id === nodeId ? { ...node, layout: { ...node.layout, top, left } } : node,
      ),
    );
  }

  deleteNode(nodeId: number): void {
    const nodes = this.currentNodes();
    const toDelete = collectSubtreeIds(nodes, nodeId);
    if (toDelete.size >= nodes.length) return;

    let nextId = Math.max(0, ...nodes.map((node) => node.id));
    const replacementLeaves: LeafNode[] = [];

    const surviving = nodes
      .filter((node) => !toDelete.has(node.id))
      .map((node) => {
        if (node.type !== 'decision') return node;

        let leftBranchId = node.leftBranchId;
        let rightBranchId = node.rightBranchId;

        if (toDelete.has(leftBranchId)) {
          nextId += 1;
          leftBranchId = nextId;
          replacementLeaves.push(placeholderLeaf(nextId, node, 'left'));
        }
        if (toDelete.has(rightBranchId)) {
          nextId += 1;
          rightBranchId = nextId;
          replacementLeaves.push(placeholderLeaf(nextId, node, 'right'));
        }

        if (leftBranchId === node.leftBranchId && rightBranchId === node.rightBranchId) {
          return node;
        }

        return { ...node, leftBranchId, rightBranchId };
      });

    this.updateNodes(() => [...surviving, ...replacementLeaves]);

    if (toDelete.has(this.selectedNodeIdSubject.value)) {
      this.selectedNodeIdSubject.next(surviving[0]?.id ?? this.selectedNodeIdSubject.value);
    }
  }

  addNode(): void {
    const nodeId = this.selectedNodeIdSubject.value;
    const nodes = this.currentNodes();
    const leaf = nodes.find((node) => node.id === nodeId && node.type === 'leaf');
    if (!leaf) return;

    const maxId = Math.max(0, ...nodes.map((node) => node.id));
    const leftId = maxId + 1;
    const rightId = maxId + 2;
    const { top, left, width } = leaf.layout;

    const decision: DecisionNode = {
      id: leaf.id,
      type: 'decision',
      feature: FEATURE_OPTIONS[0],
      threshold: 1,
      leftBranchId: leftId,
      rightBranchId: rightId,
      layout: { top, left, width },
    };

    const leftLeaf: LeafNode = {
      id: leftId,
      type: 'leaf',
      label: 'species = unknown',
      layout: { top: top + 160, left: Math.max(0, left - 140), width },
    };

    const rightLeaf: LeafNode = {
      id: rightId,
      type: 'leaf',
      label: 'species = unknown',
      layout: { top: top + 160, left: left + 140, width },
    };

    this.updateNodes((current) =>
      current.flatMap((node) =>
        node.id === leaf.id ? [decision, leftLeaf, rightLeaf] : [node],
      ),
    );
  }

  private currentNodes(): TreeNode[] {
    return this.nodesByModelSubject.value[this.selectedModelIdSubject.value] ?? [];
  }

  private updateNodes(updater: (nodes: TreeNode[]) => TreeNode[]): void {
    const modelId = this.selectedModelIdSubject.value;
    const current = this.nodesByModelSubject.value;
    this.nodesByModelSubject.next({
      ...current,
      [modelId]: updater(current[modelId] ?? []),
    });
  }
}
