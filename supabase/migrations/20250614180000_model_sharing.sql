-- Model sharing: model_shares grants + models RLS (owner CRUD, shared read via model_shares).

-- ---------------------------------------------------------------------------
-- model_shares
-- ---------------------------------------------------------------------------

create table if not exists public.model_shares (
  id bigint generated always as identity not null,
  model_id bigint not null,
  owner_id uuid not null,
  shared_with_user_id uuid not null,
  created_at timestamp with time zone not null default now(),
  constraint model_shares_pkey primary key (id),
  constraint model_shares_unique_grant unique (model_id, shared_with_user_id),
  constraint model_shares_model_id_fkey foreign key (model_id) references public.models (id) on delete cascade,
  constraint model_shares_owner_id_fkey foreign key (owner_id) references auth.users (id) on delete cascade,
  constraint model_shares_shared_with_user_id_fkey foreign key (shared_with_user_id) references auth.users (id) on delete cascade,
  constraint model_shares_not_self check (owner_id <> shared_with_user_id)
);

create index if not exists model_shares_model_id_idx
  on public.model_shares using btree (model_id);

create index if not exists model_shares_shared_with_user_id_idx
  on public.model_shares using btree (shared_with_user_id);

create index if not exists model_shares_owner_id_idx
  on public.model_shares using btree (owner_id);

alter table public.model_shares enable row level security;
alter table public.model_shares force row level security;

drop policy if exists "Owners manage shares for own models" on public.model_shares;
create policy "Owners manage shares for own models"
  on public.model_shares
  for all
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "Recipients read own shares" on public.model_shares;
create policy "Recipients read own shares"
  on public.model_shares
  for select
  to authenticated
  using (shared_with_user_id = (select auth.uid()));

revoke all on public.model_shares from anon;
grant select, insert, update, delete on public.model_shares to authenticated;

-- ---------------------------------------------------------------------------
-- models RLS
-- ---------------------------------------------------------------------------

alter table public.models enable row level security;
alter table public.models force row level security;

drop policy if exists "Owners select own models" on public.models;
create policy "Owners select own models"
  on public.models
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Shared recipients select published models" on public.models;
create policy "Shared recipients select published models"
  on public.models
  for select
  to authenticated
  using (
    published is true
    and exists (
      select 1
      from public.model_shares ms
      where ms.model_id = models.id
        and ms.shared_with_user_id = (select auth.uid())
    )
  );

drop policy if exists "Owners insert own models" on public.models;
create policy "Owners insert own models"
  on public.models
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Owners update own models" on public.models;
create policy "Owners update own models"
  on public.models
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Owners delete own models" on public.models;
create policy "Owners delete own models"
  on public.models
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Authenticated users read published models" on public.models;

revoke all on public.models from anon;
grant select, insert, update, delete on public.models to authenticated;

drop view if exists public.shared_models_summary;
drop view if exists public.models_summary;

-- ---------------------------------------------------------------------------
-- Share management RPCs
-- ---------------------------------------------------------------------------

drop function if exists public.get_shared_published_models(text);
drop function if exists public.share_model_by_email(bigint, text);
drop function if exists public.list_model_shares(bigint);
drop function if exists public.revoke_model_share(bigint);

create or replace function public.share_model_by_email(p_model_id bigint, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_target_id uuid;
begin
  if v_owner_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.models
    where id = p_model_id
      and user_id = v_owner_id
  ) then
    raise exception 'Model not found or not owned by you';
  end if;

  select u.id
  into v_target_id
  from auth.users u
  where lower(u.email) = lower(trim(p_email));

  if v_target_id is null then
    raise exception 'No user with that email';
  end if;

  if v_target_id = v_owner_id then
    raise exception 'Cannot share a model with yourself';
  end if;

  insert into public.model_shares (model_id, owner_id, shared_with_user_id)
  values (p_model_id, v_owner_id, v_target_id)
  on conflict (model_id, shared_with_user_id) do nothing;
end;
$$;

create or replace function public.list_model_shares(p_model_id bigint)
returns table (
  share_id bigint,
  shared_with_user_id uuid,
  shared_with_email text,
  created_at timestamp with time zone
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ms.id as share_id,
    ms.shared_with_user_id,
    u.email as shared_with_email,
    ms.created_at
  from public.model_shares ms
  join auth.users u on u.id = ms.shared_with_user_id
  where ms.model_id = p_model_id
    and ms.owner_id = (select auth.uid())
  order by ms.created_at desc;
$$;

create or replace function public.revoke_model_share(p_share_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
begin
  if v_owner_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.model_shares
  where id = p_share_id
    and owner_id = v_owner_id;

  if not found then
    raise exception 'Share not found or not owned by you';
  end if;
end;
$$;

revoke all on function public.share_model_by_email(bigint, text) from public;
revoke all on function public.list_model_shares(bigint) from public;
revoke all on function public.revoke_model_share(bigint) from public;

grant execute on function public.share_model_by_email(bigint, text) to authenticated;
grant execute on function public.list_model_shares(bigint) to authenticated;
grant execute on function public.revoke_model_share(bigint) to authenticated;
