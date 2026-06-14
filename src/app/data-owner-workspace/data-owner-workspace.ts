import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { distinctUntilChanged, filter, map, skip, take } from 'rxjs';
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
  ListChecks,
  LoaderCircle,
  Lock,
  LucideAngularModule,
  Network,
  Pencil,
  Play,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TriangleAlert,
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
  WorkflowStep,
} from '../shared/workflow.types';
import {
  ModelSupabaseService,
  SupabaseModel,
} from '../model-builder-studio/model-supabase.service';
import {
  FheEncryptedDataset,
  FheEncryptedDatasetsService,
  InferenceJob,
} from './fhe-encrypted-datasets.service';
import { FheKey, FheKeysService } from './fhe-keys.service';
import { FheEncryptService } from './fhe-encrypt.service';
import { formatFileSize, validateCsvFile } from './csv-upload';

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const parseOptionalModelId = parsePositiveInt;

function parseWorkflowStep(value: string | null): WorkflowStep {
  if (value === '1' || value === '2' || value === '3') {
    return Number(value) as WorkflowStep;
  }
  return 2;
}

const DEFAULT_KEY_SLOTS = 8192;
/**
 * Minimum multiplicative depth supported by the FHE vault. The vault bumps any
 * lower value to this so a single key works for both logistic and decision-tree
 * models (trees need depth >= 9 for ApproxComp + the tree evaluator). Keys
 * created below this lack the depth/precision/rotation keys trees require.
 */
