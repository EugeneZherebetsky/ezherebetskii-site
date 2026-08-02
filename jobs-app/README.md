# Opportunity Desk

Opportunity Desk is the private, synchronized job-search workspace served at `jobs.ezherebetskii.com`.

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

AI-assisted CV matching and tailoring follows after the Google workflow is verified.

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

## Verification

```sh
npm run build
npm audit --audit-level=high
```
