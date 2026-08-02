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

The schema is prepared for immutable email-send history. Google integrations and AI tailoring follow after the tracker, CV workflow, and keyless public job search are verified.

## Local development

Copy `.env.example` to `.env.local`, add the public Supabase project URL and publishable key, then run:

```sh
npm install
npm run dev
```

The service-role key and third-party API secrets must never be placed in the browser environment.

The Find jobs view uses the public, keyless Remotive and Arbeitnow feeds. Every result opens the provider's original listing. Providers such as Adzuna that require private API credentials belong behind a server-side integration and are intentionally not called from the browser.

## Verification

```sh
npm run build
npm audit --audit-level=high
```
