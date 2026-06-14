# Supabase migrations

Apply migrations in the Supabase SQL editor or via the CLI.

## Model sharing (`20250614180000_model_sharing.sql`)

Creates:

| Object | Purpose |
|--------|---------|
| `model_shares` | Grants another user access to a model |
| `models_summary` | Owner list view **without** `model_json` or `sample_data` |
| `shared_models_summary` | Models shared with the signed-in user (`sample_data` yes, `model_json` no) |
| `share_model_by_email(model_id, email)` | Owner shares a saved model |
| `list_model_shares(model_id)` | Owner lists current shares |
| `revoke_model_share(share_id)` | Owner removes a share |

### RLS

- **`models`**: owner-only (`auth.uid() = user_id`). No public `published = true` read policy.
- **`model_shares`**: owners manage their shares; recipients can read rows shared with them.
- **`shared_models_summary`**: security-definer view filtered to `shared_with_user_id = auth.uid()`.

### Data owner catalog

The app loads published models from `shared_models_summary`, not `models`. A data owner only sees models that a model owner has **published and shared** with them.

### Apply

```bash
# Supabase CLI (if linked)
supabase db push

# Or paste supabase/migrations/20250614180000_model_sharing.sql into Dashboard → SQL → Run
```

### Remove old public policy (if applied separately)

```sql
drop policy if exists "Authenticated users read published models" on public.models;
```

### Notes

- Sharing is by **account email** (must match a Supabase Auth user).
- Recipients cannot read `model_json` from `models`; they get metadata and `sample_data` via `shared_models_summary`.
