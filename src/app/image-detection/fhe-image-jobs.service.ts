import { Injectable, inject } from '@angular/core';
import { AuthService } from '../shared/auth.service';
import { FheEncryptedDataset } from '../data-owner-workspace/fhe-encrypted-datasets.service';
import {
  IMAGE_DETECTION_GPU_MODEL_ID,
  IMAGE_DETECTION_GPU_MODEL_NAME,
  IMAGE_DETECTION_MODEL_ID,
  IMAGE_DETECTION_MODEL_NAME,
  ImageDetectionPrediction,
} from './image-detection.mock';

export type ImageJobSource = 'mock' | 'gpu';

export interface FheImageJobRow {
  id: number;
  user_id: string;
  file_name: string;
  source: ImageJobSource;
  model_name: string;
  encrypted_dir: string | null;
  result_dir: string | null;
  prediction: ImageDetectionPrediction | null;
  submitted_at: string | null;
  decrypted_at: string | null;
  created_at: string;
}

export interface NewImageJob {
  file_name: string;
  source: ImageJobSource;
  model_name: string;
  encrypted_dir?: string | null;
  result_dir?: string | null;
  prediction?: ImageDetectionPrediction | null;
  submitted_at?: string | null;
  decrypted_at?: string | null;
}

interface ImageManifest {
  image_source?: ImageJobSource;
  encrypted_dir?: string | null;
  result_dir?: string | null;
  prediction?: ImageDetectionPrediction | null;
  decrypted_at?: string | null;
}

interface StoredResult {
  id: number;
  result_id: string;
  result_path: string;
  encrypted_dataset_id: number;
  status: string;
  manifest_json: unknown;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class FheImageJobsService {
  private readonly auth = inject(AuthService);
  private get db() {
    return this.auth.client;
  }

  async list(source: ImageJobSource): Promise<{ rows: FheImageJobRow[]; error: string | null }> {
    const userId = this.auth.user()?.id;
    if (!userId) return { rows: [], error: 'Not signed in.' };

    const modelId = source === 'mock' ? IMAGE_DETECTION_MODEL_ID : IMAGE_DETECTION_GPU_MODEL_ID;
    const { data, error } = await this.db
      .from('fhe_encrypted_datasets')
      .select('*')
      .eq('user_id', userId)
      .eq('model_type', 'image')
      .eq('model_id', modelId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('fhe_encrypted_datasets image list error', error.message);
      return { rows: [], error: imageTableError(error.message) };
    }

    const datasets = (data ?? []) as FheEncryptedDataset[];
    const results = await this.resultsFor(datasets.map((dataset) => dataset.id), userId);
    return {
      rows: datasets.map((dataset) => toImageJob(dataset, results.get(dataset.id) ?? null)),
      error: null,
    };
  }

  async insert(input: NewImageJob): Promise<FheImageJobRow> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Not signed in.');
    const key = await this.requireKey(userId);
    const model = modelFor(input.source);
    const manifest = manifestFrom(input);

    const { data, error } = await this.db
      .from('fhe_encrypted_datasets')
      .insert({
        user_id: userId,
        encrypt_id: `img-${input.source}-${crypto.randomUUID()}`,
        encrypt_path: input.encrypted_dir || `mock://encrypted-images/${input.file_name}`,
        source_file_name: input.file_name,
        model_id: model.id,
        model_name: input.model_name || model.name,
        model_type: 'image',
        fhe_key_id: key.id,
        fhe_key_storage_path: key.path,
        slots: 4096,
        params_count: 16,
        rows_per_ciphertext: 1,
        total_rows: 1,
        ciphertext_count: 1,
        removed_columns: [],
        columns: ['r', 'g', 'b'],
        ciphertext_files: ['ct_000.bin'],
        manifest_json: manifest,
        status: input.submitted_at ? 'inference_complete' : 'encrypted',
        submitted_at: input.submitted_at ?? null,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(imageTableError(error?.message ?? 'Could not save the image job.'));
    }

    const dataset = data as FheEncryptedDataset;
    if (input.result_dir) {
      await this.insertResult(dataset, input.result_dir, manifest, input.decrypted_at ? 'decrypted' : 'completed');
    }
    return toImageJob(dataset, null);
  }

  async update(id: number, patch: Partial<NewImageJob>): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Not signed in.');

    const dataset = await this.loadOwnDataset(id, userId);
    const manifest = { ...asManifest(dataset.manifest_json), ...manifestFrom(patch) };
    const submittedAt = patch.submitted_at ?? dataset.submitted_at;

    const { error } = await this.db
      .from('fhe_encrypted_datasets')
      .update({
        manifest_json: manifest,
        submitted_at: submittedAt,
        status: submittedAt ? 'inference_complete' : dataset.status,
        encrypt_path: patch.encrypted_dir || dataset.encrypt_path,
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw new Error(imageTableError(error.message));

    if (patch.result_dir) {
      await this.insertResult(
        { ...dataset, manifest_json: manifest },
        patch.result_dir,
        manifest,
        patch.decrypted_at ? 'decrypted' : 'completed',
      );
    } else if (patch.decrypted_at || patch.prediction) {
      const { error: resultError } = await this.db
        .from('fhe_encrypted_results')
        .update({
          status: patch.decrypted_at ? 'decrypted' : 'completed',
          manifest_json: manifest,
        })
        .eq('encrypted_dataset_id', id)
        .eq('user_id', userId);
      if (resultError) throw new Error(imageTableError(resultError.message));
    }
  }

  async remove(id: number): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Not signed in.');

    const { error: resultError } = await this.db
      .from('fhe_encrypted_results')
      .delete()
      .eq('encrypted_dataset_id', id)
      .eq('user_id', userId);
    if (resultError) throw new Error(imageTableError(resultError.message));

    const { error } = await this.db
      .from('fhe_encrypted_datasets')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .eq('model_type', 'image');
    if (error) throw new Error(imageTableError(error.message));
  }

  private async requireKey(userId: string): Promise<{ id: number; path: string }> {
    const { data, error } = await this.db
      .from('fhe_keys')
      .select('id, public_key_storage_path')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data?.id) {
      throw new Error('Generate a key pair first. Image jobs are stored with your FHE key.');
    }
    return { id: data.id as number, path: (data.public_key_storage_path as string | null) ?? '' };
  }

