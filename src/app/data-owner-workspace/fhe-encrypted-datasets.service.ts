import { Injectable, inject } from '@angular/core';
import { AuthService } from '../shared/auth.service';

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
  created_at: string;
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
}
