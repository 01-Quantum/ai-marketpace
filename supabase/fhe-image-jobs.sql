-- Let image-detection jobs use the existing dataset and result tables.
-- model_type gains 'image'. Results use operation 'image_inference'.
-- The two image models are fixed rows so dataset.model_id can reference them.

alter table public.fhe_encrypted_datasets
  drop constraint if exists fhe_encrypted_datasets_model_type_check;

alter table public.fhe_encrypted_datasets
  add constraint fhe_encrypted_datasets_model_type_check
  check (model_type in ('logistic', 'tree', 'linear', 'image'));

alter table public.fhe_encrypted_results
  drop constraint if exists fhe_encrypted_results_dataset_model_type_check;

alter table public.fhe_encrypted_results
  add constraint fhe_encrypted_results_dataset_model_type_check
  check (dataset_model_type in ('logistic', 'tree', 'linear', 'image'));

alter table public.fhe_encrypted_results
  drop constraint if exists fhe_encrypted_results_model_type_check;

alter table public.fhe_encrypted_results
  add constraint fhe_encrypted_results_model_type_check
  check (model_type in ('logistic', 'tree', 'linear', 'image'));

alter table public.fhe_encrypted_results
  drop constraint if exists fhe_encrypted_results_operation_check;

alter table public.fhe_encrypted_results
  add constraint fhe_encrypted_results_operation_check
  check (operation in ('batched_linear_score', 'tree_eval', 'image_inference'));

insert into public.models (id, user_id, model_type, model_name, published, params_count)
overriding system value
values
  (91000, null, 'image', 'CIFAR-10 Image Detection (ResNet-20) -mocked', true, 16),
  (92000, null, 'image', 'CIFAR-10 Image Detection (ResNet-20)', true, 16)
on conflict (id) do nothing;

drop policy if exists "Users insert own encrypted datasets" on public.fhe_encrypted_datasets;
create policy "Users insert own encrypted datasets"
  on public.fhe_encrypted_datasets
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users update own encrypted datasets" on public.fhe_encrypted_datasets;
create policy "Users update own encrypted datasets"
  on public.fhe_encrypted_datasets
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users delete own encrypted datasets" on public.fhe_encrypted_datasets;
create policy "Users delete own encrypted datasets"
  on public.fhe_encrypted_datasets
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users insert own encrypted results" on public.fhe_encrypted_results;
create policy "Users insert own encrypted results"
  on public.fhe_encrypted_results
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users update own encrypted results" on public.fhe_encrypted_results;
create policy "Users update own encrypted results"
  on public.fhe_encrypted_results
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users delete own encrypted results" on public.fhe_encrypted_results;
create policy "Users delete own encrypted results"
  on public.fhe_encrypted_results
  for delete
  to authenticated
  using (user_id = (select auth.uid()));