  private async loadOwnDataset(id: number, userId: string): Promise<FheEncryptedDataset> {
    const { data, error } = await this.db
      .from('fhe_encrypted_datasets')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .eq('model_type', 'image')
      .maybeSingle();
    if (error || !data) throw new Error(imageTableError(error?.message ?? 'Image job not found.'));
    return data as FheEncryptedDataset;
  }

  private async resultsFor(ids: number[], userId: string): Promise<Map<number, StoredResult>> {
    const byDataset = new Map<number, StoredResult>();
    if (!ids.length) return byDataset;

    const { data, error } = await this.db
      .from('fhe_encrypted_results')
      .select('id, result_id, result_path, encrypted_dataset_id, status, manifest_json, updated_at')
      .eq('user_id', userId)
      .in('encrypted_dataset_id', ids)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('fhe_encrypted_results image list error', error.message);
      return byDataset;
    }

    for (const row of (data ?? []) as StoredResult[]) {
      if (!byDataset.has(row.encrypted_dataset_id)) byDataset.set(row.encrypted_dataset_id, row);
    }
    return byDataset;
  }

  private async insertResult(
    dataset: FheEncryptedDataset,
    resultDir: string,
    manifest: ImageManifest,
    status: 'completed' | 'decrypted',
  ): Promise<void> {
    const userId = dataset.user_id;
    const { data: existing, error: existingError } = await this.db
      .from('fhe_encrypted_results')
      .select('id')
      .eq('encrypted_dataset_id', dataset.id)
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (existingError) throw new Error(imageTableError(existingError.message));

    if (existing?.id) {
      const { error } = await this.db
        .from('fhe_encrypted_results')
        .update({ result_path: resultDir, status, manifest_json: manifest })
        .eq('id', existing.id)
        .eq('user_id', userId);
      if (error) throw new Error(imageTableError(error.message));
      return;
    }

    const { error } = await this.db.from('fhe_encrypted_results').insert({
      user_id: userId,
      result_id: `img-result-${dataset.id}-${crypto.randomUUID()}`,
      result_path: resultDir,
      encrypted_dataset_id: dataset.id,
      encrypt_id: dataset.encrypt_id,
      dataset_model_id: dataset.model_id,
      dataset_model_name: dataset.model_name,
      dataset_model_type: 'image',
      model_id: dataset.model_id,
      model_name: dataset.model_name,
      model_type: 'image',
      fhe_key_id: dataset.fhe_key_id,
      fhe_key_storage_path: dataset.fhe_key_storage_path,
      operation: 'image_inference',
      slots: dataset.slots,
      params_count: dataset.params_count,
      rows_per_ciphertext: dataset.rows_per_ciphertext,
      total_rows: dataset.total_rows,
      ciphertext_count: dataset.ciphertext_count,
      result_count: 1,
      columns: dataset.columns,
      model_feature_names: [],
      weight_mapping: [],
      intercept: 0,
      classes: [],
      row_result_slot_map: {},
      input_ciphertext_files: dataset.ciphertext_files,
      result_files: ['result_000.bin'],
      manifest_json: manifest,
      status,
    });
    if (error) throw new Error(imageTableError(error.message));
  }
}

