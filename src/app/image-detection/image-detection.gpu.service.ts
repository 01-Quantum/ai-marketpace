import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { SupabaseModel } from '../model-builder-studio/model-supabase.service';
import { LibraryModel } from '../model-builder-studio/model-builder.types';
import {
  FheEncryptedDataset,
  InferenceJob,
} from '../data-owner-workspace/fhe-encrypted-datasets.service';
import {
  CIFAR10_CLASSES,
  IMAGE_DETECTION_GPU_LIBRARY_ID,
  IMAGE_DETECTION_GPU_MODEL_ID,
  IMAGE_DETECTION_GPU_MODEL_NAME,
  ImageDetectionPrediction,
} from './image-detection.mock';

export interface GpuImageJob {
  id: number;
  fileName: string;
  previewUrl: string;
  createdAt: string;
  prediction: ImageDetectionPrediction | null;
  submittedAt: string | null;
  decryptedAt: string | null;
  encryptedDir: string | null;
  resultDir: string | null;
}

interface EncryptResponse {
  encrypted_dir: string;
}

interface InferResponse {
  result_dir: string;
  inference_ms?: number;
}

interface DecryptBody {
  class_id: number;
  class_name: string;
  logits: number[];
}

interface DecryptResponse {
  result: DecryptBody;
}

@Injectable({ providedIn: 'root' })
export class ImageDetectionGpuService {
  private nextId = 92001;
  private readonly jobsSignal = signal<GpuImageJob[]>([]);

  readonly jobs = this.jobsSignal.asReadonly();

  publishedModel(): SupabaseModel {
    const now = '2026-09-25T14:00:00.000Z';
    return {
      id: IMAGE_DETECTION_GPU_MODEL_ID,
      user_id: 'gpu-enclave',
      model_type: 'image',
      model_name: IMAGE_DETECTION_GPU_MODEL_NAME,
      model_json: null,
      sample_data: null,
      params_count: 16,
      published: true,
      created_at: now,
      updated_at: now,
    };
  }

  libraryModel(): LibraryModel {
    return {
      id: IMAGE_DETECTION_GPU_LIBRARY_ID,
      name: IMAGE_DETECTION_GPU_MODEL_NAME,
      version: 'v1.0.0',
      updated: 'GPU',
      iconKind: 'image',
      type: 'image',
      isSaved: true,
      published: true,
    };
  }

  isGpuJob(id: number): boolean {
    return this.jobsSignal().some((job) => job.id === id);
  }

  getJob(id: number): GpuImageJob | null {
    return this.jobsSignal().find((job) => job.id === id) ?? null;
  }

  pendingDatasets(): FheEncryptedDataset[] {
    return this.jobsSignal()
      .filter((job) => !job.submittedAt)
      .map((job) => this.toDataset(job));
  }

  inferenceJobs(): InferenceJob[] {
    return this.jobsSignal()
      .filter((job) => job.submittedAt)
      .map((job) => ({
        id: job.id,
        jobId: job.resultDir?.split('/').pop() || `gpu${job.id.toString(16)}`,
        dataset: job.fileName,
        model: IMAGE_DETECTION_GPU_MODEL_NAME,
        status: 'inference_complete' as const,
        startedAt: job.submittedAt,
        completedAt: job.submittedAt,
      }));
  }

  toDataset(job: GpuImageJob): FheEncryptedDataset {
    return {
      id: job.id,
      user_id: 'gpu',
      encrypt_id: job.encryptedDir?.split('/').pop() || `gpu${job.id.toString(16)}`,
      encrypt_path: job.encryptedDir ?? '',
      source_file_name: job.fileName,
      model_id: IMAGE_DETECTION_GPU_MODEL_ID,
      model_name: IMAGE_DETECTION_GPU_MODEL_NAME,
      model_type: 'image',
      fhe_key_id: 0,
      fhe_key_storage_path: '',
      slots: 4096,
      params_count: 16,
      rows_per_ciphertext: 1,
      total_rows: 1,
      ciphertext_count: 1,
      removed_columns: [],
      columns: ['r', 'g', 'b'],
      ciphertext_files: ['ct_000.bin'],
      manifest_json: {},
      status: job.submittedAt ? 'inference_complete' : 'encrypted',
      submitted_at: job.submittedAt,
      decrypted_at: job.decryptedAt,
      created_at: job.createdAt,
      updated_at: job.decryptedAt ?? job.createdAt,
    };
  }

