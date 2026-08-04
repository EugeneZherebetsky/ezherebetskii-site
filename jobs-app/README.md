# Opportunity Desk

Opportunity Desk is the private, synchronized job-search workspace served at `jobs.ezherebetskii.com`.

For architecture, completed phases, migration guidance, review lessons, and the recommended roadmap, see [DEVELOPER.md](./DEVELOPER.md).

## Architecture

The rebuild keeps the existing architecture:

- React and Vite for the browser application
- Supabase Auth, Postgres, Realtime, and Storage for private synchronized data
- GitHub for version control and pull-request review
- Cloudflare Pages for deployment

Supabase remains the only source of truth. Users sign in on a device; they never enter a database URL or key.

## Current rebuild phase

This phase restores and improves:

- dashboard metrics and pipeline overview
- Kanban-style application board
- searchable and filterable application table
- granular stages, priority, work style, contacts, job description, follow-ups, and email drafts
- synchronized reminders and preferences
- browser notifications while the application is open
- JSON backup/restore and CSV export
- optimistic locking so concurrent edits are not silently lost
- private CV file uploads, text-only CV versions, editing, download, and deletion
- live CV library refresh across signed-in devices
- tailored-company details and a synchronized CV link on each application
- native board drag-and-drop for CV assignment, with a mobile and keyboard-friendly selector
- live Remotive and Arbeitnow vacancy search with one-click synchronized saving
- duplicate protection for provider listings, including simultaneous saves from two devices
- Google Calendar events for scheduled application follow-ups
- Gmail sending with the linked private CV attached and immutable synchronized send history
- local CV-to-job keyword matching and best-version ranking
- protected AI-assisted CV and cover-letter drafting with strict structured output
- editable tailored CV versions that retain the complete source CV, preserve the original version, and link back to the application
- a private per-user generation ledger and rolling 24-hour usage limit
- a networking tracker: contacts with relationship types, their own pipeline, logged interactions, opportunity links, and follow-up reminders
- an interview preparation workspace: a reusable STAR story library, likely topics derived locally from the job description, story ranking, a preparation checklist, research notes, and post-interview notes
- immutable application-stage history recorded by a database trigger, with synthetic backfills excluded from duration metrics
- a counts-first Analytics view: applications per week, response and interview rates, a stage funnel, median time to first response, results by source and CV version, and overdue follow-ups
- opt-in server-delivered email reminders: an hourly scheduled function sends one timezone-aware daily digest of newly due application and networking follow-ups, deduplicated so nothing is emailed twice

The active phase is analytics and server reminders. Professional PDF/DOCX CV output is deferred — CVs and cover letters are produced in separate tools. The next phase is saved searches with a daily vacancy digest.

Email reminders use Resend on the server. Configure `RESEND_API_KEY` and `REMINDER_CRON_SECRET` under **Supabase Dashboard → Edge Functions → Secrets**, and create a Vault secret named `reminder_cron_secret` with the same value as `REMINDER_CRON_SECRET` so the hourly pg_cron job can authenticate to the `send-reminders` function. Without a verified sending domain, Resend's default `onboarding@resend.dev` sender only delivers to the Resend account owner's address.

## Local development

Copy `.env.example` to `.env.local`, add the public Supabase project URL and publishable key, then run:

```sh
npm install
npm run dev
```

The service-role key and third-party API secrets must never be placed in the browser environment.

The Find jobs view uses the public, keyless Remotive and Arbeitnow feeds. Every result opens the provider's original listing. Providers such as Adzuna that require private API credentials belong behind a server-side integration and are intentionally not called from the browser.

## Google setup

Calendar and Gmail use Google Identity Services' browser token model. The site stores only the public OAuth client ID in synchronized settings; short-lived Google access tokens remain in browser memory and are never written to Supabase.

1. Create or open a project in Google Cloud Console.
2. Enable Google Calendar API and Gmail API.
3. Configure the OAuth consent screen. Add your own Google address as a test user while the app remains in testing.
4. Create an OAuth client ID for a Web application.
5. Add `https://jobs.ezherebetskii.com` and any preview or local origins you use as authorized JavaScript origins.
6. Paste the client ID into Opportunity Desk Settings, save it, and select Connect Google.

Google authorization expires periodically by design. Calendar or Gmail actions will ask you to reconnect when a fresh token is required.

If Gmail accepts a message while the database is temporarily unavailable, Opportunity Desk keeps the message ID in a per-user browser retry queue. Use **Retry history sync** to record the existing message after connectivity returns; the retry never sends the email again.

## AI tailoring setup

Keyword matching runs entirely in the browser and does not use a paid API. The optional **Tailor with AI** action calls the protected `tailor-cv` Supabase Edge Function. It verifies the signed-in user, reads only that user's application and CV through row-level security, and keeps the OpenAI key on the server.

Add `OPENAI_API_KEY` under **Supabase Dashboard → Edge Functions → Secrets** before using AI generation. Optional server-side settings are `OPENAI_MODEL` (defaults to `gpt-5.6-sol`), `AI_DAILY_LIMIT` (defaults to 10 requests per rolling 24 hours), and `ALLOWED_ORIGINS` (a comma-separated list of additional browser origins).

The function sends requests with storage disabled and asks OpenAI for a strict JSON result. Every generated summary, bullet, and cover letter must still be checked against the original CV before use. Saving creates a new text CV version; it never overwrites the source CV.

## Verification

```sh
npm test
npm run build
npm audit --audit-level=high
```
