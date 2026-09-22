# ezherebetskii-site

Personal site of Evgenii Zherebetskii plus **Opportunity Desk**, a private job-search workspace.

| Path | What it is |
|---|---|
| `index.html`, `styles.css`, `assets/` | Static personal site served at `ezherebetskii.com` |
| `jobs-app/` | React + Vite application served at `jobs.ezherebetskii.com` |
| `supabase/` | Database migrations and Edge Functions backing the jobs app |

## Personal site

Static HTML and CSS with no build step. Open `index.html` locally, or deploy the
repository root as-is.

## Opportunity Desk (`jobs-app/`)

```bash
cd jobs-app
npm install
cp .env.example .env.local   # fill in your Supabase project values
npm run dev                  # http://localhost:5173
npm test                     # unit tests
npm run build                # type-check and production build
npm run format               # Prettier
```

Architecture, delivery history and the roadmap live in
[`jobs-app/DEVELOPER.md`](jobs-app/DEVELOPER.md).

## Supabase

Migrations are in `supabase/migrations/` and Edge Functions in
`supabase/functions/`. Apply them with the Supabase CLI:

```bash
supabase db push
supabase functions deploy tailor-cv
supabase functions deploy send-reminders
```

Secrets used by the functions: `OPENAI_API_KEY`, `SUPABASE_SECRET_KEY`, and
optionally `OPENAI_MODEL`, `AI_DAILY_LIMIT`, `ALLOWED_ORIGINS`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Continuous integration runs tests,
type-check and the production build on every pull request.

## License

[MIT](LICENSE)
