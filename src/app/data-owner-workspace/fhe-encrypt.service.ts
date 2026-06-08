import { Injectable, inject } from '@angular/core';
import { AuthService } from '../shared/auth.service';
import { environment } from '../../environments/environment';

export type FheVaultResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

export type FheEncryptResult = FheVaultResult;

@Injectable({ providedIn: 'root' })
export class FheEncryptService {
  private readonly auth = inject(AuthService);

  async encrypt(modelId: number, fheKeyId: number, file: File): Promise<FheEncryptResult> {
    const token = await this.auth.getAccessToken();
    if (!token) {
      return { ok: false, error: 'Not authenticated.' };
    }

    const form = new FormData();
    form.append('model_id', String(modelId));
    form.append('fhe_key_id', String(fheKeyId));
    form.append('file', file, file.name);

    const res = await fetch(`${environment.fheApiBaseUrl}/fhe-vault/fhe-encrypt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('fhe-encrypt failed', res.status, text);
      return { ok: false, error: text || `Encryption failed (${res.status}).` };
    }

    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { ok: true, data };
  }

  async deleteDataset(id: number): Promise<FheVaultResult> {
    const token = await this.auth.getAccessToken();
    if (!token) {
      return { ok: false, error: 'Not authenticated.' };
    }

    const res = await fetch(`${environment.fheApiBaseUrl}/fhe-vault/fhe-dataset-delete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('fhe-dataset-delete failed', res.status, text);
      return { ok: false, error: text || `Delete failed (${res.status}).` };
    }

    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { ok: true, data };
  }
}
