export interface Environment {
  production: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Base URL for the FHE key-vault API. Empty string uses the dev proxy (/fhe-vault). */
  fheApiBaseUrl: string;
  /**
   * Base URL for the GPU image-detection API (`/v1/encrypt`, `/v1/infer`, `/v1/decrypt`).
   * `/fhe-image` is proxied to the RunPod GPU in dev and on the EC2 host.
   */
  imageApiBaseUrl: string;
}
