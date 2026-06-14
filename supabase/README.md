# Supabase migrations

Apply migrations in the Supabase SQL editor or via the CLI.

## Model sharing (`20250614180000_model_sharing.sql`)

Creates:

| Object | Purpose |
|--------|---------|
| `model_shares` | Grants another user access to a model |
| `models_summary` | View of `models` **without** `model_json` or `sample_data` |
| `shared_models_summary` | Models shared with the signed-in user (metadata only) |
| `share_model_by_email(model_id, email)` | Owner shares a saved model |
| `list_model_shares(model_id)` | Owner lists current shares |
| `revoke_model_share(share_id)` | Owner removes a share |

### RLS

- **`model_shares`**: owners can create/update/delete their shares; recipients can read rows shared with them.
- **`models`**: unchanged by this migration. Owners should keep full CRUD on their rows; published catalog reads stay as you already configured.

### Apply

```bash
# Supabase CLI (if linked)
supabase db push

# Or paste the SQL file into Dashboard → SQL → New query → Run
```

### Notes

- Recipients only see metadata through `shared_models_summary`; they cannot read `model_json` from `models`.
- Sharing is by **account email** (must match a Supabase Auth user).
