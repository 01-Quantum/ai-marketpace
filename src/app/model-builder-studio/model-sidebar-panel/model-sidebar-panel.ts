import { Component, computed, effect, inject, input, output, signal, viewChild, ElementRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Check,
  Download,
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
import {
  collectFeatureOptions,
  collectTreeFeatures,
  randomFeatureInputs,
  sampleRowToFeatureInputs,
} from '../decision-tree-features';
import { SampleDataService } from '../sample-data.service';
import {
  BatchRegressionResult,
  BatchTestResult,
  batchRowToFeatureVector,
  defaultFeatureVector,
} from '../dataset';
import { sampleRowFields, SampleDataRow, parseSampleDataCsv, sampleDataToCsv } from '../sample-data.types';
import {
  predictLinearRegression,
  runLinearRegressionBatch,
} from '../linear-regression-inference';
import { LinearPrediction } from '../linear-regression-model.types';
import { LinearRegressionModelService } from '../linear-regression-model.service';
import { ModelBuilderService } from '../model-builder.service';
import { DecisionNode, LeafNode, ModelType } from '../model-builder.types';

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
  private readonly sampleData = inject(SampleDataService);

  readonly csvFileInput = viewChild<ElementRef<HTMLInputElement>>('csvFileInput');

  readonly collapsed = input(false);
  readonly collapseToggle = output<void>();

  readonly activeTab = signal<SidebarTab>('properties');
  readonly inputMode = signal<InputMode>('single');
  readonly featureValues = signal<number[]>([]);
  readonly treeFeatureInputs = signal<Record<string, number>>({});
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

  readonly treeFeatures = computed(() => collectTreeFeatures(this.treeNodes()));

  constructor() {
    effect(() => {
      const modelId = this.selectedModelId();
      if (!modelId) return;

      const model = this.selectedModel();
      const rows = this.modelBuilder.getSampleData();

      if (model?.type === 'tree') {
        const features = collectTreeFeatures(this.treeNodes());
        if (rows.length > 0) {
          this.treeFeatureInputs.set(sampleRowToFeatureInputs(rows[0]));
        } else {
          this.treeFeatureInputs.set(randomFeatureInputs(features));
        }
      } else if (model?.type === 'linear') {
        const keys = this.linearModel().features.map((feature) => feature.name);
        if (rows.length > 0) {
          this.featureValues.set(batchRowToFeatureVector(rows[0], keys));
        } else {
          this.featureValues.set(defaultFeatureVector(keys.length));
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

  readonly featureOptions = computed(() =>
    collectFeatureOptions(this.treeNodes(), this.batchRows(), this.decisionNode()?.feature),
  );

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
  readonly DownloadIcon = Download;
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

  onTreeFeatureChange(feature: string, value: string): void {
    const parsed = Number.parseFloat(value);
    if (Number.isNaN(parsed)) return;
    this.treeFeatureInputs.update((current) => ({ ...current, [feature]: parsed }));
  }

  runTest(): void {
    this.clearResults();
    if (this.selectedModelType() === 'linear') {
      const result = predictLinearRegression(
        this.linearRegressionModel.getModel(),
        this.featureValues(),
      );
      this.lastLinearResult.set(result);
    } else if (this.selectedModelType() === 'tree') {
      const result = predictDecisionTree(this.treeNodes(), this.treeFeatureInputs());
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
    } else if (this.selectedModelType() === 'tree') {
      const result = runBatchTest(this.treeNodes(), rows);
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
    this.sampleData.addTestRow();
  }

  importBatchCsv(): void {
    this.csvFileInput()?.nativeElement.click();
  }

  onCsvFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const rows = parseSampleDataCsv(text);
      if (rows.length) {
        this.sampleData.importSampleData(rows);
        this.selectedBatchRowId.set(null);
      }
      input.value = '';
    };
    reader.readAsText(file);
  }

  downloadBatchCsv(): void {
    const rows = this.batchRows();
    if (!rows.length) return;

    const csv = sampleDataToCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const modelName = this.selectedModel()?.name ?? 'model';
    const slug = modelName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const filename = `${slug || 'model'}-sample-data.csv`;

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  clearAllTestData(): void {
    this.sampleData.clearAllTestData();
    this.selectedBatchRowId.set(null);
    this.clearResults();
  }

  selectBatchRow(id: number): void {
    this.selectedBatchRowId.set(id);
  }

  onBatchCellChange(rowId: number, field: string, value: string): void {
    this.sampleData.updateTestRow(rowId, field, value);
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
    if (!Number.isNaN(intercept)) {
      this.linearRegressionModel.updateIntercept(intercept);
      this.modelBuilder.markCurrentModelDirty();
    }
  }

  onCoefficientChange(index: number, value: string): void {
    const weight = Number.parseFloat(value);
    if (!Number.isNaN(weight)) {
      this.linearRegressionModel.updateCoefficient(index, weight);
      this.modelBuilder.markCurrentModelDirty();
    }
  }

  addNode(): void {
    this.modelBuilder.addNode();
  }

  deleteNode(): void {
    const node = this.selectedNode();
    if (node) this.modelBuilder.deleteNode(node.id);
  }
}
