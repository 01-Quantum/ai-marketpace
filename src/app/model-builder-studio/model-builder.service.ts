import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, map, Observable, shareReplay } from 'rxjs';
import {
  BranchOption,
  LeafNode,
  LibraryModel,
  ModelType,
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

@Injectable({ providedIn: 'root' })
export class ModelBuilderService {
  private readonly libraryModelsSubject = new BehaviorSubject<LibraryModel[]>(LIBRARY_MODELS);
  private readonly selectedModelIdSubject = new BehaviorSubject<string>('iris-dt');
  private readonly modelTypeSubject = new BehaviorSubject<ModelType>('tree');
  private readonly selectedNodeIdSubject = new BehaviorSubject<number>(3);
  private readonly nodesByModelSubject = new BehaviorSubject<Record<string, TreeNode[]>>({
    'iris-dt': structuredClone(IRIS_TREE_NODES),
    'risk-classifier': structuredClone(IRIS_TREE_NODES),
  });

  readonly libraryModels$ = this.libraryModelsSubject.asObservable();
  readonly selectedModelId$ = this.selectedModelIdSubject.asObservable();
  readonly modelType$ = this.modelTypeSubject.asObservable();
  readonly selectedNodeId$ = this.selectedNodeIdSubject.asObservable();

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
    this.modelTypeSubject.next(model.type);

    const nodes = this.nodesByModelSubject.value[modelId] ?? [];
    if (!nodes.some((node) => node.id === this.selectedNodeIdSubject.value)) {
      this.selectedNodeIdSubject.next(nodes[0]?.id ?? this.selectedNodeIdSubject.value);
    }
  }

  setModelType(type: ModelType): void {
    this.modelTypeSubject.next(type);
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
    if (nodes.length <= 1) return;

    this.updateNodes((current) => current.filter((node) => node.id !== nodeId));
    if (this.selectedNodeIdSubject.value === nodeId) {
      this.selectedNodeIdSubject.next(this.currentNodes()[0]?.id ?? nodeId);
    }
  }

  addNode(): void {
    const nodes = this.currentNodes();
    const nextId = Math.max(0, ...nodes.map((node) => node.id)) + 1;
    const newNode: LeafNode = {
      id: nextId,
      type: 'leaf',
      label: 'species = unknown',
      layout: { top: 420, left: 200, width: 220 },
    };

    this.updateNodes((current) => [...current, newNode]);
    this.selectedNodeIdSubject.next(nextId);
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
