import { Injectable, inject, signal } from '@angular/core';
import { SupabaseModel } from '../model-builder-studio/model-supabase.service';
import { LibraryModel } from '../model-builder-studio/model-builder.types';
import {
  FheEncryptedDataset,
  InferenceJob,
} from '../data-owner-workspace/fhe-encrypted-datasets.service';
import { FheImageJobRow, FheImageJobsService } from './fhe-image-jobs.service';
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
  private readonly imageJobs = inject(FheImageJobsService);
  private readonly jobsSignal = signal<MockImageJob[]>([]);

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

  /** Load this user's mock image jobs from Supabase. */
  async loadFromSupabase(): Promise<string | null> {
    const { rows, error } = await this.imageJobs.list('mock');
    if (error) return error;
    this.jobsSignal.set(rows.map((row) => rowToMockJob(row)));
    return null;
  }

  /** Pretend to encrypt locally. The image stays pending until runInference. */
  async encryptImage(file: File): Promise<MockImageJob> {
    await delay(700);
    const previewUrl = await readPreview(file);
    const prediction = mockPredictionForFile(file.name);
    const row = await this.imageJobs.insert({
      file_name: file.name,
      source: 'mock',
      model_name: IMAGE_DETECTION_MODEL_NAME,
      prediction,
    });
    const job = rowToMockJob(row, previewUrl);
    this.jobsSignal.update((jobs) => [job, ...jobs.filter((entry) => entry.id !== job.id)]);
    return job;
  }

  async runInference(id: number): Promise<boolean> {
    const job = this.getJob(id);
    if (!job || job.submittedAt) return false;
    await delay(700);
    const submittedAt = new Date().toISOString();
    await this.imageJobs.update(id, { submitted_at: submittedAt });
    this.jobsSignal.update((jobs) => jobs.map((entry) => (entry.id === id ? { ...entry, submittedAt } : entry)));
    return true;
  }

  async delete(id: number): Promise<void> {
    await this.imageJobs.remove(id);
    this.jobsSignal.update((jobs) => jobs.filter((entry) => entry.id !== id));
  }

  async decrypt(id: number): Promise<ImageDetectionPrediction | null> {
    const job = this.getJob(id);
    if (!job) return null;
    await delay(500);
    const decryptedAt = new Date().toISOString();
    await this.imageJobs.update(id, { decrypted_at: decryptedAt });
    this.jobsSignal.update((jobs) => jobs.map((entry) => (entry.id === id ? { ...entry, decryptedAt } : entry)));
    return job.prediction;
  }

  downloadSampleImage(): void {
    const link = document.createElement('a');
    link.href = catSampleUrl();
    link.download = 'cat.png';
    link.click();
  }
}

function rowToMockJob(row: FheImageJobRow, previewUrl = ''): MockImageJob {
  return {
    id: row.id,
    fileName: row.file_name,
    previewUrl: previewUrl || (row.file_name.toLowerCase().startsWith('cat.') ? catSampleUrl() : ''),
    createdAt: row.created_at,
    prediction: row.prediction ?? mockPredictionForFile(row.file_name),
    submittedAt: row.submitted_at,
    decryptedAt: row.decrypted_at,
  };
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
