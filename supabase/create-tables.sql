create table public.fhe_encrypted_datasets (
  id bigserial not null,
  user_id uuid not null,
  encrypt_id text not null,
  encrypt_path text not null,
  source_file_name text null,
  source_file_size bigint null,
  model_id bigint not null,
  model_name text not null,
  model_type text not null,
  fhe_key_id bigint not null,
  fhe_key_storage_path text not null,
  slots integer not null,
  params_count integer not null,
  rows_per_ciphertext integer not null,
  total_rows integer not null,
  ciphertext_count integer not null,
  removed_columns text[] not null default '{}'::text[],
  columns text[] not null default '{}'::text[],
  ciphertext_files text[] not null default '{}'::text[],
  manifest_json jsonb not null default '{}'::jsonb,
  status text not null default 'encrypted'::text,
  submitted_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint fhe_encrypted_datasets_pkey primary key (id),
  constraint fhe_encrypted_datasets_encrypt_id_key unique (encrypt_id),
  constraint fhe_encrypted_datasets_model_id_fkey foreign KEY (model_id) references models (id) on delete RESTRICT,
  constraint fhe_encrypted_datasets_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint fhe_encrypted_datasets_fhe_key_id_fkey foreign KEY (fhe_key_id) references fhe_keys (id) on delete RESTRICT,
  constraint fhe_encrypted_datasets_params_count_check check ((params_count > 0)),
  constraint fhe_encrypted_datasets_model_type_check check (
    (
      model_type = any (
        array['logistic'::text, 'tree'::text, 'linear'::text]
      )
    )
  ),
  constraint fhe_encrypted_datasets_rows_per_ciphertext_check check ((rows_per_ciphertext > 0)),
  constraint fhe_encrypted_datasets_slots_check check ((slots > 0)),
  constraint fhe_encrypted_datasets_status_check check (
    (
      status = any (
        array[
          'encrypted'::text,
          'submitted'::text,
          'inference_running'::text,
          'inference_complete'::text,
          'failed'::text
        ]
      )
    )
  ),
  constraint fhe_encrypted_datasets_total_rows_check check ((total_rows >= 0)),
  constraint fhe_encrypted_datasets_ciphertext_count_check check ((ciphertext_count > 0))
) TABLESPACE pg_default;

create index IF not exists fhe_encrypted_datasets_user_id_idx on public.fhe_encrypted_datasets using btree (user_id) TABLESPACE pg_default;

create index IF not exists fhe_encrypted_datasets_model_id_idx on public.fhe_encrypted_datasets using btree (model_id) TABLESPACE pg_default;

create index IF not exists fhe_encrypted_datasets_fhe_key_id_idx on public.fhe_encrypted_datasets using btree (fhe_key_id) TABLESPACE pg_default;

create index IF not exists fhe_encrypted_datasets_status_idx on public.fhe_encrypted_datasets using btree (status) TABLESPACE pg_default;

create trigger fhe_encrypted_datasets_set_updated_at BEFORE
update on fhe_encrypted_datasets for EACH row
execute FUNCTION set_updated_at ();


create table public.fhe_encrypted_results (
  id bigserial not null,
  user_id uuid not null,
  result_id text not null,
  result_path text not null,
  encrypted_dataset_id bigint not null,
  encrypt_id text not null,
  dataset_model_id bigint not null,
  dataset_model_name text not null,
  dataset_model_type text not null,
  model_id bigint not null,
  model_name text not null,
  model_type text not null,
  fhe_key_id bigint not null,
  fhe_key_storage_path text not null,
  operation text not null default 'batched_linear_score'::text,
  slots integer not null,
  params_count integer not null,
  rows_per_ciphertext integer not null,
  total_rows integer not null,
  ciphertext_count integer not null,
  result_count integer not null,
  columns text[] not null default '{}'::text[],
  model_feature_names text[] not null default '{}'::text[],
  weight_mapping jsonb not null default '[]'::jsonb,
  intercept double precision not null default 0,
  threshold double precision null,
  classes text[] not null default '{}'::text[],
  row_result_slot_map jsonb not null default '{}'::jsonb,
  input_ciphertext_files text[] not null default '{}'::text[],
  result_files text[] not null default '{}'::text[],
  manifest_json jsonb not null default '{}'::jsonb,
  status text not null default 'completed'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  elapsed_ms integer null,
  constraint fhe_encrypted_results_pkey primary key (id),
  constraint fhe_encrypted_results_result_id_key unique (result_id),
  constraint fhe_encrypted_results_model_id_fkey foreign KEY (model_id) references models (id) on delete RESTRICT,
  constraint fhe_encrypted_results_fhe_key_id_fkey foreign KEY (fhe_key_id) references fhe_keys (id) on delete RESTRICT,
  constraint fhe_encrypted_results_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint fhe_encrypted_results_encrypted_dataset_id_fkey foreign KEY (encrypted_dataset_id) references fhe_encrypted_datasets (id) on delete RESTRICT,
  constraint fhe_encrypted_results_dataset_model_id_fkey foreign KEY (dataset_model_id) references models (id) on delete RESTRICT,
  constraint fhe_encrypted_results_slots_check check ((slots > 0)),
  constraint fhe_encrypted_results_status_check check (
    (
      status = any (
        array[
          'completed'::text,
          'failed'::text,
          'decrypted'::text
        ]
      )
    )
  ),
  constraint fhe_encrypted_results_total_rows_check check ((total_rows >= 0)),
  constraint fhe_encrypted_results_params_count_check check ((params_count > 0)),
  constraint fhe_encrypted_results_dataset_model_type_check check (
    (
      dataset_model_type = any (
        array['logistic'::text, 'tree'::text, 'linear'::text]
      )
    )
  ),
  constraint fhe_encrypted_results_model_type_check check (
    (
      model_type = any (
        array['logistic'::text, 'tree'::text, 'linear'::text]
      )
    )
  ),
  constraint fhe_encrypted_results_operation_check check (
    (
      operation = any (
        array['batched_linear_score'::text, 'tree_eval'::text]
      )
    )
  ),
  constraint fhe_encrypted_results_ciphertext_count_check check ((ciphertext_count > 0)),
  constraint fhe_encrypted_results_result_count_check check ((result_count > 0)),
  constraint fhe_encrypted_results_rows_per_ciphertext_check check ((rows_per_ciphertext > 0))
) TABLESPACE pg_default;

