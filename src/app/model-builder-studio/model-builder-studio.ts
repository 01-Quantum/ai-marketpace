import { Component, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ChartScatter,
  Check,
  ChevronRight,
  CircleHelp,
  CloudUpload,
  Copy,
  Download,
  LucideAngularModule,
  MoreVertical,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Save,
  Upload,
  ShieldCheck,
  Trash2,
  TrendingUp,
} from 'lucide-angular';
import { AppTopBar } from '../shared/app-top-bar/app-top-bar';
import { DecisionTreeDesigner } from './decision-tree-designer/decision-tree-designer';
import { toDecisionTreeDocument } from './decision-tree-document';
import { LinearRegressionDesigner } from './linear-regression-designer/linear-regression-designer';
import { LinearRegressionModelService } from './linear-regression-model.service';
import { LogisticRegressionDesigner } from './logistic-regression-designer/logistic-regression-designer';
import { LogisticRegressionModelService } from './logistic-regression-model.service';
import { downloadModelExport } from './model-export';
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
  private readonly modelUploadInput = viewChild<ElementRef<HTMLInputElement>>('modelUploadInput');

  private readonly modelBuilder = inject(ModelBuilderService);
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
  readonly openLibraryMenuId = signal<string | null>(null);

  readonly loading = this.modelBuilder.loading;
  readonly saving = this.modelBuilder.saving;
  readonly deleting = this.modelBuilder.deleting;
  readonly publishing = this.modelBuilder.publishing;

  readonly NetworkIcon = Network;
  readonly ShieldCheckIcon = ShieldCheck;
  readonly UploadIcon = Upload;
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
  readonly CopyIcon = Copy;
  readonly DownloadIcon = Download;

  @HostListener('document:click')
  closeLibraryMenu(): void {
    this.openLibraryMenuId.set(null);
  }

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

  triggerModelUpload(): void {
    this.modelUploadInput()?.nativeElement.click();
  }

  onModelFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const importedId = this.modelBuilder.importModelFromJsonText(text);
      if (!importedId) {
        window.alert(
          'Could not import model. Use a JSON file exported from Model Builder Studio (or a compatible model_name / model_type payload).',
        );
      } else {
        this.editingName.set(false);
      }
      input.value = '';
    };
    reader.readAsText(file);
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
    const model = this.selectedModel();
    if (!model) return;
    if (!confirm(`Delete "${model.name}"? This cannot be undone.`)) return;
    await this.modelBuilder.deleteCurrentModel();
  }

  toggleLibraryMenu(modelId: string, event: Event): void {
    event.stopPropagation();
    this.openLibraryMenuId.update((current) => (current === modelId ? null : modelId));
  }

  cloneLibraryModel(modelId: string, event: Event): void {
    event.stopPropagation();
    this.openLibraryMenuId.set(null);
    this.modelBuilder.cloneModel(modelId);
    this.editingName.set(false);
  }

  exportLibraryModel(modelId: string, event: Event): void {
    event.stopPropagation();
    this.openLibraryMenuId.set(null);
    const doc = this.modelBuilder.buildExportDocument(modelId);
    if (doc) downloadModelExport(doc);
  }

  async deleteLibraryModel(modelId: string, event: Event): Promise<void> {
    event.stopPropagation();
    this.openLibraryMenuId.set(null);
    const model = this.libraryItems().find((entry) => entry.id === modelId);
    if (!model) return;
    if (!confirm(`Delete "${model.name}"? This cannot be undone.`)) return;
    await this.modelBuilder.deleteModelById(modelId);
    this.editingName.set(false);
  }

  private currentModelJson(): unknown {
    const type = this.selectedModel()?.type;
    if (type === 'logistic') return this.logisticRegressionModel.getModel();
    if (type === 'linear') return this.linearRegressionModel.getModel();
    return toDecisionTreeDocument(this.modelBuilder.getCurrentNodes());
  }

  publishButtonLabel(): string {
    return this.selectedModel()?.published ? 'Unpublish' : 'Publish';
  }

  canTogglePublish(): boolean {
    const model = this.selectedModel();
    return !!model?.remoteId && !this.publishing() && !this.saving();
  }

  async togglePublish(): Promise<void> {
    const model = this.selectedModel();
    if (!model) return;
    if (!model.remoteId) {
      window.alert('Save the model to Supabase before publishing.');
      return;
    }

    if (model.published) {
      const ok = await this.modelBuilder.unpublishCurrentModel();
      if (!ok) window.alert('Could not unpublish the model. Try again.');
      return;
    }

    const ok = await this.modelBuilder.publishCurrentModel(this.currentModelJson());
    if (!ok) window.alert('Could not publish the model. Try again.');
  }
}
