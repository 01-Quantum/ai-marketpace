import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Check,
  Leaf,
  LucideAngularModule,
  PanelLeftOpen,
  PanelRightClose,
  Play,
  Plus,
  Trash2,
  Upload,
} from 'lucide-angular';
import { BatchTestRow, BatchTestResult } from '../decision-tree-model.types';
import { DecisionTreeModelService } from '../decision-tree-model.service';
import { InferenceResult, predictDecisionTree, runBatchTest } from '../decision-tree-inference';
import { ModelBuilderService } from '../model-builder.service';
import { DecisionNode, FEATURE_OPTIONS, LeafNode } from '../model-builder.types';

type SidebarTab = 'properties' | 'test-data' | 'results';
type InputMode = 'single' | 'batch';
type TestRunMode = 'single' | 'batch';
type BatchField = keyof Omit<BatchTestRow, 'id'>;

const DEFAULT_SAMPLE = [5.1, 3.5, 1.4, 0.2];
const BATCH_FIELDS: BatchField[] = [
  'sepal_length',
  'sepal_width',
  'petal_length',
  'petal_width',
  'expected',
];

@Component({
  selector: 'app-model-sidebar-panel',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './model-sidebar-panel.html',
  styleUrl: './model-sidebar-panel.css',
})
export class ModelSidebarPanel {
  private readonly modelBuilder = inject(ModelBuilderService);
  private readonly decisionTreeModel = inject(DecisionTreeModelService);

  readonly collapsed = input(false);
  readonly collapseToggle = output<void>();

  readonly activeTab = signal<SidebarTab>('test-data');
  readonly inputMode = signal<InputMode>('single');
  readonly featureValues = signal<number[]>([...DEFAULT_SAMPLE]);
  readonly lastResult = signal<InferenceResult | null>(null);
  readonly lastBatchResult = signal<BatchTestResult | null>(null);
  readonly lastRunMode = signal<TestRunMode | null>(null);
  readonly selectedBatchRowId = signal<number | null>(null);

  readonly batchRows = toSignal(this.decisionTreeModel.publishedTestData$, {
    initialValue: [] as BatchTestRow[],
  });

  readonly selectedNode = toSignal(this.modelBuilder.selectedNode$, { initialValue: null });

  readonly decisionNode = computed<DecisionNode | null>(() => {
    const node = this.selectedNode();
    return node?.type === 'decision' ? node : null;
  });
  readonly leafNode = computed<LeafNode | null>(() => {
    const node = this.selectedNode();
    return node?.type === 'leaf' ? node : null;
  });

  readonly batchAccuracyLabel = computed(() => {
    const result = this.lastBatchResult();
    if (!result || result.total === 0) return '';
    const pct = Math.round((result.passed / result.total) * 100);
    return `Accuracy: ${result.passed} / ${result.total} (${pct}%)`;
  });

  readonly modelFeatures = this.decisionTreeModel.getModel().features;
  readonly featureOptions = FEATURE_OPTIONS;
  readonly batchFields = BATCH_FIELDS;

  readonly PlusIcon = Plus;
  readonly Trash2Icon = Trash2;
  readonly PanelRightCloseIcon = PanelRightClose;
  readonly PanelLeftOpenIcon = PanelLeftOpen;
  readonly PlayIcon = Play;
  readonly LeafIcon = Leaf;
  readonly UploadIcon = Upload;
  readonly CheckIcon = Check;

  setTab(tab: SidebarTab): void {
    this.activeTab.set(tab);
  }

  setInputMode(mode: InputMode): void {
    this.inputMode.set(mode);
  }

  onFeatureChange(index: number, value: string): void {
    const parsed = Number.parseFloat(value);
    if (Number.isNaN(parsed)) return;
    this.featureValues.update((current) => {
      const next = [...current];
      next[index] = parsed;
      return next;
    });
  }

  runTest(): void {
    const result = predictDecisionTree(this.decisionTreeModel.getModel(), this.featureValues());
    this.lastResult.set(result);
    this.lastBatchResult.set(null);
    this.lastRunMode.set('single');
  }

  runBatchTest(): void {
    const rows = this.batchRows();
    if (!rows.length) return;
    const result = runBatchTest(this.decisionTreeModel.getModel(), rows);
    this.lastBatchResult.set(result);
    this.lastResult.set(null);
    this.lastRunMode.set('batch');
  }

  addBatchRow(): void {
    this.decisionTreeModel.addTestRow();
  }

  importBatchCsv(): void {
    this.decisionTreeModel.importPublishedTestData();
    this.selectedBatchRowId.set(null);
  }

  removeSelectedBatchRow(): void {
    const id = this.selectedBatchRowId();
    if (id === null) return;
    this.decisionTreeModel.removeTestRow(id);
    this.selectedBatchRowId.set(null);
  }

  selectBatchRow(id: number): void {
    this.selectedBatchRowId.set(id);
  }

  onBatchCellChange(rowId: number, field: BatchField, value: string): void {
    this.decisionTreeModel.updateTestRow(rowId, field, value);
  }

  patchDecision(patch: Partial<DecisionNode>): void {
    const node = this.decisionNode();
    if (node) this.modelBuilder.patchNode(node.id, patch);
  }

  patchLeaf(patch: Partial<LeafNode>): void {
    const node = this.leafNode();
    if (node) this.modelBuilder.patchNode(node.id, patch);
  }

  onThresholdChange(value: string): void {
    const threshold = Number.parseFloat(value);
    if (!Number.isNaN(threshold)) this.patchDecision({ threshold });
  }

  addNode(): void {
    this.modelBuilder.addNode();
  }

  deleteNode(): void {
    const node = this.selectedNode();
    if (node) this.modelBuilder.deleteNode(node.id);
  }
}