function modelFor(source: ImageJobSource): { id: number; name: string } {
  return source === 'mock'
    ? { id: IMAGE_DETECTION_MODEL_ID, name: IMAGE_DETECTION_MODEL_NAME }
    : { id: IMAGE_DETECTION_GPU_MODEL_ID, name: IMAGE_DETECTION_GPU_MODEL_NAME };
}

function manifestFrom(input: Partial<NewImageJob>): ImageManifest {
  const manifest: ImageManifest = {};
  if (input.source) manifest.image_source = input.source;
  if (input.encrypted_dir !== undefined) manifest.encrypted_dir = input.encrypted_dir;
  if (input.result_dir !== undefined) manifest.result_dir = input.result_dir;
  if (input.prediction !== undefined) manifest.prediction = input.prediction;
  if (input.decrypted_at !== undefined) manifest.decrypted_at = input.decrypted_at;
  return manifest;
}

function asManifest(value: unknown): ImageManifest {
  if (!value || typeof value !== 'object') return {};
  return value as ImageManifest;
}

function toImageJob(dataset: FheEncryptedDataset, result: StoredResult | null): FheImageJobRow {
  const manifest = asManifest(dataset.manifest_json);
  const resultManifest = asManifest(result?.manifest_json);
  const decryptedAt =
    resultManifest.decrypted_at ??
    manifest.decrypted_at ??
    (result?.status === 'decrypted' ? result.updated_at : null);

  return {
    id: dataset.id,
    user_id: dataset.user_id,
    file_name: dataset.source_file_name,
    source: manifest.image_source ?? (dataset.model_id === IMAGE_DETECTION_MODEL_ID ? 'mock' : 'gpu'),
    model_name: dataset.model_name,
    encrypted_dir: manifest.encrypted_dir ?? null,
    result_dir: result?.result_path ?? manifest.result_dir ?? null,
    prediction: resultManifest.prediction ?? manifest.prediction ?? null,
    submitted_at: dataset.submitted_at,
    decrypted_at: decryptedAt,
    created_at: dataset.created_at,
  };
}

function imageTableError(message: string): string {
  if (/model_type|image_inference|check constraint|models/i.test(message)) {
    return `${message} Run supabase/fhe-image-jobs.sql in the Supabase SQL editor.`;
  }
  return message;
}
