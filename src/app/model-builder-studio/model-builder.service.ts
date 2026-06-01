import { Injectable, inject, signal } from '@angular/core';
import { BehaviorSubject, combineLatest, filter, map, shareReplay, take } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { AuthService } from '../shared/auth.service';
import { ModelSupabaseService } from './model-supabase.service';
import { DecisionTreeModelService } from './decision-tree-model.service';
import { convertDecisionTreeModelToNodes, cloneTreeNodes } from './decision-tree-model.mapper';
import { formatThresholdDisplay } from './format-threshold';
import {
  DecisionNode,
  FEATURE_OPTIONS,
  LeafNode,
  LibraryModel,
  TreeEdge,
  TreeNode,
  TreeNodeView,
} from './model-builder.types';

function iconKindForType(type: import('./model-builder.types').ModelType): LibraryModel['iconKind'] {
  if (type === 'logistic') return 'scatter';
  if (type === 'linear') return 'trending';
  return 'tree';
}

function toNodeView(node: TreeNode): TreeNodeView {
  const title =
    node.type === 'leaf'
      ? node.label
      : `${node.feature} < ${formatThresholdDisplay(node.threshold)}`;

  return {
    id: node.id,
    title,
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
            label: `True (\u2264 ${formatThresholdDisplay(node.threshold)})`,
          },
          {
            fromId: node.id,
            toId: node.rightBranchId,
            branch: 'false' as const,
            label: `False (> ${formatThresholdDisplay(node.threshold)})`,
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
  private readonly auth = inject(AuthService);
  private readonly modelSupabase = inject(ModelSupabaseService);
  private readonly decisionTreeModel = inject(DecisionTreeModelService);
  private readonly defaultTreeNodes = convertDecisionTreeModelToNodes(
    this.decisionTreeModel.getModel(),
  );

  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly loading = signal(true);

  private readonly libraryModelsSubject = new BehaviorSubject<LibraryModel[]>([]);
  private readonly selectedModelIdSubject = new BehaviorSubject<string>('');
  private readonly selectedNodeIdSubject = new BehaviorSubject<number>(1);
  private readonly nodesByModelSubject = new BehaviorSubject<Record<string, TreeNode[]>>({});

  constructor() {
    // Wait until AuthService has restored the session before fetching models.
    // This avoids a race where initLibrary() runs before getSession() resolves.
    toObservable(this.auth.initialized)
      .pipe(filter(Boolean), take(1))
      .subscribe(() => void this.initLibrary());
  }

  private async initLibrary(): Promise<void> {
    this.loading.set(true);
    try {
      await this.loadRemoteModels();
      const first = this.libraryModelsSubject.value[0];
      if (first) this.selectedModelIdSubject.next(first.id);
    } finally {
      this.loading.set(false);
    }
  }

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

  /** Save the currently selected model to Supabase. */
  async saveCurrentModel(modelJson: unknown): Promise<void> {
    const model = this.libraryModelsSubject.value.find(
      (m) => m.id === this.selectedModelIdSubject.value,
    );
    if (!model) return;

    this.saving.set(true);
    try {
      const saved = await this.modelSupabase.saveModel(model.remoteId?.toString() ?? model.id, {
        model_type: model.type,
        model_name: model.name,
        model_json: modelJson,
      });
      if (saved) {
        this.libraryModelsSubject.next(
          this.libraryModelsSubject.value.map((m) =>
            m.id === model.id
              ? { ...m, remoteId: saved.id, isSaved: true, updated: 'Just saved' }
              : m,
          ),
        );
      }
    } finally {
      this.saving.set(false);
    }
  }

  /** Delete the currently selected model from Supabase and remove from library. */
  async deleteCurrentModel(): Promise<void> {
    const model = this.libraryModelsSubject.value.find(
      (m) => m.id === this.selectedModelIdSubject.value,
    );
    if (!model) return;

    this.deleting.set(true);
    try {
      if (model.remoteId) {
        await this.modelSupabase.deleteModel(model.remoteId);
      }
      const remaining = this.libraryModelsSubject.value.filter((m) => m.id !== model.id);
      this.libraryModelsSubject.next(remaining);
      const next = remaining[0];
      if (next) this.selectModel(next.id);
    } finally {
      this.deleting.set(false);
    }
  }

  /** Load all models from Supabase and replace the library. */
  async loadRemoteModels(): Promise<void> {
    const remoteModels = await this.modelSupabase.loadModels();

    const nodeMap: Record<string, TreeNode[]> = {};

    const entries: LibraryModel[] = remoteModels.map((rm) => {
      const localId = `remote-${rm.id}`;
      if (rm.model_type === 'tree') {
        const json = rm.model_json as { nodes?: TreeNode[] } | null;
        const nodes = Array.isArray(json?.['nodes']) && (json!['nodes'] as TreeNode[]).length > 0
          ? (json!['nodes'] as TreeNode[])
          : cloneTreeNodes(this.defaultTreeNodes);
        nodeMap[localId] = nodes;
      }
      return {
        id: localId,
        remoteId: rm.id,
        name: rm.model_name,
        version: 'v1.0.0',
        updated: new Date(rm.updated_at).toLocaleDateString(),
        iconKind: iconKindForType(rm.model_type),
        type: rm.model_type,
        isSaved: true,
      };
    });

    if (Object.keys(nodeMap).length > 0) {
      this.nodesByModelSubject.next({ ...this.nodesByModelSubject.value, ...nodeMap });
    }
    this.libraryModelsSubject.next(entries);
  }

  /** Returns the tree nodes for the currently selected model (for serialisation). */
  getCurrentNodes(): TreeNode[] {
    return this.currentNodes();
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
