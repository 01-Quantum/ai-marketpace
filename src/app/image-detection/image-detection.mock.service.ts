import { Injectable, signal } from '@angular/core';
import { SupabaseModel } from '../model-builder-studio/model-supabase.service';
import { LibraryModel } from '../model-builder-studio/model-builder.types';
import {
  FheEncryptedDataset,
  InferenceJob,
} from '../data-owner-workspace/fhe-encrypted-datasets.service';
import {
  IMAGE_DETECTION_MOCK_LIBRARY_ID,
  IMAGE_DETECTION_MODEL_ID,
  IMAGE_DETECTION_MODEL_NAME,
  ImageDetectionPrediction,
  mockPredictionForFile,
} from './image-detection.mock';

export interface MockImageJob {
  id: number;
  fileName: string;
  previewUrl: string;
  createdAt: string;
  prediction: ImageDetectionPrediction;
  /** Set when the data owner runs inference. Until then the image stays in Encrypted Datasets. */
  submittedAt: string | null;
  decryptedAt: string | null;
}

const LIBRARY_ID = IMAGE_DETECTION_MOCK_LIBRARY_ID;

function catSampleUrl(): string {
  return new URL('cat-sample.png', document.baseURI).href;
}

@Injectable({ providedIn: 'root' })
export class ImageDetectionMockService {
  private nextId = 91002;
  private readonly jobsSignal = signal<MockImageJob[]>([this.seedJob()]);

  readonly jobs = this.jobsSignal.asReadonly();

  publishedModel(): SupabaseModel {
    const now = '2026-06-14T22:36:00.000Z';
    return {
      id: IMAGE_DETECTION_MODEL_ID,
      user_id: 'mock-enclave',
      model_type: 'image',
      model_name: IMAGE_DETECTION_MODEL_NAME,
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
      id: LIBRARY_ID,
      name: IMAGE_DETECTION_MODEL_NAME,
      version: 'v1.0.0',
      updated: 'Published',
      iconKind: 'image',
      type: 'image',
      isSaved: true,
      published: true,
    };
  }

  isMockJob(id: number): boolean {
    return this.jobsSignal().some((job) => job.id === id);
  }

  getJob(id: number): MockImageJob | null {
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
        jobId: `e4e${job.id.toString(16)}`,
        dataset: job.fileName,
        model: IMAGE_DETECTION_MODEL_NAME,
        status: 'inference_complete' as const,
        startedAt: job.submittedAt,
        completedAt: job.submittedAt,
      }));
  }

  toDataset(job: MockImageJob): FheEncryptedDataset {
    return {
      id: job.id,
      user_id: 'mock',
      encrypt_id: `e4e${job.id.toString(16)}`,
      encrypt_path: `mock://encrypted-images/${job.fileName}`,
      source_file_name: job.fileName,
      model_id: IMAGE_DETECTION_MODEL_ID,
      model_name: IMAGE_DETECTION_MODEL_NAME,
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

  /** Pretend to encrypt locally. The image stays pending until runInference. */
  async encryptImage(file: File): Promise<MockImageJob> {
    await delay(700);
    const previewUrl = await readPreview(file);
    const job: MockImageJob = {
      id: this.nextId++,
      fileName: file.name,
      previewUrl,
      createdAt: new Date().toISOString(),
      prediction: mockPredictionForFile(file.name),
      submittedAt: null,
      decryptedAt: null,
    };
    this.jobsSignal.update((jobs) => [job, ...jobs]);
    return job;
  }

  async runInference(id: number): Promise<boolean> {
    const job = this.getJob(id);
    if (!job || job.submittedAt) return false;
    await delay(700);
    const submittedAt = new Date().toISOString();
    this.jobsSignal.update((jobs) =>
      jobs.map((entry) => (entry.id === id ? { ...entry, submittedAt } : entry)),
    );
    return true;
  }

  delete(id: number): void {
    this.jobsSignal.update((jobs) => jobs.filter((entry) => entry.id !== id));
  }

  async decrypt(id: number): Promise<ImageDetectionPrediction | null> {
    const job = this.getJob(id);
    if (!job) return null;
    await delay(500);
    const decryptedAt = new Date().toISOString();
    this.jobsSignal.update((jobs) =>
      jobs.map((entry) => (entry.id === id ? { ...entry, decryptedAt } : entry)),
    );
    return job.prediction;
  }

  downloadSampleImage(): void {
    const link = document.createElement('a');
    link.href = catSampleUrl();
    link.download = 'cat.png';
    link.click();
  }

  private seedJob(): MockImageJob {
    return {
      id: 91001,
      fileName: 'cat.png',
      previewUrl: catSampleUrl(),
      createdAt: '2026-06-18T14:47:00.000Z',
      prediction: mockPredictionForFile('cat.png'),
      submittedAt: '2026-06-18T14:47:00.000Z',
      decryptedAt: null,
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readPreview(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : catSampleUrl());
    reader.onerror = () => resolve(catSampleUrl());
    reader.readAsDataURL(file);
  });
}