const MIN_KEY_DEPTH = 9;

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
  readonly auth = inject(AuthService);
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

  readonly minKeyDepth = MIN_KEY_DEPTH;

  /**
   * True when the active key predates tree support (depth < MIN_KEY_DEPTH) and
   * therefore lacks the depth/precision/rotation keys decision-tree models need.
   * Such a key still works for logistic models but must be regenerated for trees.
   */
  readonly keyNeedsTreeUpgrade = computed(() => {
    const key = this.currentKey();
    return !!key && key.multiplicative_depth < MIN_KEY_DEPTH;
  });

  readonly showKeyModal = signal(false);
  readonly editingKeyId = signal<number | null>(null);
  readonly formName = signal('');
  readonly formScheme = signal('OpenFHE CKKS');
  readonly formDepth = signal(16);

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

  readonly workflowStep = signal<WorkflowStep>(
    parseWorkflowStep(this.route.snapshot.queryParamMap.get('step')),
  );

  readonly datasets = signal<FheEncryptedDataset[]>([]);
  readonly loadingDatasets = signal(false);
  readonly datasetsError = signal('');
  readonly viewingDataset = signal<FheEncryptedDataset | null>(null);

  readonly jobs = signal<InferenceJob[]>([]);
  readonly loadingJobs = signal(false);
  readonly jobsError = signal('');
  readonly selectedJobId = signal<number | null>(
    parsePositiveInt(this.route.snapshot.queryParamMap.get('encryptedDatasetId')),
  );
  readonly inferringDatasetId = signal<number | null>(null);
  readonly deletingResultJobId = signal<number | null>(null);
  readonly inferenceError = signal('');
  readonly inferenceSuccess = signal('');
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
  readonly TriangleAlertIcon = TriangleAlert;
  readonly PencilIcon = Pencil;
  readonly ListIcon = List;
  readonly DownloadIcon = Download;
  readonly LoaderIcon = LoaderCircle;
  readonly RefreshCwIcon = RefreshCw;
  readonly CloseIcon = X;
  readonly UserIcon = User;
  readonly ListChecksIcon = ListChecks;
  readonly PlayIcon = Play;

  constructor() {
    // Wait until AuthService has restored the session before querying, otherwise
    // user()?.id is still null on a fresh page load and the key query returns nothing.
    toObservable(this.auth.initialized)
      .pipe(filter(Boolean), take(1))
      .subscribe(() => {
        void this.refreshLatestKey();
        void this.refreshPublishedModels();
        void this.refreshWorkspace();
      });

    toObservable(this.auth.user)
      .pipe(
        skip(1),
        map((user) => user?.id ?? null),
        distinctUntilChanged(),
        filter(() => this.auth.initialized()),
      )
      .subscribe(() => {
        void this.refreshLatestKey();
        void this.refreshWorkspace();
      });

    this.route.queryParamMap.subscribe((params) => {
      const modelType = parseInferenceModelChoice(params.get('model'));
      const modelId = parseOptionalModelId(params.get('modelId'));
      const encryptedDatasetId = parsePositiveInt(params.get('encryptedDatasetId'));
      const typeChanged = modelType !== this.selectedModelType();
      this.selectedModelType.set(modelType);
      this.selectedPublishedModelId.set(modelId);
      this.workflowStep.set(parseWorkflowStep(params.get('step')));
      this.syncSelectedJob(encryptedDatasetId);
      if (this.auth.initialized() && typeChanged) {
        void this.refreshPublishedModels();
      }
    });
  }

  async refreshWorkspace(): Promise<void> {
    await Promise.all([this.refreshEncryptedDatasets(), this.refreshInferenceJobs()]);
  }

  async refreshEncryptedDatasets(): Promise<void> {
    this.loadingDatasets.set(true);
    this.datasetsError.set('');

    const { datasets, error } = await this.fheEncryptedDatasets.loadAll();
    this.datasets.set(datasets);

    if (error) {
      this.datasetsError.set(`Could not load encrypted datasets: ${error}`);
    }

    this.loadingDatasets.set(false);
  }

  async refreshInferenceJobs(): Promise<void> {
    this.loadingJobs.set(true);
    this.jobsError.set('');

    const { jobs, error } = await this.fheEncryptedDatasets.loadSubmittedJobs();
    this.jobs.set(jobs);
    this.syncSelectedJob(this.selectedJobId());

    if (error) {
      this.jobsError.set(`Could not load inference jobs: ${error}`);
    }

    this.loadingJobs.set(false);
  }

  isJobSelectable(job: InferenceJob): boolean {
    return job.status === 'inference_complete';
  }

  selectJob(job: InferenceJob): void {
    if (!this.isJobSelectable(job)) return;

    this.selectedJobId.set(job.id);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { encryptedDatasetId: String(job.id) },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  canDecrypt(): boolean {
    const id = this.selectedJobId();
    if (id === null) return false;
    return this.jobs().some((job) => job.id === id && this.isJobSelectable(job));
  }

  private syncSelectedJob(candidateId: number | null): void {
    const jobs = this.jobs();
    const validId =
      candidateId !== null &&
      jobs.some((job) => job.id === candidateId && this.isJobSelectable(job))
        ? candidateId
        : null;

    if (this.selectedJobId() !== validId) {
      this.selectedJobId.set(validId);
    }

    if (candidateId !== null && validId === null) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { encryptedDatasetId: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
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
        `No published ${this.modelTypeLabel()} model available yet. Publish one in Model Builder Studio, or ask another model owner to share one with you.`,
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

  formatJobDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  truncateJobId(id: string, max = 12): string {
    if (id.length <= max) return id;
    return `${id.slice(0, max)}…`;
  }

  async runInference(dataset: FheEncryptedDataset): Promise<void> {
    if (this.inferringDatasetId() !== null) return;

    this.inferringDatasetId.set(dataset.id);
    this.inferenceError.set('');
    this.inferenceSuccess.set('');

    const result = await this.fheEncrypt.runInference(dataset.id);

    if (!result.ok) {
      this.inferenceError.set(result.error);
    } else {
      this.inferenceSuccess.set(
        `Encrypted inference started for "${dataset.source_file_name}".`,
      );
      await this.refreshWorkspace();
    }

    this.inferringDatasetId.set(null);
  }

  isInferring(dataset: FheEncryptedDataset): boolean {
    return this.inferringDatasetId() === dataset.id;
  }

  continueToDecrypt(): void {
    const encryptedDatasetId = this.selectedJobId();
    const modelId = this.publishedModel()?.id;
    if (!this.canDecrypt() || encryptedDatasetId === null) return;

    this.router.navigate(['/decrypt-result-workspace'], {
      queryParams: {
        model: this.selectedModelType(),
        encryptedDatasetId: String(encryptedDatasetId),
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
      await this.refreshWorkspace();
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
      if (!Number.isInteger(depth) || depth < MIN_KEY_DEPTH) {
        this.keyError.set(
          `Multiplicative depth must be an integer of at least ${MIN_KEY_DEPTH} ` +
            `(required for decision-tree support).`,
        );
        return;
      }

      const created = await this.fheKeys.generateKey({
        key_name: name,
        scheme: this.formScheme(),
        multiplicative_depth: depth,
        slots: DEFAULT_KEY_SLOTS,
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

    const result = await this.fheEncrypt.deleteDataset(target.id);
    if (!result.ok) {
      this.datasetsError.set(result.error);
      return;
    }
    await this.refreshWorkspace();
  }

  isDeletingResult(job: InferenceJob): boolean {
    return this.deletingResultJobId() === job.id;
  }

  async deleteJobResult(job: InferenceJob): Promise<void> {
    if (job.status !== 'inference_complete') return;
    if (
      !confirm(`Delete encrypted result for "${job.dataset}"? This cannot be undone.`)
    ) {
      return;
    }

    this.deletingResultJobId.set(job.id);
    this.jobsError.set('');

    const deleteResult = await this.fheEncrypt.deleteResult(job.id);
    this.deletingResultJobId.set(null);

    if (!deleteResult.ok) {
      this.jobsError.set(deleteResult.error);
      return;
    }

    if (this.selectedJobId() === job.id) {
      this.selectedJobId.set(null);
    }
    await this.refreshWorkspace();
  }

  signOut(): void {}
}
