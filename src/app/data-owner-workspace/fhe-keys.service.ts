import { Injectable, inject } from '@angular/core';
import { AuthService } from '../shared/auth.service';
import { environment } from '../../environments/environment';

export interface FheKey {
  id: number;
  user_id: string;
  key_name: string;
  scheme: string;
  multiplicative_depth: number;
  slots: number;
  public_key_json: unknown | null;
  public_key_storage_path: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FheKeyInput {
  key_name: string;
  scheme: string;
  multiplicative_depth: number;
  slots: number;
}

interface GenerateKeyResponse {
  key_id: string;
  scheme: string;
  multiplicative_depth: number;
  supabase_record: FheKey;
}

@Injectable({ providedIn: 'root' })
export class FheKeysService {
  private readonly auth = inject(AuthService);
  private get db() {
    return this.auth.client;
  }

  /** Latest active key for the current user, or null. */
  async loadLatestKey(): Promise<FheKey | null> {
    const userId = this.auth.user()?.id;
    if (!userId) return null;

    const { data, error } = await this.db
      .from('fhe_keys')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('loadLatestKey error', error.message);
      return null;
    }
    return (data as FheKey) ?? null;
  }

  /** All keys for the current user, newest first. */
  async loadAllKeys(): Promise<FheKey[]> {
    const userId = this.auth.user()?.id;
    if (!userId) return [];

    const { data, error } = await this.db
      .from('fhe_keys')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('loadAllKeys error', error.message);
      return [];
    }
    return (data ?? []) as FheKey[];
  }

  /** Mark one key active and deactivate the rest for this user. */
  async setActiveKey(id: number): Promise<FheKey | null> {
    const userId = this.auth.user()?.id;
    if (!userId) return null;

    const { error: deactivateError } = await this.db
      .from('fhe_keys')
      .update({ is_active: false })
      .eq('user_id', userId)
      .neq('id', id);

    if (deactivateError) {
      console.error('setActiveKey (deactivate) error', deactivateError.message);
      return null;
    }

    const { data, error } = await this.db
      .from('fhe_keys')
      .update({ is_active: true })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('setActiveKey (activate) error', error.message);
      return null;
    }
    return data as FheKey;
  }

  /**
   * Generate a new key pair via the FHE vault API. The API performs the
   * OpenFHE keygen and writes the Supabase record, then returns it.
   */
  async generateKey(input: FheKeyInput): Promise<FheKey | null> {
    const token = await this.auth.getAccessToken();
    if (!token) return null;

    const res = await fetch(`${environment.fheApiBaseUrl}/fhe-vault/keys`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: input.key_name,
        'key-type': input.scheme === 'OpenFHE CKKS' ? 'CKKS' : input.scheme,
        'mult-depth': input.multiplicative_depth,
        'num-slots': input.slots,
      }),
    });

    if (!res.ok) {
      console.error('generateKey failed', res.status, await res.text());
      return null;
    }

    const json = (await res.json()) as GenerateKeyResponse;
    return json.supabase_record;
  }

  /** Rename an existing key (metadata only) directly in Supabase. */
  async updateKey(id: number, input: Pick<FheKeyInput, 'key_name'>): Promise<FheKey | null> {
    const userId = this.auth.user()?.id;
    if (!userId) return null;

    const { data, error } = await this.db
      .from('fhe_keys')
      .update({ key_name: input.key_name })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('updateKey error', error.message);
      return null;
    }
    return data as FheKey;
  }

  async deleteKey(id: number): Promise<boolean> {
    const userId = this.auth.user()?.id;
    if (!userId) return false;

    const { error } = await this.db
      .from('fhe_keys')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('deleteKey error', error.message);
      return false;
    }
    return true;
  }
}
