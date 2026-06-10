import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, take } from 'rxjs';
import {
  buildAuditTrail,
  formatAuditTime,
  FheEncryptedDataset,
  FheEncryptedDatasetsService,
  FheEncryptedResult,
} from '../data-owner-workspace/fhe-encrypted-datasets.service';
import { FheEncryptService } from '../data-owner-workspace/fhe-encrypt.service';
import { AuthService } from '../shared/auth.service';
import {
  ArrowRight,
  Box,
  Check,
  CircleCheck,
  Database,
  Download,
  Info,
  LoaderCircle,
  Lock,
  LucideAngularModule,
  Monitor,
  RefreshCw,
  ShieldCheck,
  User,
} from 'lucide-angular';
import { AppTopBar } from '../shared/app-top-bar/app-top-bar';
import { WorkflowHeader } from '../shared/workflow-header/workflow-header';

function parseEncryptedDatasetId(value: string | null): number | null {
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

@Component({
  selector: 'app-decrypt-result-workspace',
  standalone: true,
  imports: [DecimalPipe, LucideAngularModule, AppTopBar, WorkflowHeader],
  templateUrl: './decrypt-result-workspace.html',
  styleUrl: './decrypt-result-workspace.css',
})
export class DecryptResultWorkspace {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly fheEncryptedDatasets = inject(FheEncryptedDatasetsService);
  private readonly fheEncrypt = inject(FheEncryptService);

  readonly encryptedDatasetId = signal<number | null>(
    parseEncryptedDatasetId(this.route.snapshot.queryParamMap.get('encryptedDatasetId')),
  );
  readonly dataset = signal<FheEncryptedDataset | null>(null);
  readonly inferenceResult = signal<FheEncryptedResult | null>(null);
  readonly loadingDataset = signal(false);
  readonly datasetError = signal('');

  readonly canDecrypt = computed(() => {
    const resultId = this.inferenceResult()?.result_id?.trim();
    return !!resultId && !this.decrypted() && !this.decrypting();
  });

  readonly decrypted = signal(false);
  readonly decryptedAt = signal<string | null>(null);
  readonly decryptedValues = signal<number[]>([]);
  readonly decrypting = signal(false);
  readonly decryptError = signal('');

  readonly auditTrail = computed(() =>
    buildAuditTrail(this.dataset(), this.decrypted(), this.decryptedAt()),
  );

  readonly previewValues = computed(() =>
    this.decryptedValues()
      .slice(0, 10)
      .map((value, index) => ({ index: index + 1, value })),
  );

  readonly totalValueCount = computed(() => this.decryptedValues().length);

  readonly ciphertextLines: string[] = [
    '0x9f3a7b6c2d8e4f11a98b3d7c0e1f2a6b9c...',
    '0x7a1b2c3d4e5f67890 1a2b3c4d5e6f7890...',
    '0x2d3c4b5a69788796a b1c2d3e4f5a6b7c8...',
    '0x6e1f2d3c4b5a69788 9a0b1c2d3e4f5a6b...',
  ];

  readonly LockIcon = Lock;
  readonly DatabaseIcon = Database;
  readonly CheckIcon = Check;
  readonly BoxIcon = Box;
  readonly ShieldCheckIcon = ShieldCheck;
  readonly CircleCheckIcon = CircleCheck;
  readonly RefreshCwIcon = RefreshCw;
  readonly InfoIcon = Info;
  readonly UserIcon = User;
  readonly MonitorIcon = Monitor;
  readonly ArrowRightIcon = ArrowRight;
  readonly DownloadIcon = Download;
  readonly LoaderIcon = LoaderCircle;

  constructor() {
    toObservable(this.auth.initialized)
      .pipe(filter(Boolean), take(1))
      .subscribe(() => void this.loadSelectedDataset());

    this.route.queryParamMap.subscribe((params) => {
      const id = parseEncryptedDatasetId(params.get('encryptedDatasetId'));
      if (id !== this.encryptedDatasetId()) {
        this.encryptedDatasetId.set(id);
        if (this.auth.initialized()) {
          void this.loadSelectedDataset();
        }
      }
    });
  }

  async loadSelectedDataset(): Promise<void> {
    const id = this.encryptedDatasetId();
    if (id === null) {
      this.dataset.set(null);
      this.inferenceResult.set(null);
      this.datasetError.set('No inference job selected. Choose a completed job in the data owner workspace.');
      return;
    }

    this.loadingDataset.set(true);
    this.datasetError.set('');

    const [{ dataset, error }, { result, error: resultError }] = await Promise.all([
      this.fheEncryptedDatasets.loadById(id),
      this.fheEncryptedDatasets.loadResultByDatasetId(id),
    ]);
    this.dataset.set(dataset);
    this.inferenceResult.set(result);

    this.decryptedValues.set([]);
    this.decryptError.set('');

    if (dataset?.decrypted_at) {
      this.decrypted.set(true);
      this.decryptedAt.set(dataset.decrypted_at);
    } else {
      this.decrypted.set(false);
      this.decryptedAt.set(null);
    }

    if (error) {
      this.datasetError.set(`Could not load encrypted dataset: ${error}`);
    } else if (!dataset) {
      this.datasetError.set('Inference job not found.');
    } else if (resultError) {
      this.datasetError.set(`Could not load inference result: ${resultError}`);
    } else if (!result?.result_id) {
      this.datasetError.set('No encrypted result record found for this job yet.');
    }

    this.loadingDataset.set(false);
  }

  async decrypt(): Promise<void> {
    if (!this.canDecrypt()) return;

    const resultId = this.inferenceResult()?.result_id?.trim();
    if (!resultId) {
      this.decryptError.set('No result id available for this job.');
      return;
    }

    this.decrypting.set(true);
    this.decryptError.set('');

    const result = await this.fheEncrypt.decryptResults(resultId);

    if (!result.ok) {
      this.decryptError.set(result.error);
      this.decrypting.set(false);
      return;
    }

    this.decryptedValues.set(result.data.decrypted_values ?? []);
    this.decryptedAt.set(new Date().toISOString());
    this.decrypted.set(true);
    this.decrypting.set(false);
  }

  formatDecryptedTime(): string {
    const iso = this.decryptedAt();
    return iso ? formatAuditTime(iso) : '—';
  }

  downloadResultsCsv(): void {
    const values = this.decryptedValues();
    if (!values.length) return;

    const csv = ['fhe_inference', ...values.map(String)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const resultId = this.inferenceResult()?.result_id?.trim() ?? 'result';

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fhe-inference-${resultId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  runAnother(): void {
    this.router.navigate(['/data-owner-workspace']);
  }

  signOut(): void {}
}
