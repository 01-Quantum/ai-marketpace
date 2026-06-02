import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ChartScatter,
  Check,
  ChevronRight,
  CircleHelp,
  CloudUpload,
  LucideAngularModule,
  MoreVertical,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  TrendingUp,
} from 'lucide-angular';
import { AppTopBar } from '../shared/app-top-bar/app-top-bar';
import { DecisionTreeDesigner } from './decision-tree-designer/decision-tree-designer';
import { toDecisionTreeDocument } from './decision-tree-document';
import { SampleDataService } from './sample-data.service';
import { LinearRegressionDesigner } from './linear-regression-designer/linear-regression-designer';
import { LinearRegressionModelService } from './linear-regression-model.service';
import { LogisticRegressionDesigner } from './logistic-regression-designer/logistic-regression-designer';
import { LogisticRegressionModelService } from './logistic-regression-model.service';
import { ModelBuilderService } from './model-builder.service';
import { LibraryModel } from './model-builder.types';
import { ModelSidebarPanel } from './model-sidebar-panel/model-sidebar-panel';

const LIBRARY_ICONS: Record<LibraryModel['iconKind'], typeof Network> = {
  tree: Network,
  scatter: ChartScatter,
  shield: ShieldCheck,
  trending: TrendingUp,
};

@Component({
  selector: 'app-model-builder-studio',
  standalone: true,
  imports: [
    LucideAngularModule,
    AppTopBar,
    DecisionTreeDesigner,
    LinearRegressionDesigner,
    LogisticRegressionDesigner,
    ModelSidebarPanel,
  ],
  templateUrl: './model-builder-studio.html',
  styleUrl: './model-builder-studio.css',
})
export class ModelBuilderStudio {
  private readonly modelBuilder = inject(ModelBuilderService);
  private readonly sampleData = inject(SampleDataService);
  private readonly logisticRegressionModel = inject(LogisticRegressionModelService);
  private readonly linearRegressionModel = inject(LinearRegressionModelService);

  readonly libraryItems = toSignal(this.modelBuilder.libraryModels$, {
    initialValue: [] as LibraryModel[],
  });
  readonly selectedLibraryId = toSignal(this.modelBuilder.selectedModelId$, { initialValue: '' });
  readonly selectedModel = toSignal(this.modelBuilder.selectedModel$, { initialValue: null });

  readonly editingName = signal(false);
  readonly nameDraft = signal('');
  readonly libraryCollapsed = signal(false);
  readonly propertiesCollapsed = signal(false);

  readonly loading = this.modelBuilder.loading;
  readonly saving = this.modelBuilder.saving;
  readonly deleting = this.modelBuilder.deleting;

  readonly NetworkIcon = Network;
  readonly ShieldCheckIcon = ShieldCheck;
  readonly PlusIcon = Plus;
  readonly MoreVerticalIcon = MoreVertical;
  readonly CircleHelpIcon = CircleHelp;
  readonly ChevronRightIcon = ChevronRight;
  readonly PencilIcon = Pencil;
  readonly CheckIcon = Check;
  readonly PanelLeftCloseIcon = PanelLeftClose;
  readonly PanelLeftOpenIcon = PanelLeftOpen;
  readonly PanelRightCloseIcon = PanelRightClose;
  readonly PanelRightOpenIcon = PanelRightOpen;
  readonly SaveIcon = Save;
  readonly Trash2Icon = Trash2;
  readonly CloudUploadIcon = CloudUpload;

  toggleLibrary(): void {
    this.libraryCollapsed.update((value) => !value);
  }

  toggleProperties(): void {
    this.propertiesCollapsed.update((value) => !value);
  }

  selectLibrary(id: string): void {
    this.modelBuilder.selectModel(id);
    this.editingName.set(false);
  }

  startEditingName(): void {
    const model = this.selectedModel();
    if (!model) return;
    this.nameDraft.set(model.name);
    this.editingName.set(true);
  }

  saveModelName(): void {
    this.modelBuilder.renameModel(this.nameDraft());
    this.editingName.set(false);
  }

  cancelEditingName(): void {
    this.editingName.set(false);
  }

  onNameDraftInput(event: Event): void {
    this.nameDraft.set((event.target as HTMLInputElement).value);
  }

  onNameKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.saveModelName();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelEditingName();
    }
  }

  iconForLibrary(kind: LibraryModel['iconKind']): typeof Network {
    return LIBRARY_ICONS[kind];
  }

  signOut(): void {}

  async saveModel(): Promise<void> {
    const type = this.selectedModel()?.type;
    let modelJson: unknown = null;
    if (type === 'logistic') {
      modelJson = this.logisticRegressionModel.getModel();
    } else if (type === 'linear') {
      modelJson = this.linearRegressionModel.getModel();
    } else {
      modelJson = toDecisionTreeDocument(this.modelBuilder.getCurrentNodes());
    }
    await this.modelBuilder.saveCurrentModel(modelJson);
  }

  async deleteModel(): Promise<void> {
    await this.modelBuilder.deleteCurrentModel();
  }

  publishToEnclave(): void {
    const type = this.selectedModel()?.type;
    if (type === 'logistic') {
      this.logisticRegressionModel.publishModel();
      return;
    }
    if (type === 'linear') {
      this.linearRegressionModel.publishModel();
      return;
    }
    this.sampleData.publishTestData();
  }
}
