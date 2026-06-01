import { Injectable, computed, signal } from '@angular/core';
import {
  AuthChangeEvent,
  Session,
  SupabaseClient,
  User,
  createClient,
} from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  /** Shared Supabase client — reuse this instead of calling createClient() elsewhere. */
  readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
  );

  private readonly userSignal = signal<User | null>(null);
  private readonly initializedSignal = signal(false);

  readonly user = this.userSignal.asReadonly();
  readonly initialized = this.initializedSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.userSignal() !== null);

  readonly displayName = computed(() => {
    const user = this.userSignal();
    if (!user) return '';
    const metadataName =
      (user.user_metadata?.['username'] as string | undefined) ??
      (user.user_metadata?.['full_name'] as string | undefined) ??
      (user.user_metadata?.['name'] as string | undefined);
    if (metadataName) return metadataName;
    return user.email?.split('@')[0] ?? 'user';
  });

  constructor() {
    void this.restoreSession();
    this.client.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      this.userSignal.set(session?.user ?? null);
    });
  }

  private async restoreSession(): Promise<void> {
    const { data } = await this.client.auth.getSession();
    this.userSignal.set(data.session?.user ?? null);
    this.initializedSignal.set(true);
  }

  async signInWithPassword(email: string, password: string): Promise<void> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    this.userSignal.set(data.user ?? null);
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
    this.userSignal.set(null);
  }
}
