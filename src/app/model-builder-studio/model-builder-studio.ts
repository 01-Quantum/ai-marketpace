import { Component, signal } from '@angular/core';
import {
  ChartScatter,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  GitBranch,
  Info,
  Leaf,
  LucideAngularModule,
  Maximize2,
  Minus,
  MoreVertical,
  Network,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-angular';
import { AppTopBar } from '../shared/app-top-bar/app-top-bar';

type ModelType = 'tree' | 'logistic';

interface LibraryItem {
  id: string;
  name: string;
  version: string;
  updated: string;
  iconKind: 'tree' | 'scatter' | 'shield';
}

interface TreeNode {
  id: number;
  title: string;
  meta: string;
  type: 'decision' | 'leaf';
  top: number;
  left: number;
  width: number;
}

interface TreeEdge {
  fromId: number;
  toId: number;
  label: string;
  branch: 'true' | 'false';
}

@Component({
  selector: 'app-model-builder-studio',
  standalone: true,
  imports: [LucideAngularModule, AppTopBar],
  templateUrl: './model-builder-studio.html',
  styleUrl: './model-builder-studio.css',
})
export class ModelBuilderStudio {
  readonly modelType = signal<ModelType>('tree');
  readonly selectedLibraryId = signal<string>('iris-dt');
  readonly selectedNodeId = signal<number>(3);

  readonly libraryItems: LibraryItem[] = [
    {
      id: 'iris-dt',
      name: 'Iris Decision Tree',
      version: 'v1.2.0',
      updated: 'Updated 2d ago',
      iconKind: 'tree',
    },
    {
      id: 'logreg-classifier',
      name: 'Logistic Regression',
      version: 'v1.0.0',
      updated: 'Updated 5d ago',
      iconKind: 'scatter',
    },
    {
      id: 'risk-classifier',
      name: 'Risk Classifier',
      version: 'v0.9.1',
      updated: 'Updated 1w ago',
      iconKind: 'shield',
    },
  ];

  readonly nodes: TreeNode[] = [
    { id: 1, title: 'petal_length < 2.4', meta: 'Samples: 150 · Gini: 0.667', type: 'decision', top: 60, left: 340, width: 220 },
    { id: 2, title: 'species = setosa', meta: 'Samples: 50 · Gini: 0.000', type: 'leaf', top: 220, left: 60, width: 220 },
    { id: 3, title: 'petal_width < 1.8', meta: 'Samples: 100 · Gini: 0.500', type: 'decision', top: 220, left: 460, width: 220 },
    { id: 4, title: 'species = versicolor', meta: 'Samples: 54 · Gini: 0.168', type: 'leaf', top: 380, left: 320, width: 220 },
    { id: 5, title: 'species = virginica', meta: 'Samples: 46 · Gini: 0.000', type: 'leaf', top: 380, left: 600, width: 220 },
  ];

  readonly edges: TreeEdge[] = [
    { fromId: 1, toId: 2, label: 'True (\u2264 2.4)', branch: 'true' },
    { fromId: 1, toId: 3, label: 'False (> 2.4)', branch: 'false' },
    { fromId: 3, toId: 4, label: 'True (\u2264 1.8)', branch: 'true' },
    { fromId: 3, toId: 5, label: 'False (> 1.8)', branch: 'false' },
  ];

  readonly canvasWidth = 880;
  readonly canvasHeight = 500;
  readonly nodeHeight = 80;

  readonly GitBranchIcon = GitBranch;
  readonly ChartScatterIcon = ChartScatter;
  readonly NetworkIcon = Network;
  readonly ShieldCheckIcon = ShieldCheck;
  readonly LeafIcon = Leaf;
  readonly PlusIcon = Plus;
  readonly MinusIcon = Minus;
  readonly Maximize2Icon = Maximize2;
  readonly MoreVerticalIcon = MoreVertical;
  readonly Trash2Icon = Trash2;
  readonly CircleHelpIcon = CircleHelp;
  readonly InfoIcon = Info;
  readonly ChevronDownIcon = ChevronDown;
  readonly ChevronRightIcon = ChevronRight;

  setModelType(t: ModelType): void {
    this.modelType.set(t);
  }

  selectLibrary(id: string): void {
    this.selectedLibraryId.set(id);
  }

  selectNode(id: number): void {
    this.selectedNodeId.set(id);
  }

  iconForLibrary(kind: LibraryItem['iconKind']): typeof Network {
    switch (kind) {
      case 'tree':
        return Network;
      case 'scatter':
        return ChartScatter;
      case 'shield':
        return ShieldCheck;
    }
  }

  edgePath(edge: TreeEdge): string {
    const from = this.nodes.find((n) => n.id === edge.fromId);
    const to = this.nodes.find((n) => n.id === edge.toId);
    if (!from || !to) return '';
    const fromX = from.left + from.width / 2;
    const fromY = from.top + this.nodeHeight;
    const toX = to.left + to.width / 2;
    const toY = to.top;
    const midY = (fromY + toY) / 2;
    return `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;
  }

  edgeLabelPosition(edge: TreeEdge): { left: number; top: number } {
    const from = this.nodes.find((n) => n.id === edge.fromId);
    const to = this.nodes.find((n) => n.id === edge.toId);
    if (!from || !to) return { left: 0, top: 0 };
    const fromX = from.left + from.width / 2;
    const fromY = from.top + this.nodeHeight;
    const toX = to.left + to.width / 2;
    const toY = to.top;
    return {
      left: (fromX + toX) / 2,
      top: (fromY + toY) / 2 - 12,
    };
  }

  signOut(): void {}
}
