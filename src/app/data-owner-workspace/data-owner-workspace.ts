import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, take } from 'rxjs';
import {
  ArrowRight,
  ChartScatter,
  CircleCheck,
  CloudUpload,
  Database,
  Download,
  Eye,
  FileLock,
  FileText,
  KeyRound,
  List,
  LoaderCircle,
  Lock,
  LucideAngularModule,
  Network,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
  User,
  X,
} from 'lucide-angular';
import { AppTopBar } from '../shared/app-top-bar/app-top-bar';
import { AuthService } from '../shared/auth.service';
import { SampleDataDownloadService } from '../shared/sample-data-download.service';
import { WorkflowHeader } from '../shared/workflow-header/workflow-header';
import {
  INFERENCE_MODEL_LABELS,
  InferenceModelChoice,
  parseInferenceModelChoice,
} from '../shared/workflow.types';
import {
  ModelSupabaseService,
  SupabaseModel,
} from '../model-builder-studio/model-supabase.service';
import {
  FheEncryptedDataset,
  FheEncryptedDatasetsService,
} from './fhe-encrypted-datasets.service';
import { FheKey, FheKeysService } from './fhe-keys.service';
import { FheEncryptService } from './fhe-encrypt.service';
import { formatFileSize, validateCsvFile } from './csv-upload';

