# Contributing

Thank you for your interest in contributing to the 01 Quantum AI Marketplace.

## Getting started

1. Fork the repository and clone your fork.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the dev server:

   ```bash
   npm start
   ```

4. Open [http://localhost:4200/](http://localhost:4200/).

For Supabase schema and RLS, see [`supabase/README.md`](supabase/README.md) and [`supabase/create-tables.sql`](supabase/create-tables.sql).

## How to contribute

- **Bug reports** — open an issue with steps to reproduce, expected vs actual behavior, and browser/OS if relevant.
- **Feature requests** — open an issue describing the use case before large changes.
- **Pull requests** — keep changes focused; link related issues when applicable.

## Pull request checklist

- [ ] The app builds: `npm run build`
- [ ] Tests pass: `npm test`
- [ ] Changes match existing code style and patterns in the touched files
- [ ] UI changes were checked locally in the browser
- [ ] Database changes include updates to `supabase/create-tables.sql` and `supabase/README.md` when relevant
- [ ] No secrets, API keys, or `.env` values are committed

## Code guidelines

- Prefer **standalone Angular components** and the patterns already used in the repo.
- Keep diffs small and scoped to the task — avoid unrelated refactors.
- Reuse existing services (`AuthService`, `ModelSupabaseService`, FHE services) instead of duplicating Supabase access.
- Only add comments for non-obvious business logic.

## Commit messages

Use clear, imperative subject lines:

- `fix data owner catalog for model owners`
- `add auth guard to protected routes`
- `update Supabase RLS for model_shares`

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
