import { Injectable, inject, signal } from '@angular/core';
import { BehaviorSubject, combineLatest, filter, map, shareReplay, take } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { AuthService } from '../shared/auth.service';
import { FheTreePublishService } from './fhe-tree-publish.service';
import { ModelSupabaseService, SupabaseModel } from './model-supabase.service';
import {
  DEFAULT_DECISION_TREE_NODES,
  cloneTreeNodes,
  parseDecisionTreeDocument,
  toDecisionTreeDocument,
} from './decision-tree-document';
import {
  DEFAULT_LOGISTIC_REGRESSION_MODEL,
  cloneLogisticRegressionModel,
  parseLogisticRegressionDocument,
} from './logistic-regression-document';
import { ModelExportDocument, parseModelExportDocument } from './model-export';
import { LogisticRegressionModel } from './logistic-regression-model.types';
import { collectTreeFeatures, createRandomSampleRow, defaultTreeFeature } from './decision-tree-features';
import { formatThresholdDisplay } from './format-threshold';
import {
  SampleDataRow,
  parseSampleDataDocument,
  toSampleDataDocument,
} from './sample-data.types';
import {
  DecisionNode,
  LeafNode,
  LibraryModel,
  TreeEdge,
  TreeNode,
  TreeNodeView,
} from './model-builder.types';

