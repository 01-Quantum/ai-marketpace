import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
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
import { InferenceResult, predictDecisionTree, runBatchTest } from '../decision-tree-inference';
import { IrisDataService } from '../iris-data.service';
import {
  BatchRegressionResult,
  BatchTestResult,
  BatchTestRow,
  IRIS_FEATURE_NAMES,
  batchRowToFeatures,
  defaultIrisSample,
} from '../iris-dataset';
import { sampleRowFields, SampleDataRow } from '../sample-data.types';
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

@Component({
  selector: 'app-model-sidebar-panel',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './model-sidebar-panel.html',
  styleUrl: './model-sidebar-panel.css',
})
export class ModelSidebarPanel {
  private readonly modelBuilder = inject(ModelBuilderService);
  private readonly linearRegressionModel = inject(LinearRegressionModelService);
  private readonly irisData = inject(IrisDataService);

  readonly collapsed = input(false);
  readonly collapseToggle = output<void>();

  readonly activeTab = signal<SidebarTab>('properties');
  readonly inputMode = signal<InputMode>('single');
  readonly featureValues = signal<number[]>(defaultIrisSample());
  readonly lastResult = signal<InferenceResult | null>(null);
  readonly lastBatchResult = signal<BatchTestResult | null>(null);
  readonly lastLinearResult = signal<LinearPrediction | null>(null);
  readonly lastLinearBatchResult = signal<BatchRegressionResult | null>(null);
  readonly lastRunMode = signal<TestRunMode | null>(null);
  readonly selectedBatchRowId = signal<number | null>(null);

  readonly batchRows = toSignal(this.modelBuilder.sampleData$, {
    initialValue: [] as SampleDataRow[],
  });

  readonly selectedModel = toSignal(this.modelBuilder.selectedModel$, { initialValue: null });
  readonly selectedModelId = toSignal(this.modelBuilder.selectedModelId$, { initialValue: '' });
  readonly selectedNode = toSignal(this.modelBuilder.selectedNode$, { initialValue: null });
  readonly treeNodes = toSignal(this.modelBuilder.nodes$, { initialValue: [] });

  readonly batchFields = computed(() => sampleRowFields(this.batchRows()[0]));

  constructor() {
    effect(() => {
      const modelId = this.selectedModelId();
      if (!modelId) return;

      const model = this.selectedModel();
      const rows = this.modelBuilder.getSampleData();

      if (model && model.type !== 'logistic') {
        if (rows.length > 0) {
          const row = rows[0];
          this.featureValues.set(
            batchRowToFeatures({
              sepal_length: Number(row['sepal_length'] ?? 0),
              sepal_width: Number(row['sepal_width'] ?? 0),
              petal_length: Number(row['petal_length'] ?? 0),
              petal_width: Number(row['petal_width'] ?? 0),
            }),
          );
        } else {
          this.featureValues.set(defaultIrisSample());
        }
      }

      this.clearResults();
      this.selectedBatchRowId.set(null);
    });
  }

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
      const result = predictDecisionTree(this.treeNodes(), this.featureValues());
      this.lastResult.set(result);
    }
    this.lastRunMode.set('single');
  }

  runBatchTest(): void {
    const rows = this.batchRows();
    if (!rows.length) return;
    this.clearResults();
    if (this.selectedModelType() === 'linear') {
      const result = runLinearRegressionBatch(
        this.linearRegressionModel.getModel(),
        rows as unknown as BatchTestRow[],
      );
      this.lastLinearBatchResult.set(result);
    } else {
      const result = runBatchTest(this.treeNodes(), rows as unknown as BatchTestRow[]);
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

  onBatchCellChange(rowId: number, field: string, value: string): void {
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
