export interface Environment {
  production: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Base URL for the FHE key-vault API. Empty string uses the dev proxy (/fhe-vault). */
  fheApiBaseUrl: string;
}
