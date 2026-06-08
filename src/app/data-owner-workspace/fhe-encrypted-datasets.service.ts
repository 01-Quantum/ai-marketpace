import { Injectable, inject } from '@angular/core';
import { AuthService } from '../shared/auth.service';
import { InferenceModelChoice } from '../shared/workflow.types';

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

  async loadByModelType(
    modelType: InferenceModelChoice,
  ): Promise<{ datasets: FheEncryptedDataset[]; error: string | null }> {
    const userId = this.auth.user()?.id;
    if (!userId) return { datasets: [], error: null };

    const { data, error } = await this.db
      .from('fhe_encrypted_datasets')
      .select('*')
      .eq('user_id', userId)
      .eq('model_type', modelType)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('loadEncryptedDatasets error', error.message, { modelType });
      return { datasets: [], error: error.message };
    }

    return { datasets: (data ?? []) as FheEncryptedDataset[], error: null };
  }

  async deleteDataset(id: number): Promise<boolean> {
    const userId = this.auth.user()?.id;
    if (!userId) return false;

    const { error } = await this.db
      .from('fhe_encrypted_datasets')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('deleteEncryptedDataset error', error.message);
      return false;
    }
    return true;
  }
}
