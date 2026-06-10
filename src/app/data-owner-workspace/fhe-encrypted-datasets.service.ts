import { Injectable, inject } from '@angular/core';
import { AuthService } from '../shared/auth.service';
export type InferenceJobStatus = 'encrypted' | 'inference_running' | 'inference_complete';

export interface FheEncryptedDataset {
  id: number;
  user_id: string;
  encrypt_id: string;
  encrypt_path: string;
  source_file_name: string;
  model_id: number;
  model_name: string;
  model_type: string;
  fhe_key_id: number;
  fhe_key_storage_path: string;
  slots: number;
  params_count: number;
  rows_per_ciphertext: number;
  total_rows: number;
  ciphertext_count: number;
  removed_columns: string[];
  columns: string[];
  ciphertext_files: string[];
  manifest_json: unknown;
  status: InferenceJobStatus | string;
  submitted_at: string | null;
  decrypted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FheEncryptedResult {
  id: number;
  user_id: string;
  result_id: string;
  result_path: string;
  encrypted_dataset_id: number;
  encrypt_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export type AuditEventStatus = 'completed' | 'pending' | 'current';

export interface AuditEvent {
  label: string;
  time: string;
  status: AuditEventStatus;
}

export function formatAuditTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  const shortDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const time = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${shortDate} · ${time}`;
}

export function buildAuditTrail(
  dataset: FheEncryptedDataset | null,
  decrypted: boolean,
  localDecryptedAt: string | null,
): AuditEvent[] {
  if (!dataset) {
    return [
      { label: 'Upload & Encrypt', time: '—', status: 'pending' },
      { label: 'Submitted to Enclave', time: '—', status: 'pending' },
      { label: 'Inference Completed', time: '—', status: 'pending' },
      { label: 'Awaiting decryption', time: '—', status: 'current' },
    ];
  }

  const inferenceComplete = dataset.status === 'inference_complete';
  const decryptedAt = dataset.decrypted_at ?? localDecryptedAt;
  const isDecrypted = decrypted || !!decryptedAt;

  const events: AuditEvent[] = [
    {
      label: 'Upload & Encrypt',
      time: formatAuditTime(dataset.created_at),
      status: 'completed',
    },
    {
      label: 'Submitted to Enclave',
      time: formatAuditTime(dataset.submitted_at),
      status: dataset.submitted_at ? 'completed' : 'pending',
    },
    {
      label: 'Inference Completed',
      time: inferenceComplete ? formatAuditTime(dataset.updated_at) : '—',
      status: inferenceComplete ? 'completed' : 'pending',
    },
  ];

  if (isDecrypted) {
    events.push({
      label: 'Result Decrypted',
      time: formatAuditTime(decryptedAt),
      status: 'completed',
    });
  } else {
    events.push({
      label: 'Awaiting decryption',
      time: '—',
      status: 'current',
    });
  }

  return events;
}

export interface InferenceJob {
  id: number;
  jobId: string;
  dataset: string;
  model: string;
  status: InferenceJobStatus;
  startedAt: string | null;
  completedAt: string | null;
}

function normalizeJobStatus(value: string | null | undefined): InferenceJobStatus {
  if (value === 'inference_complete' || value === 'inference_running') {
    return value;
  }
  return 'encrypted';
}

export function toInferenceJob(dataset: FheEncryptedDataset): InferenceJob {
  const status = normalizeJobStatus(dataset.status);
  return {
    id: dataset.id,
    jobId: dataset.encrypt_id,
    dataset: dataset.source_file_name,
    model: dataset.model_name,
    status,
    startedAt: dataset.submitted_at,
    completedAt: status === 'inference_complete' ? dataset.updated_at : null,
  };
}

@Injectable({ providedIn: 'root' })
export class FheEncryptedDatasetsService {
  private readonly auth = inject(AuthService);
  private get db() {
    return this.auth.client;
  }

  async loadAll(): Promise<{ datasets: FheEncryptedDataset[]; error: string | null }> {
    const userId = this.auth.user()?.id;
    if (!userId) {
      return { datasets: [], error: 'Not signed in.' };
    }

    const { data, error } = await this.db
      .from('fhe_encrypted_datasets')
      .select('*')
      .eq('user_id', userId)
      .is('submitted_at', null)
      .order('id', { ascending: false });

    if (error) {
      console.error('loadEncryptedDatasets error', error.message);
      return { datasets: [], error: error.message };
    }

    const datasets = (data ?? []) as FheEncryptedDataset[];
    console.info(
      `loadEncryptedDatasets: ${datasets.length} dataset(s) for user ${userId}`,
      datasets.map((d) => ({ id: d.id, name: d.source_file_name, model_type: d.model_type })),
    );
    return { datasets, error: null };
  }

  async loadSubmittedJobs(): Promise<{ jobs: InferenceJob[]; error: string | null }> {
    const userId = this.auth.user()?.id;
    if (!userId) {
      return { jobs: [], error: 'Not signed in.' };
    }

    const { data, error } = await this.db
      .from('fhe_encrypted_datasets')
      .select('*')
      .eq('user_id', userId)
      .not('submitted_at', 'is', null)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('loadInferenceJobs error', error.message);
      return { jobs: [], error: error.message };
    }

    const jobs = ((data ?? []) as FheEncryptedDataset[]).map(toInferenceJob);
    console.info(
      `loadInferenceJobs: ${jobs.length} submitted job(s) for user ${userId}`,
      jobs.map((j) => ({ id: j.id, status: j.status, dataset: j.dataset })),
    );
    return { jobs, error: null };
  }

  async loadById(
    id: number,
  ): Promise<{ dataset: FheEncryptedDataset | null; error: string | null }> {
    const userId = this.auth.user()?.id;
    if (!userId) {
      return { dataset: null, error: 'Not signed in.' };
    }

    const { data, error } = await this.db
      .from('fhe_encrypted_datasets')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('loadEncryptedDatasetById error', error.message);
      return { dataset: null, error: error.message };
    }

    return { dataset: (data as FheEncryptedDataset | null) ?? null, error: null };
  }

  async loadResultByDatasetId(
    encryptedDatasetId: number,
  ): Promise<{ result: FheEncryptedResult | null; error: string | null }> {
    const userId = this.auth.user()?.id;
    if (!userId) {
      return { result: null, error: 'Not signed in.' };
    }

    const { data, error } = await this.db
      .from('fhe_encrypted_results')
      .select('*')
      .eq('encrypted_dataset_id', encryptedDatasetId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('loadEncryptedResultByDatasetId error', error.message);
      return { result: null, error: error.message };
    }

    return { result: (data as FheEncryptedResult | null) ?? null, error: null };
  }
}
