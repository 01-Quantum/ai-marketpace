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
  Share2,
  Upload,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
} from 'lucide-angular';
import { AppTopBar } from '../shared/app-top-bar/app-top-bar';
import { DecisionTreeDesigner } from './decision-tree-designer/decision-tree-designer';
import { toDecisionTreeDocument } from './decision-tree-document';
import { LogisticRegressionDesigner } from './logistic-regression-designer/logistic-regression-designer';
import { LogisticRegressionModelService } from './logistic-regression-model.service';
import { downloadModelExport } from './model-export';
import { ModelBuilderService } from './model-builder.service';
import { LibraryModel } from './model-builder.types';
import {
  ModelShareEntry,
  ModelSupabaseService,
} from './model-supabase.service';
import { ModelSidebarPanel } from './model-sidebar-panel/model-sidebar-panel';

const LIBRARY_ICONS: Record<LibraryModel['iconKind'], typeof Network> = {
  tree: Network,
  scatter: ChartScatter,
  shield: ShieldCheck,
};

@Component({
  selector: 'app-model-builder-studio',
  standalone: true,
  imports: [
    LucideAngularModule,
    AppTopBar,
    DecisionTreeDesigner,
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
  private readonly modelSupabase = inject(ModelSupabaseService);

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

  readonly shareModalOpen = signal(false);
  readonly shareEmail = signal('');
  readonly shareError = signal('');
  readonly sharing = signal(false);
  readonly modelShares = signal<ModelShareEntry[]>([]);
  readonly loadingShares = signal(false);
  readonly revokingShareId = signal<number | null>(null);

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
  readonly Share2Icon = Share2;
  readonly UserPlusIcon = UserPlus;
  readonly XIcon = X;

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
    return toDecisionTreeDocument(this.modelBuilder.getCurrentNodes());
  }

  publishButtonLabel(): string {
    return this.selectedModel()?.published ? 'Unpublish' : 'Publish';
  }

  canTogglePublish(): boolean {
    const model = this.selectedModel();
    return !!model?.remoteId && !this.publishing() && !this.saving();
  }

  canShareModel(): boolean {
    const model = this.selectedModel();
    return !!model?.remoteId && !this.sharing();
  }

  async openShareModal(): Promise<void> {
    const model = this.selectedModel();
    if (!model?.remoteId) {
      window.alert('Save the model to Supabase before sharing.');
      return;
    }

    this.shareEmail.set('');
    this.shareError.set('');
    this.shareModalOpen.set(true);
    await this.refreshModelShares(model.remoteId);
  }

  closeShareModal(): void {
    this.shareModalOpen.set(false);
    this.shareError.set('');
  }

  onShareModalBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeShareModal();
    }
  }

  onShareEmailInput(event: Event): void {
    this.shareEmail.set((event.target as HTMLInputElement).value);
  }

  async refreshModelShares(modelId: number): Promise<void> {
    this.loadingShares.set(true);
    this.shareError.set('');

    const { shares, error } = await this.modelSupabase.listModelShares(modelId);
    this.modelShares.set(shares);
    if (error) {
      this.shareError.set(error);
    }

    this.loadingShares.set(false);
  }

  async submitShare(): Promise<void> {
    const model = this.selectedModel();
    if (!model?.remoteId || this.sharing()) return;

    this.sharing.set(true);
    this.shareError.set('');

    const result = await this.modelSupabase.shareModelByEmail(model.remoteId, this.shareEmail());
    this.sharing.set(false);

    if (!result.ok) {
      this.shareError.set(result.error);
      return;
    }

    this.shareEmail.set('');
    await this.refreshModelShares(model.remoteId);
  }

  async revokeShare(shareId: number): Promise<void> {
    if (this.revokingShareId() !== null) return;

    this.revokingShareId.set(shareId);
    this.shareError.set('');

    const result = await this.modelSupabase.revokeModelShare(shareId);
    this.revokingShareId.set(null);

    if (!result.ok) {
      this.shareError.set(result.error);
      return;
    }

    const model = this.selectedModel();
    if (model?.remoteId) {
      await this.refreshModelShares(model.remoteId);
    }
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
