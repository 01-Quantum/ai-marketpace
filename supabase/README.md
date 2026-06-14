# Supabase migrations

Apply migrations in order in the Supabase SQL editor or via the CLI.

## Model sharing (`20250614180000_model_sharing.sql`)

Creates:

| Object | Purpose |
|--------|---------|
| `model_shares` | Grants another user access to a model |
| `get_shared_published_models(model_type)` | RPC catalog for data owners (no public view) |
| `share_model_by_email(model_id, email)` | Owner shares a saved model |
| `list_model_shares(model_id)` | Owner lists current shares |
| `revoke_model_share(share_id)` | Owner removes a share |

### RLS

- **`models`**: owner-only, `FORCE ROW LEVEL SECURITY`
- **`model_shares`**: owners manage shares; recipients can read their rows; `anon` revoked
- **No public views** — avoids Supabase “RLS unrestricted” warnings on `shared_models_summary`

### Patch (`20250614200000_secure_shared_models_rpc.sql`)

Run this if you already applied an older version that created `shared_models_summary` / `models_summary` views.

### Apply

```bash
supabase db push
```

Or paste each migration file into **Dashboard → SQL → Run**.

### Data owner catalog

The app calls `get_shared_published_models` — data owners only see models that were **published and shared** with them.

### Remove old public policy (if applied separately)

```sql
drop policy if exists "Authenticated users read published models" on public.models;
drop view if exists public.shared_models_summary;
drop view if exists public.models_summary;
```
