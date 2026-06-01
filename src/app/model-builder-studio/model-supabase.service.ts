import { Injectable, inject } from '@angular/core';
import { AuthService } from '../shared/auth.service';
import { ModelType } from './model-builder.types';

export interface SupabaseModel {
  id: number;
  user_id: string;
  model_type: ModelType;
  model_name: string;
  model_json: unknown;
  created_at: string;
  updated_at: string;
}

export interface SaveModelPayload {
  model_type: ModelType;
  model_name: string;
  model_json: unknown;
}

@Injectable({ providedIn: 'root' })
export class ModelSupabaseService {
  private readonly auth = inject(AuthService);
  private get db() { return this.auth.client; }

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

    if (isRemoteId) {
      const { data, error } = await this.db
        .from('models')
        .update({
          model_name: payload.model_name,
          model_type: payload.model_type,
          model_json: payload.model_json,
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
      })
      .select()
      .single();

    if (error) {
      console.error('insertModel error', error.message);
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
