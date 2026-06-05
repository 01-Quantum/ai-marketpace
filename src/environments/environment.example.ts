import { Environment } from './environment.types';

/**
 * Copy to environment.ts (local dev) and fill in real values.
 * The Supabase anon/publishable key is safe to expose in client code.
 */
export const environment: Environment = {
  production: false,
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
  // Leave empty in dev to use the /fhe-vault proxy; set to the deployed API URL in prod.
  fheApiBaseUrl: '',
};
