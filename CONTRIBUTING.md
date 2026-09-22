# Contributing

## Branches and pull requests

- Branch from `main` using `feature/short-description` or `fix/short-description`.
- Keep a pull request focused on one change.
- CI must be green before merge: tests, type-check and production build.

## Before you push

```bash
cd jobs-app
npm run format      # Prettier, changed files
npm test
npm run build       # runs tsc -b, then Vite
```

## Conventions

- TypeScript everywhere in `jobs-app/`; no `any` without a comment explaining why.
- Business logic goes in `src/lib/` with unit tests next to it (`*.test.ts`).
- Components stay presentational where practical.
- Never commit secrets. `.env.local` is ignored; `.env.example` documents the keys.

## Database changes

- One migration file per change in `supabase/migrations/`, named
  `YYYYMMDDHHMMSS_short_description.sql`.
- Every new table in the `public` schema must enable row level security,
  declare its policies, and include explicit `GRANT` statements.
- Migrations are forward-only; never edit a migration that has been applied.
