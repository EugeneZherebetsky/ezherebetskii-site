# Opportunity Desk

Opportunity Desk is the private, synchronized job-search workspace served at `jobs.ezherebetskii.com`. You sign in once on any device and see the same applications, CVs, contacts, interview preparation, reminders, and history.

For architecture rules, delivery history, migration guidance, review lessons, and the improvement roadmap, see [DEVELOPER.md](./DEVELOPER.md).

## Architecture

- React and Vite for the browser application
- Supabase Auth, Postgres, Realtime, and Storage for private synchronized data
- Supabase Edge Functions for work that needs private API keys
- pg_cron for scheduled server work
- GitHub for version control and pull-request review
- Cloudflare Pages for deployment

Supabase remains the only source of truth. You sign in on a device; you never enter a database URL or key.

## The workspace

| View | What it is for |
|---|---|
| Dashboard | Pipeline metrics and the next actions that need attention. |
| Board | Kanban columns covering every status, with drag-and-drop CV assignment. |
| Applications | Searchable, filterable table of every opportunity with inline actions. |
| Reminders | Application and networking follow-ups due soon, newest first. |
| Network | Contacts, their own outreach pipeline, and logged interactions. |
| Interviews | Upcoming interviews, per-application preparation, and the STAR story library. |
| Analytics | Weekly effort, conversion funnel, response times, and what is actually working. |
| CV library | Private CV files and text versions with tailoring metadata. |
| Find jobs | Live Remotive and Arbeitnow vacancy search with one-click saving. |
| Backup | JSON backup/restore and CSV export of applications. |
| Settings | Preferences, timezone, reminders, and the public Google client ID. |

Every view is reachable on mobile through the horizontal navigation strip.

## What it does

### Opportunity tracking

- Granular stages from saved through applied, interview stages, offer, and closed outcomes.
- Priority, work style, location, salary, source, contacts, job description, notes, and dates.
- Kanban board and a searchable table, both representing every status.
- Optimistic locking so two devices cannot silently overwrite each other.
- Browser notifications for due follow-ups while the app is open.
- JSON backup/restore and CSV export of applications.

### CV library and tailoring

- Private PDF, DOC, DOCX, TXT, and RTF uploads up to 10 MB, plus text-only CV versions.
- Each application records which CV was used; the database verifies you own that CV.
- Drag a CV onto a board card, or use the keyboard- and mobile-friendly selector.
- Free local keyword matching ranks your CV versions against a job description.
- Optional AI drafting produces a tailored summary, highlights, and cover letter through a protected Edge Function; every saved version keeps the complete source CV and stays editable.

### Job search

- Live Remotive and Arbeitnow feeds, no API keys required.
- Pagination, readable publication dates, and one-click synchronized saving.
- Duplicate protection per provider listing, even when two devices save at once.

### Google Calendar and Gmail

- Calendar events created from an application's follow-up details.
- Gmail sending with the linked private CV attached and immutable send history.
- Google access tokens stay in browser memory and never reach the database.

### Networking

- Contacts with relationship type, company, role, and contact details.
- An outreach pipeline separate from application status: to contact, contacted, in conversation, meeting scheduled, dormant, closed.
- Logged interactions per contact, and optional links to a specific opportunity.
- Networking follow-ups appear alongside application follow-ups in Reminders.

### Interview preparation

- A reusable STAR story library of verified examples.
- Applications at interview stages become upcoming interviews automatically.
- Likely topics derived locally from the job description, and your most relevant STAR stories ranked against it.
- Per-application research notes, questions to ask, a preparation checklist, and post-interview notes.

### Analytics

- Applications per week, response and interview rates, and a conversion funnel.
- Median time from applying to a first response, measured only from history recorded live.
- Results by source and by CV version, plus overdue follow-up counts.
- Percentages always appear with their underlying counts. These are your own numbers, not predictions.

### Reminders that reach you when the app is closed

- Opt-in daily email digest of newly due application and networking follow-ups.
- Delivered at an hour you choose, interpreted in your saved timezone.
- Deduplicated so a single due action is never emailed twice.

## Local development

Copy `.env.example` to `.env.local`, add the public Supabase project URL and publishable key, then run:

```sh
npm install
npm run dev
```

The service-role key and third-party API secrets must never be placed in the browser environment. Only variables prefixed with `VITE_` reach the browser build.

The Find jobs view uses the public, keyless Remotive and Arbeitnow feeds, and every result opens the provider's original listing. Providers such as Adzuna that require private API credentials belong behind a server-side integration and are intentionally not called from the browser.

## Google setup

Calendar and Gmail use Google Identity Services' browser token model. The site stores only the public OAuth client ID in synchronized settings; short-lived access tokens remain in browser memory.

1. Create or open a project in Google Cloud Console.
2. Enable Google Calendar API and Gmail API.
3. Configure the OAuth consent screen. Add your own Google address as a test user while the app remains in testing.
4. Create an OAuth client ID for a Web application.
5. Add `https://jobs.ezherebetskii.com` and any preview or local origins you use as authorized JavaScript origins.
6. Paste the client ID into Settings, save it, and select Connect Google.

Google authorization expires periodically by design; Calendar and Gmail actions ask you to reconnect when a fresh token is required.

If Gmail accepts a message while the database is temporarily unavailable, Opportunity Desk keeps the message ID in a per-user browser retry queue. Use **Retry history sync** to record that existing message once connectivity returns; the retry never sends the email again.

## AI tailoring setup

Keyword matching runs entirely in the browser and does not use a paid API. The optional **Tailor with AI** action calls the protected `tailor-cv` Edge Function, which verifies the signed-in user, reads only that user's application and CV through row-level security, and keeps the OpenAI key on the server.

Add `OPENAI_API_KEY` under **Supabase Dashboard → Edge Functions → Secrets** before using AI generation. Optional settings are `OPENAI_MODEL` (defaults to `gpt-5.6-sol`), `AI_DAILY_LIMIT` (defaults to 10 requests per rolling 24 hours), and `ALLOWED_ORIGINS` (comma-separated additional browser origins).

Requests are sent with storage disabled and a strict JSON schema. Every generated summary, bullet, and cover letter must still be checked against the original CV before use. Saving creates a new text CV version; it never overwrites the source CV.

## Email reminder setup

Reminder digests are sent by the `send-reminders` Edge Function, which pg_cron invokes hourly. The function decides per user whether the local delivery hour matches and what is newly due, so nothing is sent when nothing is due.

1. Create a [Resend](https://resend.com) account and generate an API key.
2. Under **Supabase Dashboard → Edge Functions → Secrets**, add `RESEND_API_KEY` and `REMINDER_CRON_SECRET` (a long random string). `REMINDER_FROM_EMAIL` is optional.
3. Under **Supabase Dashboard → Database → Vault**, add a secret named `reminder_cron_secret` holding the same value as `REMINDER_CRON_SECRET`. The scheduled job reads it at execution time, so no secret is stored in a migration.
4. Deploy the function with `supabase functions deploy send-reminders`.
5. In Settings, enable **Email me due follow-ups** and choose a delivery hour.

Without a verified sending domain, Resend's default `onboarding@resend.dev` sender only delivers to the Resend account owner's own address, which is sufficient for a personal digest.

## Verification

```sh
npm test
npm run build
npm audit --audit-level=high
```
