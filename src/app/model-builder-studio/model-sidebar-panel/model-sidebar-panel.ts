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
import { DecisionTreeModelService } from '../decision-tree-model.service';
import { InferenceResult, predictDecisionTree, runBatchTest } from '../decision-tree-inference';
import { IrisDataService } from '../iris-data.service';
import {
  BatchField,
  BatchRegressionResult,
  BatchTestResult,
  BatchTestRow,
  IRIS_FEATURE_NAMES,
  defaultIrisSample,
} from '../iris-dataset';
import {
  predictLinearRegression,
  runLinearRegressionBatch,
} from '../linear-regression-inference';
import { LinearPrediction } from '../linear-regression-model.types';
import { LinearRegressionModelService } from '../linear-regression-model.service';
import { ModelBuilderService } from '../model-builder.service';
import { DecisionNode, FEATURE_OPTIONS, LeafNode, ModelType } from '../model-builder.types';

type SidebarTab = 'properties' | 'test-data' | 'results';
type InputMode = 'single' | 'batch';
type TestRunMode = 'single' | 'batch';

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
  private readonly linearRegressionModel = inject(LinearRegressionModelService);
  private readonly irisData = inject(IrisDataService);

  readonly collapsed = input(false);
  readonly collapseToggle = output<void>();

  readonly activeTab = signal<SidebarTab>('test-data');
  readonly inputMode = signal<InputMode>('single');
  readonly featureValues = signal<number[]>(defaultIrisSample());
  readonly lastResult = signal<InferenceResult | null>(null);
  readonly lastBatchResult = signal<BatchTestResult | null>(null);
  readonly lastLinearResult = signal<LinearPrediction | null>(null);
  readonly lastLinearBatchResult = signal<BatchRegressionResult | null>(null);
  readonly lastRunMode = signal<TestRunMode | null>(null);
  readonly selectedBatchRowId = signal<number | null>(null);

  readonly batchRows = toSignal(this.irisData.publishedTestData$, {
    initialValue: [] as BatchTestRow[],
  });

  readonly selectedModel = toSignal(this.modelBuilder.selectedModel$, { initialValue: null });
  readonly selectedNode = toSignal(this.modelBuilder.selectedNode$, { initialValue: null });
  readonly linearModel = toSignal(this.linearRegressionModel.model$, {
    initialValue: this.linearRegressionModel.getModel(),
  });

  readonly selectedModelType = computed<ModelType | null>(
    () => this.selectedModel()?.type ?? null,
  );

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

  readonly batchMaeLabel = computed(() => {
    const result = this.lastLinearBatchResult();
    if (!result || result.total === 0) return '';
    return `Mean absolute error: ${result.meanAbsoluteError.toFixed(4)} (${result.total} rows)`;
  });

  readonly modelFeatures = IRIS_FEATURE_NAMES;
  readonly featureOptions = FEATURE_OPTIONS;
  readonly batchFields = BATCH_FIELDS;

  readonly linearTarget = computed(() => this.linearRegressionModel.getModel().target);

  formatNumber(value: number, decimals = 4): string {
    return value.toFixed(decimals);
  }

  formatSigned(value: number, decimals = 4): string {
    const fixed = value.toFixed(decimals);
    return value > 0 ? `+${fixed}` : fixed;
  }

  isLargeResidual(residual: number): boolean {
    return Math.abs(residual) > 0.5;
  }

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
    this.clearResults();
    if (this.selectedModelType() === 'linear') {
      const result = predictLinearRegression(
        this.linearRegressionModel.getModel(),
        this.featureValues(),
      );
      this.lastLinearResult.set(result);
    } else {
      const result = predictDecisionTree(this.decisionTreeModel.getModel(), this.featureValues());
      this.lastResult.set(result);
    }
    this.lastRunMode.set('single');
  }

  runBatchTest(): void {
    const rows = this.batchRows();
    if (!rows.length) return;
    this.clearResults();
    if (this.selectedModelType() === 'linear') {
      const result = runLinearRegressionBatch(this.linearRegressionModel.getModel(), rows);
      this.lastLinearBatchResult.set(result);
    } else {
      const result = runBatchTest(this.decisionTreeModel.getModel(), rows);
      this.lastBatchResult.set(result);
    }
    this.lastRunMode.set('batch');
  }

  private clearResults(): void {
    this.lastResult.set(null);
    this.lastBatchResult.set(null);
    this.lastLinearResult.set(null);
    this.lastLinearBatchResult.set(null);
  }

  addBatchRow(): void {
    this.irisData.addTestRow();
  }

  importBatchCsv(): void {
    this.irisData.importPublishedTestData();
    this.selectedBatchRowId.set(null);
  }

  removeSelectedBatchRow(): void {
    const id = this.selectedBatchRowId();
    if (id === null) return;
    this.irisData.removeTestRow(id);
    this.selectedBatchRowId.set(null);
  }

  selectBatchRow(id: number): void {
    this.selectedBatchRowId.set(id);
  }

  onBatchCellChange(rowId: number, field: BatchField, value: string): void {
    this.irisData.updateTestRow(rowId, field, value);
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

  onInterceptChange(value: string): void {
    const intercept = Number.parseFloat(value);
    if (!Number.isNaN(intercept)) this.linearRegressionModel.updateIntercept(intercept);
  }

  onCoefficientChange(index: number, value: string): void {
    const weight = Number.parseFloat(value);
    if (!Number.isNaN(weight)) this.linearRegressionModel.updateCoefficient(index, weight);
  }

  addNode(): void {
    this.modelBuilder.addNode();
  }

  deleteNode(): void {
    const node = this.selectedNode();
    if (node) this.modelBuilder.deleteNode(node.id);
  }
}
