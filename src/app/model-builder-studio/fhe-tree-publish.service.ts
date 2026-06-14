import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from '../shared/auth.service';

@Injectable({ providedIn: 'root' })
export class FheTreePublishService {
  private readonly auth = inject(AuthService);

  async publishTree(
    modelId: number,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const token = await this.auth.getAccessToken();
    if (!token) {
      return { ok: false, error: 'Not authenticated.' };
    }

    const res = await fetch(`${environment.fheApiBaseUrl}/fhe-vault/fhe-tree-publish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model_id: modelId }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('fhe-tree-publish failed', res.status, text);
      return { ok: false, error: text || `Tree publish failed (${res.status}).` };
    }

    return { ok: true };
  }
}
