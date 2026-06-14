# Supabase migrations

Apply migrations in order in the Supabase SQL editor or via the CLI.

## Model sharing (`20250614180000_model_sharing.sql`)

Creates:

| Object | Purpose |
|--------|---------|
| `model_shares` | Grants another user access to a model |
| `share_model_by_email(model_id, email)` | Owner shares a saved model |
| `list_model_shares(model_id)` | Owner lists current shares |
| `revoke_model_share(share_id)` | Owner removes a share |

### RLS on `models`

| Policy | Who | What |
|--------|-----|------|
| Owners select own models | `user_id = auth.uid()` | All own rows |
| Shared recipients select published models | `model_shares.shared_with_user_id = auth.uid()` and `published = true` | Read shared catalog |
| Owners insert/update/delete | `user_id = auth.uid()` | Owner CRUD only |

Shared users cannot insert, update, or delete models — only select rows they were granted via `model_shares`.

### RLS on `model_shares`

- Owners manage shares for their models
- Recipients can read their own share rows

### App usage

- **Model builder (owner)** → `models` table
- **Data owner catalog** → `model_shares` join `models` (RLS on both tables)

### Apply

```bash
supabase db push
```

Or paste the migration file into **Dashboard → SQL → Run**.

### If you already ran an older migration

```sql
drop function if exists public.get_shared_published_models(text);
drop view if exists public.shared_models_summary;
drop view if exists public.models_summary;

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
```
