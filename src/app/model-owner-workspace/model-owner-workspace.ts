import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, take } from 'rxjs';
import {
  ArrowRight,
  CircleCheck,
  Clock,
  CloudCog,
  Database,
  FileLock,
  KeyRound,
  ListChecks,
  LoaderCircle,
  Lock,
  LucideAngularModule,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-angular';
import {
  FheEncryptedDataset,
  FheEncryptedDatasetsService,
  InferenceJob,
} from '../data-owner-workspace/fhe-encrypted-datasets.service';
import { FheEncryptService } from '../data-owner-workspace/fhe-encrypt.service';
import { AppTopBar } from '../shared/app-top-bar/app-top-bar';
import { AuthService } from '../shared/auth.service';
import { WorkflowHeader } from '../shared/workflow-header/workflow-header';
import { InferenceModelChoice, parseInferenceModelChoice } from '../shared/workflow.types';

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const parseOptionalModelId = parsePositiveInt;

@Component({
  selector: 'app-model-owner-workspace',
  standalone: true,
  imports: [LucideAngularModule, DecimalPipe, AppTopBar, WorkflowHeader],
  templateUrl: './model-owner-workspace.html',
  styleUrl: './model-owner-workspace.css',
})
export class ModelOwnerWorkspace {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly fheEncryptedDatasets = inject(FheEncryptedDatasetsService);
  private readonly fheEncrypt = inject(FheEncryptService);

  readonly selectedModel = signal<InferenceModelChoice>(
    parseInferenceModelChoice(this.route.snapshot.queryParamMap.get('model')),
  );
  readonly selectedModelId = signal<number | null>(
    parseOptionalModelId(this.route.snapshot.queryParamMap.get('modelId')),
  );

  readonly datasets = signal<FheEncryptedDataset[]>([]);
  readonly loadingDatasets = signal(false);
  readonly datasetsError = signal('');

  readonly jobs = signal<InferenceJob[]>([]);
  readonly loadingJobs = signal(false);
  readonly jobsError = signal('');
  readonly selectedJobId = signal<number | null>(
    parsePositiveInt(this.route.snapshot.queryParamMap.get('encryptedDatasetId')),
  );

  readonly inferringDatasetId = signal<number | null>(null);
  readonly inferenceError = signal('');
  readonly inferenceSuccess = signal('');

  readonly ShieldCheckIcon = ShieldCheck;
  readonly ShieldAlertIcon = ShieldAlert;
  readonly FileLockIcon = FileLock;
  readonly CloudCogIcon = CloudCog;
  readonly LockIcon = Lock;
  readonly CircleCheckIcon = CircleCheck;
  readonly DatabaseIcon = Database;
  readonly ListChecksIcon = ListChecks;
  readonly ClockIcon = Clock;
  readonly LoaderIcon = LoaderCircle;
  readonly PlayIcon = Play;
  readonly RefreshCwIcon = RefreshCw;
  readonly KeyRoundIcon = KeyRound;
  readonly ArrowRightIcon = ArrowRight;

  constructor() {
    toObservable(this.auth.initialized)
      .pipe(filter(Boolean), take(1))
      .subscribe(() => void this.refreshWorkspace());

    this.route.queryParamMap.subscribe((params) => {
      const modelType = parseInferenceModelChoice(params.get('model'));
      const modelId = parseOptionalModelId(params.get('modelId'));
      const encryptedDatasetId = parsePositiveInt(params.get('encryptedDatasetId'));
      const changed =
        modelType !== this.selectedModel() || modelId !== this.selectedModelId();
      this.selectedModel.set(modelType);
      this.selectedModelId.set(modelId);
      this.syncSelectedJob(encryptedDatasetId);
      if (this.auth.initialized() && changed) {
        void this.refreshWorkspace();
      }
    });
  }

  async refreshWorkspace(): Promise<void> {
    await Promise.all([this.refreshIncomingDatasets(), this.refreshInferenceJobs()]);
  }

  async refreshIncomingDatasets(): Promise<void> {
    this.loadingDatasets.set(true);
    this.datasetsError.set('');

    const { datasets, error } = await this.fheEncryptedDatasets.loadAll();
    this.datasets.set(datasets);

    if (error) {
      this.datasetsError.set(`Could not load incoming datasets: ${error}`);
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

  formatCreated(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  submitterLabel(userId: string): string {
    return userId.slice(0, 8);
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
    if (!this.canDecrypt() || encryptedDatasetId === null) return;

    this.router.navigate(['/decrypt-result-workspace'], {
      queryParams: {
        model: this.selectedModel(),
        encryptedDatasetId: String(encryptedDatasetId),
        ...(this.selectedModelId() ? { modelId: String(this.selectedModelId()) } : {}),
      },
    });
  }

  signOut(): void {}
}
