import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ChevronDown, LucideAngularModule, Plus, Trash2 } from 'lucide-angular';
import { ModelBuilderService } from '../model-builder.service';
import { DecisionNode, FEATURE_OPTIONS, LeafNode } from '../model-builder.types';

@Component({
  selector: 'app-node-properties',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './node-properties.html',
  styleUrl: './node-properties.css',
})
export class NodeProperties {
  private readonly modelBuilder = inject(ModelBuilderService);

  readonly selectedNode = toSignal(this.modelBuilder.selectedNode$, { initialValue: null });
  readonly branchOptions = toSignal(this.modelBuilder.branchOptions$, { initialValue: [] });

  readonly decisionNode = computed<DecisionNode | null>(() => {
    const node = this.selectedNode();
    return node?.type === 'decision' ? node : null;
  });
  readonly leafNode = computed<LeafNode | null>(() => {
    const node = this.selectedNode();
    return node?.type === 'leaf' ? node : null;
  });

  readonly featureOptions = FEATURE_OPTIONS;

  readonly PlusIcon = Plus;
  readonly Trash2Icon = Trash2;
  readonly ChevronDownIcon = ChevronDown;

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