function parseOptionalModelId(value: string | null): number | null {
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

@Component({
  selector: 'app-data-owner-workspace',
  standalone: true,
  imports: [LucideAngularModule, FormsModule, AppTopBar, WorkflowHeader],
  templateUrl: './data-owner-workspace.html',
  styleUrl: './data-owner-workspace.css',
})
export class DataOwnerWorkspace {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fheKeys = inject(FheKeysService);
  private readonly fheEncrypt = inject(FheEncryptService);
  private readonly fheEncryptedDatasets = inject(FheEncryptedDatasetsService);
  private readonly auth = inject(AuthService);
  private readonly modelSupabase = inject(ModelSupabaseService);
  private readonly sampleDataDownload = inject(SampleDataDownloadService);

  readonly selectedModelType = signal<InferenceModelChoice>(
    parseInferenceModelChoice(this.route.snapshot.queryParamMap.get('model')),
  );
  readonly publishedModels = signal<SupabaseModel[]>([]);
  readonly selectedPublishedModelId = signal<number | null>(
    parseOptionalModelId(this.route.snapshot.queryParamMap.get('modelId')),
  );
  readonly loadingModel = signal(true);
  readonly modelError = signal('');
  readonly showModelSelectModal = signal(false);

  readonly publishedModel = computed(() => {
    const models = this.publishedModels();
    const selectedId = this.selectedPublishedModelId();
    if (selectedId !== null) {
      return models.find((m) => m.id === selectedId) ?? models[0] ?? null;
    }
    return models[0] ?? null;
  });

  readonly publishedModelCount = computed(() => this.publishedModels().length);

  readonly canDownloadSampleData = computed(() => {
    const model = this.publishedModel();
    return model ? this.sampleDataDownload.hasSampleRows(model.sample_data) : false;
  });

  readonly modelTypeLabel = computed(() => INFERENCE_MODEL_LABELS[this.selectedModelType()]);

  readonly currentKey = signal<FheKey | null>(null);
  readonly loadingKey = signal(true);
  readonly busy = signal(false);
  readonly keyError = signal('');

  readonly showKeyModal = signal(false);
  readonly editingKeyId = signal<number | null>(null);
  readonly formName = signal('');
  readonly formScheme = signal('OpenFHE CKKS');
  readonly formDepth = signal(16);
  readonly formSlots = signal(8192);

  readonly showSelectModal = signal(false);
  readonly allKeys = signal<FheKey[]>([]);
  readonly loadingAllKeys = signal(false);

  readonly csvFileInput = viewChild<ElementRef<HTMLInputElement>>('csvFileInput');
  readonly selectedCsvFile = signal<File | null>(null);
  readonly uploadError = signal('');
  readonly dragOver = signal(false);

  readonly selectedCsvFileSize = computed(() => {
    const file = this.selectedCsvFile();
    return file ? formatFileSize(file.size) : '';
  });

  readonly encrypting = signal(false);
  readonly encryptError = signal('');
  readonly encryptSuccess = signal('');

  readonly canEncrypt = computed(
    () =>
      !this.loadingKey() &&
      !this.loadingModel() &&
      !!this.currentKey() &&
      !!this.selectedCsvFile() &&
      !!this.publishedModel(),
  );

  readonly datasets = signal<FheEncryptedDataset[]>([]);
  readonly loadingDatasets = signal(false);
  readonly datasetsError = signal('');
  readonly viewingDataset = signal<FheEncryptedDataset | null>(null);

  readonly ownerLabel = computed(() => {
    const slug =
      (this.auth.displayName() || 'user')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'user';
    return slug;
  });

  readonly ShieldCheckIcon = ShieldCheck;
  readonly KeyRoundIcon = KeyRound;
  readonly FileLockIcon = FileLock;
  readonly CloudUploadIcon = CloudUpload;
  readonly LockIcon = Lock;
  readonly ArrowRightIcon = ArrowRight;
  readonly NetworkIcon = Network;
  readonly ChartScatterIcon = ChartScatter;
  readonly CircleCheckIcon = CircleCheck;
  readonly FileTextIcon = FileText;
  readonly DatabaseIcon = Database;
  readonly EyeIcon = Eye;
  readonly Trash2Icon = Trash2;
  readonly PencilIcon = Pencil;
  readonly ListIcon = List;
  readonly DownloadIcon = Download;
  readonly LoaderIcon = LoaderCircle;
  readonly RefreshCwIcon = RefreshCw;
  readonly CloseIcon = X;
  readonly UserIcon = User;

  constructor() {
    // Wait until AuthService has restored the session before querying, otherwise
    // user()?.id is still null on a fresh page load and the key query returns nothing.
    toObservable(this.auth.initialized)
      .pipe(filter(Boolean), take(1))
      .subscribe(() => {
        void this.refreshLatestKey();
        void this.refreshPublishedModels();
        void this.refreshEncryptedDatasets();
      });

    this.route.queryParamMap.subscribe((params) => {
      const modelType = parseInferenceModelChoice(params.get('model'));
      const modelId = parseOptionalModelId(params.get('modelId'));
      const typeChanged = modelType !== this.selectedModelType();
      this.selectedModelType.set(modelType);
      this.selectedPublishedModelId.set(modelId);
      if (this.auth.initialized() && typeChanged) {
        void this.refreshPublishedModels();
        void this.refreshEncryptedDatasets();
      }
    });
  }

  async refreshEncryptedDatasets(): Promise<void> {
    this.loadingDatasets.set(true);
    this.datasetsError.set('');

    const { datasets, error } = await this.fheEncryptedDatasets.loadByModelType(
      this.selectedModelType(),
    );
    this.datasets.set(datasets);

    if (error) {
      this.datasetsError.set(`Could not load encrypted datasets: ${error}`);
    }

    this.loadingDatasets.set(false);
  }

  private async refreshPublishedModels(): Promise<void> {
    this.loadingModel.set(true);
    this.modelError.set('');
    const { models, error } = await this.modelSupabase.loadPublishedModelsByType(
      this.selectedModelType(),
    );
    this.publishedModels.set(models);

    if (error) {
      this.selectedPublishedModelId.set(null);
      this.modelError.set(`Could not load published models: ${error}`);
    } else if (models.length === 0) {
      this.selectedPublishedModelId.set(null);
      this.modelError.set(
        `No published ${this.modelTypeLabel()} model is available yet. Ask a model owner to publish one in Model Builder Studio.`,
      );
    } else {
      const preferredId = this.selectedPublishedModelId();
      const match = preferredId !== null ? models.find((m) => m.id === preferredId) : null;
      this.selectedPublishedModelId.set(match?.id ?? models[0].id);
      this.modelError.set('');
    }

    this.loadingModel.set(false);
  }

  private async refreshLatestKey(): Promise<void> {
    this.loadingKey.set(true);
    this.currentKey.set(await this.fheKeys.loadLatestKey());
    this.loadingKey.set(false);
  }

  formatCreated(iso: string): string {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  continueToModelOwner(): void {
    const modelId = this.publishedModel()?.id;
    this.router.navigate(['/model-owner-workspace'], {
      queryParams: {
        model: this.selectedModelType(),
        ...(modelId ? { modelId: String(modelId) } : {}),
      },
    });
  }

  openModelSelectModal(): void {
    this.showModelSelectModal.set(true);
  }

  closeModelSelectModal(): void {
    this.showModelSelectModal.set(false);
  }

  onModelSelectBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeModelSelectModal();
  }

  selectPublishedModel(model: SupabaseModel): void {
    this.selectedPublishedModelId.set(model.id);
    this.showModelSelectModal.set(false);
    this.encryptSuccess.set('');
  }

  downloadSampleData(): void {
    const model = this.publishedModel();
    if (!model) return;
    this.sampleDataDownload.downloadFromDocument(model.sample_data, model.model_name);
  }

  async encryptDataset(): Promise<void> {
    if (!this.canEncrypt() || this.encrypting()) return;

    const model = this.publishedModel();
    const file = this.selectedCsvFile();
    const key = this.currentKey();
    if (!model || !file || !key) return;

    this.encrypting.set(true);
    this.encryptError.set('');
    this.encryptSuccess.set('');

    try {
      const result = await this.fheEncrypt.encrypt(model.id, key.id, file);
      if (!result.ok) {
        this.encryptError.set(result.error);
        return;
      }

      this.encryptSuccess.set(`"${file.name}" encrypted successfully.`);
      await this.refreshEncryptedDatasets();
      this.selectedCsvFile.set(null);
    } finally {
      this.encrypting.set(false);
    }
  }

  openGenerateModal(): void {
    this.keyError.set('');
    this.editingKeyId.set(null);
    this.formName.set(this.suggestKeyName());
    this.formScheme.set('OpenFHE CKKS');
    this.formDepth.set(16);
    this.formSlots.set(8192);
    this.showKeyModal.set(true);
  }

  /**
   * Suggest a default key name so the user doesn't have to type one.
   * Increments the trailing number of the current key when present
   * (e.g. alice_key_01 -> alice_key_02), otherwise builds one from the username.
   */
  private suggestKeyName(): string {
    const current = this.currentKey()?.key_name;
    const match = current?.match(/^(.*?)(\d+)$/);
    if (match) {
      const [, prefix, digits] = match;
      const next = String(Number(digits) + 1).padStart(digits.length, '0');
      return `${prefix}${next}`;
    }

    const slug =
      (this.auth.displayName() || 'user')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'user';
    return `${slug}_key_01`;
  }

  openEditModal(): void {
    const key = this.currentKey();
    if (!key) return;
    this.keyError.set('');
    this.editingKeyId.set(key.id);
    this.formName.set(key.key_name);
    this.formScheme.set(key.scheme);
    this.formDepth.set(key.multiplicative_depth);
    this.formSlots.set(key.slots ?? 8192);
    this.showKeyModal.set(true);
  }

  closeKeyModal(): void {
    if (this.busy()) return;
    this.showKeyModal.set(false);
  }

  onModalBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeKeyModal();
  }

  isEditing(): boolean {
    return this.editingKeyId() !== null;
  }

  async saveKey(): Promise<void> {
    if (this.busy()) return;

    const name = this.formName().trim();
    if (!name) {
      this.keyError.set('Enter a key name.');
      return;
    }

    const editingId = this.editingKeyId();
    this.busy.set(true);
    this.keyError.set('');

    try {
      if (editingId !== null) {
        const updated = await this.fheKeys.updateKey(editingId, { key_name: name });
        if (!updated) {
          this.keyError.set('Could not rename the key. The name may already be in use.');
          return;
        }
        this.currentKey.set(updated);
        this.showKeyModal.set(false);
        return;
      }

      const depth = Number(this.formDepth());
      if (!Number.isInteger(depth) || depth <= 0) {
        this.keyError.set('Multiplicative depth must be a positive integer.');
        return;
      }

      const slots = Number(this.formSlots());
      if (!Number.isInteger(slots) || slots <= 0) {
        this.keyError.set('Number of slots must be a positive integer.');
        return;
      }

      const created = await this.fheKeys.generateKey({
        key_name: name,
        scheme: this.formScheme(),
        multiplicative_depth: depth,
        slots,
      });
      if (!created) {
        this.keyError.set('Key generation failed. Check the vault service and try again.');
        return;
      }
      this.currentKey.set(created);
      this.showKeyModal.set(false);
    } finally {
      this.busy.set(false);
    }
  }

  async openSelectModal(): Promise<void> {
    this.showSelectModal.set(true);
    this.loadingAllKeys.set(true);
    this.allKeys.set(await this.fheKeys.loadAllKeys());
    this.loadingAllKeys.set(false);
  }

  closeSelectModal(): void {
    if (this.busy()) return;
    this.showSelectModal.set(false);
  }

  onSelectBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeSelectModal();
  }

  async selectKey(key: FheKey): Promise<void> {
    if (this.busy()) return;
    if (key.id === this.currentKey()?.id) {
      this.showSelectModal.set(false);
      return;
    }

    this.busy.set(true);
    const active = await this.fheKeys.setActiveKey(key.id);
    this.busy.set(false);

    if (active) {
      this.currentKey.set(active);
      this.showSelectModal.set(false);
    }
  }

  async deleteKey(): Promise<void> {
    const key = this.currentKey();
    if (!key || this.busy()) return;
    if (!confirm(`Delete key "${key.key_name}"? This cannot be undone.`)) return;

    this.busy.set(true);
    const ok = await this.fheKeys.deleteKey(key.id);
    this.busy.set(false);
    if (ok) await this.refreshLatestKey();
  }

  browseFiles(): void {
    this.uploadError.set('');
    this.csvFileInput()?.nativeElement.click();
  }

  onCsvFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.acceptCsvFiles(input.files);
    input.value = '';
  }

  onUploadDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(true);
  }

  onUploadDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
  }

  onUploadDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
    this.uploadError.set('');
    this.acceptCsvFiles(event.dataTransfer?.files ?? null);
  }

  clearSelectedCsv(): void {
    this.selectedCsvFile.set(null);
    this.uploadError.set('');
    this.encryptSuccess.set('');
  }

  private acceptCsvFiles(files: FileList | null): void {
    if (!files?.length) return;

    if (files.length > 1) {
      this.uploadError.set('Please upload one CSV file at a time.');
      return;
    }

    const file = files[0];
    const error = validateCsvFile(file);
    if (error) {
      this.uploadError.set(error);
      return;
    }

    this.uploadError.set('');
    this.selectedCsvFile.set(file);
  }

  viewDataset(dataset: FheEncryptedDataset): void {
    this.viewingDataset.set(dataset);
  }

  closeDatasetModal(): void {
    this.viewingDataset.set(null);
  }

  onDatasetModalBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeDatasetModal();
  }

  formatStringList(values: string[] | null | undefined): string {
    if (!values?.length) return '—';
    return values.join(', ');
  }

  async deleteDataset(target: FheEncryptedDataset): Promise<void> {
    if (
      !confirm(`Delete encrypted dataset "${target.source_file_name}"? This cannot be undone.`)
    ) {
      return;
    }

    const ok = await this.fheEncryptedDatasets.deleteDataset(target.id);
    if (!ok) {
      this.datasetsError.set('Could not delete the dataset. Please try again.');
      return;
    }
    await this.refreshEncryptedDatasets();
  }

  signOut(): void {}
}
