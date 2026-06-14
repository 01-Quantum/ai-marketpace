import { DecimalPipe } from '@angular/common';
import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
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
import { parseSampleDataCsv } from '../model-builder-studio/sample-data.types';
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
  Upload,
  User,
} from 'lucide-angular';
import { AppTopBar } from '../shared/app-top-bar/app-top-bar';
import { WorkflowHeader } from '../shared/workflow-header/workflow-header';

function parseExpectedLabelsCsv(text: string): { labels: string[]; error?: string } {
  const rows = parseSampleDataCsv(text);
  if (!rows.length) {
    return {
      labels: [],
      error: 'CSV must include a header row, data rows, and an expected column.',
    };
  }

  const labels = rows.map((row) => row.expected);
  if (labels.every((label) => !label)) {
    return {
      labels: [],
      error: 'No expected column found. Include a column named "expected".',
    };
  }

  return { labels };
}

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
  readonly predictedLabels = signal<string[]>([]);
  readonly decrypting = signal(false);
  readonly decryptError = signal('');

  readonly uploadedExpectedLabels = signal<string[]>([]);
  readonly labelsFileName = signal('');
  readonly labelsUploadError = signal('');

  private readonly labelsFileInput = viewChild<ElementRef<HTMLInputElement>>('labelsFileInput');

  readonly auditTrail = computed(() =>
    buildAuditTrail(this.dataset(), this.decrypted(), this.decryptedAt()),
  );

  readonly hasUploadedLabels = computed(() => this.uploadedExpectedLabels().length > 0);
  readonly hasPredictedLabels = computed(() => this.predictedLabels().length > 0);

  readonly comparisonRows = computed(() => {
    const decrypted = this.decryptedValues();
    const predicted = this.predictedLabels();
    const expected = this.uploadedExpectedLabels();
    const showAllRows = this.hasUploadedLabels() || this.hasPredictedLabels();
    const rowCount = showAllRows
      ? Math.max(decrypted.length, predicted.length, expected.length)
      : Math.min(decrypted.length, 10);

    return Array.from({ length: rowCount }, (_, index) => ({
      index: index + 1,
      decrypted: decrypted[index] ?? null,
      predicted: predicted[index] ?? '',
      expected: expected[index] ?? '',
    }));
  });

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
  readonly UploadIcon = Upload;
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
    this.predictedLabels.set([]);
    this.decryptError.set('');
    this.uploadedExpectedLabels.set([]);
    this.labelsFileName.set('');
    this.labelsUploadError.set('');

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
    this.predictedLabels.set(result.data.predicted_labels ?? []);
    this.decryptedAt.set(new Date().toISOString());
    this.decrypted.set(true);
    this.decrypting.set(false);
  }

  formatDecryptedTime(): string {
    const iso = this.decryptedAt();
    return iso ? formatAuditTime(iso) : '—';
  }

  triggerLabelsUpload(): void {
    this.labelsFileInput()?.nativeElement.click();
  }

  onLabelsFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const { labels, error } = parseExpectedLabelsCsv(text);
      if (error) {
        this.labelsUploadError.set(error);
        this.uploadedExpectedLabels.set([]);
        this.labelsFileName.set('');
      } else {
        this.uploadedExpectedLabels.set(labels);
        this.labelsFileName.set(file.name);
        this.labelsUploadError.set('');
      }
      input.value = '';
    };
    reader.readAsText(file);
  }

  downloadResultsCsv(): void {
    const values = this.decryptedValues();
    if (!values.length) return;

    const predicted = this.predictedLabels();
    const expected = this.uploadedExpectedLabels();
    const headers = ['fhe_inference'];
    if (predicted.length) headers.push('predicted');
    if (expected.length) headers.push('expected');

    const rowCount = Math.max(values.length, predicted.length, expected.length);
    const lines = [headers.join(',')];
    for (let index = 0; index < rowCount; index++) {
      const cells: string[] = [values[index] != null ? String(values[index]) : ''];
      if (predicted.length) cells.push(predicted[index] ?? '');
      if (expected.length) cells.push(expected[index] ?? '');
      lines.push(cells.join(','));
    }

    const csv = lines.join('\n');
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