function iconKindForType(type: import('./model-builder.types').ModelType): LibraryModel['iconKind'] {
  if (type === 'logistic') return 'scatter';
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

function uniqueCloneName(base: string, models: LibraryModel[]): string {
  const taken = new Set(models.map((model) => model.name));
  if (!taken.has(base)) return base;
  let index = 2;
  while (taken.has(`${base} (${index})`)) index += 1;
  return `${base} (${index})`;
}

function newLocalModelId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
  private readonly fheTreePublish = inject(FheTreePublishService);

  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly publishing = signal(false);
  readonly loading = signal(true);

  private readonly libraryModelsSubject = new BehaviorSubject<LibraryModel[]>([]);
  private readonly selectedModelIdSubject = new BehaviorSubject<string>('');
  private readonly selectedNodeIdSubject = new BehaviorSubject<number>(1);
  private readonly nodesByModelSubject = new BehaviorSubject<Record<string, TreeNode[]>>({});
  private readonly logisticModelsByModelSubject = new BehaviorSubject<
    Record<string, LogisticRegressionModel>
  >({});
  private readonly sampleDataByModelSubject = new BehaviorSubject<Record<string, SampleDataRow[]>>({});
  private readonly originalSampleDataByModel: Record<string, SampleDataRow[]> = {};

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

  readonly sampleData$ = combineLatest([
    this.selectedModelIdSubject,
    this.sampleDataByModelSubject,
  ]).pipe(
    map(([modelId, sampleByModel]) => sampleByModel[modelId] ?? []),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly logisticModel$ = combineLatest([
    this.selectedModelIdSubject,
    this.logisticModelsByModelSubject,
  ]).pipe(
    map(([modelId, modelsById]) => modelsById[modelId] ?? DEFAULT_LOGISTIC_REGRESSION_MODEL),
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

  getCurrentLogisticModel(): LogisticRegressionModel {
    const modelId = this.selectedModelIdSubject.value;
    return cloneLogisticRegressionModel(
      this.logisticModelsByModelSubject.value[modelId] ?? DEFAULT_LOGISTIC_REGRESSION_MODEL,
    );
  }

  updateCurrentLogisticModel(
    updater: (model: LogisticRegressionModel) => LogisticRegressionModel,
  ): void {
    const modelId = this.selectedModelIdSubject.value;
    const current = this.getCurrentLogisticModel();
    this.logisticModelsByModelSubject.next({
      ...this.logisticModelsByModelSubject.value,
      [modelId]: updater(current),
    });
    this.markModelDirty(modelId);
  }

  cloneModel(modelId: string): string | null {
    const source = this.libraryModelsSubject.value.find((entry) => entry.id === modelId);
    if (!source) return null;

    const newId = newLocalModelId();
    const name = uniqueCloneName(`${source.name} (copy)`, this.libraryModelsSubject.value);
    const cloned: LibraryModel = {
      id: newId,
      name,
      version: source.version,
      updated: 'Not saved',
      iconKind: source.iconKind,
      type: source.type,
      isSaved: false,
    };

    const nodesByModel = this.nodesByModelSubject.value;
    const logisticByModel = this.logisticModelsByModelSubject.value;
    const sampleByModel = this.sampleDataByModelSubject.value;

    if (source.type === 'tree') {
      const nodes = nodesByModel[modelId] ?? cloneTreeNodes(DEFAULT_DECISION_TREE_NODES);
      this.nodesByModelSubject.next({
        ...nodesByModel,
        [newId]: cloneTreeNodes(nodes),
      });
    } else if (source.type === 'logistic') {
      const logistic =
        logisticByModel[modelId] ?? cloneLogisticRegressionModel(DEFAULT_LOGISTIC_REGRESSION_MODEL);
      this.logisticModelsByModelSubject.next({
        ...logisticByModel,
        [newId]: cloneLogisticRegressionModel(logistic),
      });
    }

    const sampleRows = sampleByModel[modelId];
    if (sampleRows) {
      const copied = structuredClone(sampleRows);
      this.sampleDataByModelSubject.next({ ...sampleByModel, [newId]: copied });
      this.originalSampleDataByModel[newId] = structuredClone(copied);
    }

    this.libraryModelsSubject.next([cloned, ...this.libraryModelsSubject.value]);
    this.selectModel(newId);
    return newId;
  }

  buildExportDocument(modelId: string): ModelExportDocument | null {
    const model = this.libraryModelsSubject.value.find((entry) => entry.id === modelId);
    if (!model) return null;

    return {
      name: model.name,
      type: model.type,
      version: model.version,
      model_json: this.getModelJsonForId(modelId, model.type),
      sample_data: toSampleDataDocument(this.getSampleDataForModel(modelId)),
      exported_at: new Date().toISOString(),
    };
  }

  /** Import a model from a parsed export document into the local library. */
  importModelFromExport(doc: ModelExportDocument): string | null {
    const newId = newLocalModelId();
    const name = uniqueCloneName(doc.name.trim(), this.libraryModelsSubject.value);
    const entry: LibraryModel = {
      id: newId,
      name,
      version: doc.version || 'v1.0.0',
      updated: 'Imported',
      iconKind: iconKindForType(doc.type),
      type: doc.type,
      isSaved: false,
    };

    if (doc.type === 'tree') {
      const parsed = parseDecisionTreeDocument(doc.model_json);
      this.nodesByModelSubject.next({
        ...this.nodesByModelSubject.value,
        [newId]: parsed ?? cloneTreeNodes(DEFAULT_DECISION_TREE_NODES),
      });
    } else if (doc.type === 'logistic') {
      const parsed = parseLogisticRegressionDocument(doc.model_json);
      this.logisticModelsByModelSubject.next({
        ...this.logisticModelsByModelSubject.value,
        [newId]: parsed ?? cloneLogisticRegressionModel(DEFAULT_LOGISTIC_REGRESSION_MODEL),
      });
    }

    this.sampleDataByModelSubject.next({
      ...this.sampleDataByModelSubject.value,
      [newId]: parseSampleDataDocument(doc.sample_data),
    });
    this.originalSampleDataByModel[newId] = structuredClone(
      parseSampleDataDocument(doc.sample_data),
    );

    this.libraryModelsSubject.next([entry, ...this.libraryModelsSubject.value]);
    this.selectModel(newId);
    return newId;
  }

  /** Parse JSON text and import into the library. */
  importModelFromJsonText(text: string): string | null {
    try {
      const json = JSON.parse(text) as unknown;
      const doc = parseModelExportDocument(json);
      if (!doc) return null;
      return this.importModelFromExport(doc);
    } catch {
      return null;
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
    this.markModelDirty(modelId);
  }

  markCurrentModelDirty(): void {
    this.markModelDirty(this.selectedModelIdSubject.value);
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
      feature: defaultTreeFeature(nodes, this.getSampleData()),
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
        sample_data: toSampleDataDocument(this.getSampleData()),
      });
      if (saved) {
        const modelId = model.id;
        this.originalSampleDataByModel[modelId] = structuredClone(this.getSampleData());
        this.applyRemoteModelToLibrary(modelId, saved, 'Just saved');
      }
    } finally {
      this.saving.set(false);
    }
  }

  /** Publish the current model to the enclave (persists latest definition + sample data). */
  async publishCurrentModel(modelJson: unknown): Promise<boolean> {
    const model = this.libraryModelsSubject.value.find(
      (m) => m.id === this.selectedModelIdSubject.value,
    );
    if (!model?.remoteId) return false;

    this.publishing.set(true);
    try {
      const payload = {
        model_type: model.type,
        model_name: model.name,
        model_json: modelJson,
        sample_data: toSampleDataDocument(this.getSampleData()),
      };

      if (model.type === 'tree') {
        const saved = await this.modelSupabase.saveModel(String(model.remoteId), payload);
        if (!saved) return false;

        const published = await this.fheTreePublish.publishTree(model.remoteId);
        if (!published.ok) {
          console.error('fhe-tree-publish error', published.error);
          return false;
        }

        const refreshed = await this.modelSupabase.loadModelById(model.remoteId);
        if (refreshed) {
          this.originalSampleDataByModel[model.id] = structuredClone(this.getSampleData());
          this.applyRemoteModelToLibrary(model.id, refreshed, 'Published');
          return true;
        }
        return false;
      }

      const saved = await this.modelSupabase.setPublished(model.remoteId, true, payload);
      if (saved) {
        this.originalSampleDataByModel[model.id] = structuredClone(this.getSampleData());
        this.applyRemoteModelToLibrary(model.id, saved, 'Published');
        return true;
      }
      return false;
    } finally {
      this.publishing.set(false);
    }
  }

  /** Unpublish the current model from the enclave. */
  async unpublishCurrentModel(): Promise<boolean> {
    const model = this.libraryModelsSubject.value.find(
      (m) => m.id === this.selectedModelIdSubject.value,
    );
    if (!model?.remoteId) return false;

    this.publishing.set(true);
    try {
      const saved = await this.modelSupabase.setPublished(model.remoteId, false);
      if (saved) {
        this.applyRemoteModelToLibrary(model.id, saved, 'Unpublished');
        return true;
      }
      return false;
    } finally {
      this.publishing.set(false);
    }
  }

  /** Delete the currently selected model from Supabase and remove from library. */
  async deleteCurrentModel(): Promise<void> {
    await this.deleteModelById(this.selectedModelIdSubject.value);
  }

  /** Delete a model from Supabase (if saved) and remove it from the library. */
  async deleteModelById(modelId: string): Promise<void> {
    const model = this.libraryModelsSubject.value.find((entry) => entry.id === modelId);
    if (!model) return;

    this.deleting.set(true);
    try {
      if (model.remoteId) {
        await this.modelSupabase.deleteModel(model.remoteId);
      }
      this.removeModelFromState(model.id);
      const remaining = this.libraryModelsSubject.value;
      if (remaining.length === 0) {
        this.selectedModelIdSubject.next('');
        return;
      }
      if (this.selectedModelIdSubject.value === model.id) {
        this.selectModel(remaining[0].id);
      }
    } finally {
      this.deleting.set(false);
    }
  }

  /** Load all models from Supabase and replace the library. */
  async loadRemoteModels(): Promise<void> {
    const remoteModels = await this.modelSupabase.loadModels();

    const nodeMap: Record<string, TreeNode[]> = {};
    const logisticMap: Record<string, LogisticRegressionModel> = {};
    const sampleMap: Record<string, SampleDataRow[]> = {};

    const entries: LibraryModel[] = remoteModels
      .filter((rm) => rm.model_type === 'tree' || rm.model_type === 'logistic')
      .map((rm) => {
        const localId = `remote-${rm.id}`;
        if (rm.model_type === 'tree') {
          const parsed = parseDecisionTreeDocument(rm.model_json);
          nodeMap[localId] = parsed ?? cloneTreeNodes(DEFAULT_DECISION_TREE_NODES);
        } else if (rm.model_type === 'logistic') {
          const parsed = parseLogisticRegressionDocument(rm.model_json);
          logisticMap[localId] =
            parsed ?? cloneLogisticRegressionModel(DEFAULT_LOGISTIC_REGRESSION_MODEL);
        }
        const rows = parseSampleDataDocument(rm.sample_data);
        sampleMap[localId] = rows;
        this.originalSampleDataByModel[localId] = structuredClone(rows);
        return {
          id: localId,
          remoteId: rm.id,
          name: rm.model_name,
          version: 'v1.0.0',
          updated: new Date(rm.updated_at).toLocaleDateString(),
          iconKind: iconKindForType(rm.model_type),
          type: rm.model_type,
          isSaved: true,
          published: !!rm.published,
        };
      });

    if (Object.keys(nodeMap).length > 0) {
      this.nodesByModelSubject.next({ ...this.nodesByModelSubject.value, ...nodeMap });
    }
    if (Object.keys(logisticMap).length > 0) {
      this.logisticModelsByModelSubject.next({
        ...this.logisticModelsByModelSubject.value,
        ...logisticMap,
      });
    }
    this.sampleDataByModelSubject.next(sampleMap);
    this.libraryModelsSubject.next(entries);
  }

  getSampleData(): SampleDataRow[] {
    return this.getSampleDataForModel(this.selectedModelIdSubject.value);
  }

  getSampleDataForModel(modelId: string): SampleDataRow[] {
    return this.sampleDataByModelSubject.value[modelId] ?? [];
  }

  addSampleRow(): void {
    const modelId = this.selectedModelIdSubject.value;
    const model = this.libraryModelsSubject.value.find((entry) => entry.id === modelId);
    const rows = this.getSampleData();
    const nextId = Math.max(0, ...rows.map((row) => row.id)) + 1;

    let newRow: SampleDataRow;
    if (model?.type === 'tree') {
      const features = collectTreeFeatures(this.currentNodes());
      const expected = rows[rows.length - 1]?.expected ?? '';
      newRow = createRandomSampleRow(features, nextId, expected);
    } else if (rows.length > 0) {
      newRow = { ...structuredClone(rows[rows.length - 1]), id: nextId };
    } else {
      newRow = { id: nextId, expected: '' };
    }

    this.setSampleData(modelId, [...rows, newRow]);
  }

  removeSampleRow(id: number): void {
    const modelId = this.selectedModelIdSubject.value;
    const rows = this.getSampleData();
    if (rows.length <= 1) return;
    this.setSampleData(
      modelId,
      rows.filter((row) => row.id !== id),
    );
  }

  updateSampleRow(id: number, field: string, value: string): void {
    const modelId = this.selectedModelIdSubject.value;
    const rows = this.getSampleData();
    this.setSampleData(
      modelId,
      rows.map((row) => {
        if (row.id !== id) return row;
        if (field === 'expected') return { ...row, expected: value };
        const parsed = Number.parseFloat(value);
        if (Number.isNaN(parsed)) return row;
        return { ...row, [field]: parsed };
      }),
    );
  }

  resetSampleData(): void {
    const modelId = this.selectedModelIdSubject.value;
    const original = this.originalSampleDataByModel[modelId] ?? [];
    this.setSampleData(modelId, structuredClone(original));
  }

  importSampleData(rows: SampleDataRow[]): void {
    const modelId = this.selectedModelIdSubject.value;
    if (!modelId || !rows.length) return;
    this.setSampleData(modelId, structuredClone(rows));
  }

  clearAllSampleData(): void {
    const modelId = this.selectedModelIdSubject.value;
    if (!modelId) return;
    this.setSampleData(modelId, []);
  }

  private setSampleData(modelId: string, rows: SampleDataRow[]): void {
    this.sampleDataByModelSubject.next({
      ...this.sampleDataByModelSubject.value,
      [modelId]: rows,
    });
    this.markModelDirty(modelId);
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
    this.markModelDirty(modelId);
  }

  private applyRemoteModelToLibrary(
    modelId: string,
    saved: SupabaseModel,
    updatedLabel: string,
  ): void {
    this.libraryModelsSubject.next(
      this.libraryModelsSubject.value.map((m) =>
        m.id === modelId
          ? {
              ...m,
              remoteId: saved.id,
              isSaved: true,
              published: !!saved.published,
              updated: updatedLabel,
            }
          : m,
      ),
    );
  }

  private markModelDirty(modelId: string): void {
    if (!modelId) return;
    this.libraryModelsSubject.next(
      this.libraryModelsSubject.value.map((model) =>
        model.id === modelId && model.isSaved !== false
          ? { ...model, isSaved: false, updated: 'Unsaved changes' }
          : model,
      ),
    );
  }

  private getModelJsonForId(modelId: string, type: LibraryModel['type']): unknown {
    if (type === 'tree') {
      const nodes = this.nodesByModelSubject.value[modelId] ?? [];
      return toDecisionTreeDocument(nodes);
    }
    if (type === 'logistic') {
      return cloneLogisticRegressionModel(
        this.logisticModelsByModelSubject.value[modelId] ?? DEFAULT_LOGISTIC_REGRESSION_MODEL,
      );
    }
    return null;
  }

  private removeModelFromState(modelId: string): void {
    this.libraryModelsSubject.next(
      this.libraryModelsSubject.value.filter((entry) => entry.id !== modelId),
    );

    const { [modelId]: _nodes, ...nodesByModel } = this.nodesByModelSubject.value;
    this.nodesByModelSubject.next(nodesByModel);

    const { [modelId]: _logistic, ...logisticByModel } = this.logisticModelsByModelSubject.value;
    this.logisticModelsByModelSubject.next(logisticByModel);

    const { [modelId]: _sample, ...sampleByModel } = this.sampleDataByModelSubject.value;
    this.sampleDataByModelSubject.next(sampleByModel);

    delete this.originalSampleDataByModel[modelId];
  }
}
