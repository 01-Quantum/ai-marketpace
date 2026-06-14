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

@Injectable({ providedIn: 'root' })
export class ModelSupabaseService {
  private readonly auth = inject(AuthService);
  private get db() { return this.auth.client; }

  /** Published models of the given type (marketplace catalog for data owners). */
  async loadPublishedModelsByType(
    modelType: ModelType,
  ): Promise<{ models: SupabaseModel[]; error: string | null }> {
    const { data, error } = await this.db
      .from('models')
      .select('*')
      .eq('published', true)
      .eq('model_type', modelType)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('loadPublishedModelsByType error', error.message, { modelType });
      return { models: [], error: error.message };
    }

    const models = (data ?? []) as SupabaseModel[];
    console.info(
      `loadPublishedModelsByType: ${models.length} published ${modelType} model(s)`,
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
}
