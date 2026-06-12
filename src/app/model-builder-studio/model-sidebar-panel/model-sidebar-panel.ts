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
  predictLogisticRegression,
  runLogisticBatchTest,
} from '../logistic-regression-inference';
import { LogisticRegressionModelService } from '../logistic-regression-model.service';
import {
  collectFeatureOptions,
  collectTreeFeatures,
  randomFeatureInputs,
  sampleRowToFeatureInputs,
} from '../decision-tree-features';
import { SampleDataService } from '../sample-data.service';
import { BatchTestResult } from '../dataset';
import { SampleDataDownloadService } from '../../shared/sample-data-download.service';
import { sampleRowFields, SampleDataRow, parseSampleDataCsv } from '../sample-data.types';
import { ModelBuilderService } from '../model-builder.service';
import { DecisionNode, LeafNode } from '../model-builder.types';

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
  private readonly sampleData = inject(SampleDataService);
  private readonly sampleDataDownload = inject(SampleDataDownloadService);
  private readonly logisticModelService = inject(LogisticRegressionModelService);

  readonly csvFileInput = viewChild<ElementRef<HTMLInputElement>>('csvFileInput');

  readonly collapsed = input(false);
  readonly collapseToggle = output<void>();

  readonly activeTab = signal<SidebarTab>('properties');
  readonly inputMode = signal<InputMode>('single');
  readonly treeFeatureInputs = signal<Record<string, number>>({});
  readonly logisticFeatureInputs = signal<Record<string, number>>({});
  readonly lastResult = signal<InferenceResult | null>(null);
  readonly lastLogisticResult = signal<ReturnType<typeof predictLogisticRegression> | null>(null);
  readonly lastBatchResult = signal<BatchTestResult | null>(null);
  readonly lastRunMode = signal<TestRunMode | null>(null);
  readonly selectedBatchRowId = signal<number | null>(null);

  readonly batchRows = toSignal(this.modelBuilder.sampleData$, {
    initialValue: [] as SampleDataRow[],
  });

  readonly selectedModel = toSignal(this.modelBuilder.selectedModel$, { initialValue: null });
  readonly selectedModelId = toSignal(this.modelBuilder.selectedModelId$, { initialValue: '' });
  readonly selectedNode = toSignal(this.modelBuilder.selectedNode$, { initialValue: null });
  readonly treeNodes = toSignal(this.modelBuilder.nodes$, { initialValue: [] });
  readonly logisticModel = toSignal(this.logisticModelService.model$, {
    initialValue: this.logisticModelService.getModel(),
  });

  readonly batchFields = computed(() => sampleRowFields(this.batchRows()[0]));

  readonly treeFeatures = computed(() => collectTreeFeatures(this.treeNodes()));
  readonly logisticFeatures = computed(() => this.logisticModel().features);

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
      }

      if (model?.type === 'logistic') {
        const features = this.logisticModelService.getModel().features;
        if (rows.length > 0) {
          this.logisticFeatureInputs.set(sampleRowToFeatureInputs(rows[0]));
        } else {
          this.logisticFeatureInputs.set(
            Object.fromEntries(features.map((feature) => [feature.name, feature.inputValue])),
          );
        }
      }

      this.clearResults();
      this.selectedBatchRowId.set(null);
    });
  }

  readonly selectedModelType = computed(() => this.selectedModel()?.type ?? null);

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

  readonly featureOptions = computed(() =>
    collectFeatureOptions(this.treeNodes(), this.batchRows(), this.decisionNode()?.feature),
  );

  formatNumber(value: number, decimals = 4): string {
    return value.toFixed(decimals);
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

  onTreeFeatureChange(feature: string, value: string): void {
    const parsed = Number.parseFloat(value);
    if (Number.isNaN(parsed)) return;
    this.treeFeatureInputs.update((current) => ({ ...current, [feature]: parsed }));
  }

  onLogisticFeatureChange(feature: string, value: string): void {
    const parsed = Number.parseFloat(value);
    if (Number.isNaN(parsed)) return;
    this.logisticFeatureInputs.update((current) => ({ ...current, [feature]: parsed }));
  }

  private logisticInputsArray(): number[] {
    const model = this.logisticModel();
    const inputs = this.logisticFeatureInputs();
    return model.features.map((feature) => inputs[feature.name] ?? feature.inputValue);
  }

  runTest(): void {
    this.clearResults();
    if (this.selectedModelType() === 'tree') {
      const result = predictDecisionTree(this.treeNodes(), this.treeFeatureInputs());
      this.lastResult.set(result);
    } else if (this.selectedModelType() === 'logistic') {
      const result = predictLogisticRegression(this.logisticModel(), this.logisticInputsArray());
      this.lastLogisticResult.set(result);
    }
    this.lastRunMode.set('single');
  }

  runBatchTest(): void {
    const rows = this.batchRows();
    if (!rows.length) return;
    this.clearResults();
    if (this.selectedModelType() === 'tree') {
      const result = runBatchTest(this.treeNodes(), rows);
      this.lastBatchResult.set(result);
    } else if (this.selectedModelType() === 'logistic') {
      const result = runLogisticBatchTest(this.logisticModel(), rows);
      this.lastBatchResult.set(result);
    }
    this.lastRunMode.set('batch');
  }

  private clearResults(): void {
    this.lastResult.set(null);
    this.lastLogisticResult.set(null);
    this.lastBatchResult.set(null);
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
    const modelName = this.selectedModel()?.name ?? 'model';
    this.sampleDataDownload.downloadCsv(rows, modelName);
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

  addNode(): void {
    this.modelBuilder.addNode();
  }

  deleteNode(): void {
    const node = this.selectedNode();
    if (node) this.modelBuilder.deleteNode(node.id);
  }
}