  /** Encrypt on the GPU pod. The image stays pending until runInference. */
  async encryptImage(file: File): Promise<GpuImageJob> {
    const body = new FormData();
    body.append('file', file, file.name);
    body.append('filename', file.name);

    const json = await postForm<EncryptResponse>('/v1/encrypt', body);
    const previewUrl = await readPreview(file);
    const job: GpuImageJob = {
      id: this.nextId++,
      fileName: file.name,
      previewUrl,
      createdAt: new Date().toISOString(),
      prediction: null,
      submittedAt: null,
      decryptedAt: null,
      encryptedDir: json.encrypted_dir,
      resultDir: null,
    };
    this.jobsSignal.update((jobs) => [job, ...jobs]);
    return job;
  }

  async runInference(id: number): Promise<boolean> {
    const job = this.getJob(id);
    if (!job || job.submittedAt) return false;
    if (!job.encryptedDir) throw new Error('This image has no encrypted directory.');

    const json = await postJson<InferResponse>('/v1/infer', {
      encrypted_dir: job.encryptedDir,
    });
    const submittedAt = new Date().toISOString();
    this.jobsSignal.update((jobs) =>
      jobs.map((entry) =>
        entry.id === id ? { ...entry, submittedAt, resultDir: json.result_dir } : entry,
      ),
    );
    return true;
  }

  delete(id: number): void {
    this.jobsSignal.update((jobs) => jobs.filter((entry) => entry.id !== id));
  }

  async decrypt(id: number): Promise<ImageDetectionPrediction | null> {
    const job = this.getJob(id);
    if (!job?.resultDir) return null;

    const json = await postJson<DecryptResponse>('/v1/decrypt', {
      result_dir: job.resultDir,
    });
    const prediction = predictionFromDecrypt(json.result);
    const decryptedAt = new Date().toISOString();
    this.jobsSignal.update((jobs) =>
      jobs.map((entry) => (entry.id === id ? { ...entry, decryptedAt, prediction } : entry)),
    );
    return prediction;
  }
}

function predictionFromDecrypt(result: DecryptBody): ImageDetectionPrediction {
  const raw = Array.isArray(result.logits) ? result.logits : [];
  const scores = softmax(raw);
  const logits = scores
    .map((score, id) => ({
      id,
      name: CIFAR10_CLASSES[id] ?? `class ${id}`,
      score,
    }))
    .sort((a, b) => b.score - a.score);

  return {
    classId: result.class_id,
    className: result.class_name,
    logits,
  };
}

function softmax(values: number[]): number[] {
  if (!values.length) return [];
  const max = Math.max(...values);
  const exps = values.map((value) => Math.exp(value - max));
  const sum = exps.reduce((total, value) => total + value, 0) || 1;
  return exps.map((value) => value / sum);
}

function apiUrl(path: string): string {
  const base = environment.imageApiBaseUrl.replace(/\/$/, '');
  return `${base}${path}`;
}

async function postForm<T>(path: string, body: FormData): Promise<T> {
  const res = await fetch(apiUrl(path), { method: 'POST', body });
  return readJson<T>(res);
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return readJson<T>(res);
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  if (!res.ok) {
    const message =
      parsed && typeof parsed === 'object' && 'error' in parsed && typeof parsed.error === 'string'
        ? parsed.error
        : text || `Image API request failed (${res.status}).`;
    throw new Error(message);
  }
  return parsed as T;
}

function readPreview(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}
