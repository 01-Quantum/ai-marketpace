import { Injectable, inject } from '@angular/core';
import { AuthService } from '../shared/auth.service';
import { ModelType } from './model-builder.types';
import { computeParamsCount } from './params-count';

export interface SupabaseModel {
  id: number;
  user_id: string;
  model_type: ModelType;
  model_name: string;
  model_json: unknown;
  sample_data: unknown;
  params_count: number;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface SaveModelPayload {
  model_type: ModelType;
  model_name: string;
  model_json: unknown;
  sample_data?: unknown;
}

export interface ModelShareEntry {
  share_id: number;
  shared_with_user_id: string;
  shared_with_email: string;
  created_at: string;
}

/** Row from get_shared_published_models RPC. */
export interface SharedPublishedModel {
  id: number;
  owner_id: string;
  model_type: ModelType;
  model_name: string;
  sample_data: unknown;
  params_count: number;
  published: boolean;
  created_at: string;
  updated_at: string;
  share_id: number;
  shared_at: string;
}

function sharedPublishedModelToCatalog(row: SharedPublishedModel): SupabaseModel {
  return {
    id: row.id,
    user_id: row.owner_id,
    model_type: row.model_type,
    model_name: row.model_name,
    model_json: null,
    sample_data: row.sample_data,
    params_count: row.params_count,
    published: row.published,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

@Injectable({ providedIn: 'root' })
export class ModelSupabaseService {
  private readonly auth = inject(AuthService);
  private get db() { return this.auth.client; }

  /** Published models shared with the current user (data owner catalog). */
  async loadPublishedModelsByType(
    modelType: ModelType,
  ): Promise<{ models: SupabaseModel[]; error: string | null }> {
    const userId = this.auth.user()?.id;
    if (!userId) {
      return { models: [], error: 'Not signed in.' };
    }

    const { data, error } = await this.db.rpc('get_shared_published_models', {
      p_model_type: modelType,
    });

    if (error) {
      console.error('loadPublishedModelsByType error', error.message, { modelType });
      return { models: [], error: error.message };
    }

    const models = ((data ?? []) as SharedPublishedModel[]).map(sharedPublishedModelToCatalog);
    console.info(
      `loadPublishedModelsByType: ${models.length} shared published ${modelType} model(s)`,
      models.map((m) => ({ id: m.id, name: m.model_name })),
    );
    return { models, error: null };
  }

  async loadModelById(remoteId: number): Promise<SupabaseModel | null> {
    const userId = this.auth.user()?.id;
    if (!userId) return null;

    const { data, error } = await this.db
      .from('models')
      .select('*')
      .eq('id', remoteId)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('loadModelById error', error.message);
      return null;
    }
    return data as SupabaseModel;
  }

  async loadModels(): Promise<SupabaseModel[]> {
    const userId = this.auth.user()?.id;
    if (!userId) return [];

    const { data, error } = await this.db
      .from('models')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('loadModels error', error.message);
      return [];
    }
    return (data ?? []) as SupabaseModel[];
  }

  async saveModel(localId: string, payload: SaveModelPayload): Promise<SupabaseModel | null> {
    const userId = this.auth.user()?.id;
    if (!userId) return null;

    const numericId = Number(localId);
    const isRemoteId = !isNaN(numericId) && numericId > 0 && Number.isInteger(numericId);

    const paramsCount = computeParamsCount(payload.model_type, payload.model_json);

    if (isRemoteId) {
      const { data, error } = await this.db
        .from('models')
        .update({
          model_name: payload.model_name,
          model_type: payload.model_type,
          model_json: payload.model_json,
          sample_data: payload.sample_data,
          params_count: paramsCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', numericId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('updateModel error', error.message);
        return null;
      }
      return data as SupabaseModel;
    }

    const { data, error } = await this.db
      .from('models')
      .insert({
        user_id: userId,
        model_name: payload.model_name,
        model_type: payload.model_type,
        model_json: payload.model_json,
        params_count: paramsCount,
      })
      .select()
      .single();

    if (error) {
      console.error('insertModel error', error.message);
      return null;
    }
    return data as SupabaseModel;
  }

  async setPublished(
    remoteId: number,
    published: boolean,
    payload?: SaveModelPayload,
  ): Promise<SupabaseModel | null> {
    const userId = this.auth.user()?.id;
    if (!userId) return null;

    const update: Record<string, unknown> = {
      published,
      updated_at: new Date().toISOString(),
    };
    if (payload) {
      update['model_name'] = payload.model_name;
      update['model_type'] = payload.model_type;
      update['model_json'] = payload.model_json;
      update['sample_data'] = payload.sample_data;
      update['params_count'] = computeParamsCount(payload.model_type, payload.model_json);
    }

    const { data, error } = await this.db
      .from('models')
      .update(update)
      .eq('id', remoteId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('setPublished error', error.message);
      return null;
    }
    return data as SupabaseModel;
  }

  async deleteModel(remoteId: number): Promise<boolean> {
    const userId = this.auth.user()?.id;
    if (!userId) return false;

    const { error } = await this.db
      .from('models')
      .delete()
      .eq('id', remoteId)
      .eq('user_id', userId);

    if (error) {
      console.error('deleteModel error', error.message);
      return false;
    }
    return true;
  }

  async listModelShares(
    modelId: number,
  ): Promise<{ shares: ModelShareEntry[]; error: string | null }> {
    const { data, error } = await this.db.rpc('list_model_shares', {
      p_model_id: modelId,
    });

    if (error) {
      console.error('listModelShares error', error.message);
      return { shares: [], error: error.message };
    }

    const shares = ((data ?? []) as ModelShareEntry[]).map((row) => ({
      share_id: Number(row.share_id),
      shared_with_user_id: row.shared_with_user_id,
      shared_with_email: row.shared_with_email,
      created_at: row.created_at,
    }));

    return { shares, error: null };
  }

  async shareModelByEmail(
    modelId: number,
    email: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const trimmed = email.trim();
    if (!trimmed) {
      return { ok: false, error: 'Enter an email address.' };
    }

    const { error } = await this.db.rpc('share_model_by_email', {
      p_model_id: modelId,
      p_email: trimmed,
    });

    if (error) {
      console.error('shareModelByEmail error', error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  }

  async revokeModelShare(shareId: number): Promise<{ ok: true } | { ok: false; error: string }> {
    const { error } = await this.db.rpc('revoke_model_share', {
      p_share_id: shareId,
    });

    if (error) {
      console.error('revokeModelShare error', error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  }
}