create index IF not exists fhe_encrypted_results_user_id_idx on public.fhe_encrypted_results using btree (user_id) TABLESPACE pg_default;

create index IF not exists fhe_encrypted_results_encrypted_dataset_id_idx on public.fhe_encrypted_results using btree (encrypted_dataset_id) TABLESPACE pg_default;

create index IF not exists fhe_encrypted_results_model_id_idx on public.fhe_encrypted_results using btree (model_id) TABLESPACE pg_default;

create index IF not exists fhe_encrypted_results_fhe_key_id_idx on public.fhe_encrypted_results using btree (fhe_key_id) TABLESPACE pg_default;

create index IF not exists fhe_encrypted_results_status_idx on public.fhe_encrypted_results using btree (status) TABLESPACE pg_default;

create trigger fhe_encrypted_results_set_updated_at BEFORE
update on fhe_encrypted_results for EACH row
execute FUNCTION set_updated_at ();

create table public.fhe_keys (
  id bigint generated always as identity not null,
  user_id uuid not null,
  key_name text not null,
  scheme text not null default 'OpenFHE CKKS'::text,
  multiplicative_depth integer not null,
  public_key_json jsonb null,
  public_key_storage_path text null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  slots integer null default 0,
  constraint fhe_keys_pkey primary key (id),
  constraint fhe_keys_user_key_name_unique unique (user_id, key_name),
  constraint fhe_keys_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint fhe_keys_multiplicative_depth_check check ((multiplicative_depth > 0))
) TABLESPACE pg_default;

create index IF not exists fhe_keys_user_id_idx on public.fhe_keys using btree (user_id) TABLESPACE pg_default;

create index IF not exists fhe_keys_user_active_idx on public.fhe_keys using btree (user_id) TABLESPACE pg_default
where
  (is_active = true);

create trigger fhe_keys_set_updated_at BEFORE
update on fhe_keys for EACH row
execute FUNCTION set_updated_at ();

create table public.model_shares (
  id bigint generated always as identity not null,
  model_id bigint not null,
  owner_id uuid not null,
  shared_with_user_id uuid not null,
  created_at timestamp with time zone not null default now(),
  constraint model_shares_pkey primary key (id),
  constraint model_shares_unique_grant unique (model_id, shared_with_user_id),
  constraint model_shares_model_id_fkey foreign KEY (model_id) references models (id) on delete CASCADE,
  constraint model_shares_owner_id_fkey foreign KEY (owner_id) references auth.users (id) on delete CASCADE,
  constraint model_shares_shared_with_user_id_fkey foreign KEY (shared_with_user_id) references auth.users (id) on delete CASCADE,
  constraint model_shares_not_self check ((owner_id <> shared_with_user_id))
) TABLESPACE pg_default;

create index IF not exists model_shares_model_id_idx on public.model_shares using btree (model_id) TABLESPACE pg_default;

create index IF not exists model_shares_shared_with_user_id_idx on public.model_shares using btree (shared_with_user_id) TABLESPACE pg_default;

create index IF not exists model_shares_owner_id_idx on public.model_shares using btree (owner_id) TABLESPACE pg_default;

create table public.models (
  id bigint generated by default as identity not null,
  user_id uuid null default gen_random_uuid (),
  model_type character varying null,
  model_name character varying null,
  model_json json null,
  created_at timestamp with time zone not null default now(),
  updated_at date null default now(),
  sample_data json null,
  published boolean null default false,
  params_count integer null default 0,
  client_metadata json null,
  constraint models_pkey primary key (id),
  constraint models_user_id_fkey foreign KEY (user_id) references auth.users (id)
) TABLESPACE pg_default;