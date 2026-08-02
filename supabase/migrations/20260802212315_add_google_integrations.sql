-- Store the public Google OAuth client ID with each user's synchronized settings.
-- Access tokens remain short-lived and in browser memory only.

alter table public.user_settings
  add column if not exists google_client_id text;

alter table public.user_settings
  drop constraint if exists user_settings_google_client_id_format_check;

alter table public.user_settings
  add constraint user_settings_google_client_id_format_check check (
    google_client_id is null
    or google_client_id ~ '^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$'
  );
