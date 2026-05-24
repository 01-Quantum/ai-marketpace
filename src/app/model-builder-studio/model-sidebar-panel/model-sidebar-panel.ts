import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Leaf,
  LucideAngularModule,
  PanelLeftOpen,
  PanelRightClose,
  Play,
  Plus,
  Trash2,
} from 'lucide-angular';
import { DecisionTreeModelService } from '../decision-tree-model.service';
import { InferenceResult, predictDecisionTree } from '../decision-tree-inference';
import { ModelBuilderService } from '../model-builder.service';
import { DecisionNode, FEATURE_OPTIONS, LeafNode } from '../model-builder.types';

type SidebarTab = 'properties' | 'test-data' | 'results';
type InputMode = 'single' | 'batch' | 'csv';

const DEFAULT_SAMPLE = [5.1, 3.5, 1.4, 0.2];

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
  readonly hasRunTest = signal(false);

  readonly selectedNode = toSignal(this.modelBuilder.selectedNode$, { initialValue: null });

  readonly decisionNode = computed<DecisionNode | null>(() => {
    const node = this.selectedNode();
    return node?.type === 'decision' ? node : null;
  });
  readonly leafNode = computed<LeafNode | null>(() => {
    const node = this.selectedNode();
    return node?.type === 'leaf' ? node : null;
  });

  readonly modelFeatures = this.decisionTreeModel.getModel().features;
  readonly featureOptions = FEATURE_OPTIONS;

  readonly PlusIcon = Plus;
  readonly Trash2Icon = Trash2;
  readonly PanelRightCloseIcon = PanelRightClose;
  readonly PanelLeftOpenIcon = PanelLeftOpen;
  readonly PlayIcon = Play;
  readonly LeafIcon = Leaf;

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
    this.hasRunTest.set(true);
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
