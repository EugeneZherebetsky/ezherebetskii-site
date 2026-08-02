-- Expand the existing synchronized tracker without changing its architecture.

alter table public.jobs
  add column if not exists work_mode text not null default 'unspecified',
  add column if not exists priority text not null default 'medium',
  add column if not exists next_action text,
  add column if not exists job_description text,
  add column if not exists external_job_id text,
  add column if not exists email_recipient text,
  add column if not exists email_subject text,
  add column if not exists email_body text;

alter table public.jobs drop constraint if exists jobs_status_check;

alter table public.jobs
  add constraint jobs_status_check check (
    status in (
      'saved',
      'applied',
      'phone_screen',
      'interviewing',
      'assessment',
      'final_round',
      'offer',
      'accepted',
      'rejected',
      'withdrawn',
      'on_hold',
      'closed'
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'jobs_work_mode_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_work_mode_check
      check (work_mode in ('unspecified', 'remote', 'hybrid', 'onsite'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'jobs_priority_check'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_priority_check
      check (priority in ('low', 'medium', 'high', 'urgent'));
  end if;
end $$;

create index if not exists jobs_user_priority_updated_idx
  on public.jobs (user_id, priority, updated_at desc);

create index if not exists jobs_user_external_source_idx
  on public.jobs (user_id, source, external_job_id)
  where external_job_id is not null;

alter table public.cvs
  add column if not exists original_filename text,
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint,
  add column if not exists plain_text text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cvs_size_bytes_nonnegative'
      and conrelid = 'public.cvs'::regclass
  ) then
    alter table public.cvs
      add constraint cvs_size_bytes_nonnegative
      check (size_bytes is null or size_bytes >= 0);
  end if;
end $$;

create table if not exists public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  default_view text not null default 'dashboard',
  reminders_enabled boolean not null default true,
  reminder_lead_hours integer not null default 24,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint user_settings_default_view_check check (
    default_view in ('dashboard', 'board', 'applications', 'reminders', 'cvs')
  ),
  constraint user_settings_reminder_lead_hours_check check (
    reminder_lead_hours between 0 and 720
  ),
  constraint user_settings_version_positive check (version > 0)
);

create table if not exists public.application_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  cv_id uuid references public.cvs(id) on delete set null,
  sent_at timestamptz not null default now(),
  recipient text not null,
  subject text not null,
  provider text not null default 'gmail',
  provider_message_id text,
  status text not null default 'sent',
  details jsonb not null default '{}'::jsonb,
  constraint application_sends_status_check check (status in ('sent', 'failed'))
);

create index if not exists application_sends_user_sent_at_idx
  on public.application_sends (user_id, sent_at desc);

create index if not exists application_sends_job_id_idx
  on public.application_sends (job_id);

create index if not exists application_sends_cv_id_idx
  on public.application_sends (cv_id)
  where cv_id is not null;

drop trigger if exists user_settings_touch_record on public.user_settings;
create trigger user_settings_touch_record
before update on public.user_settings
for each row execute function private.touch_record();

alter table public.user_settings enable row level security;
alter table public.application_sends enable row level security;

create policy "Users can view own settings"
on public.user_settings for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can create own settings"
on public.user_settings for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update own settings"
on public.user_settings for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can delete own settings"
on public.user_settings for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can view own send history"
on public.application_sends for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can create own send history"
on public.application_sends for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and exists (
    select 1
    from public.jobs
    where jobs.id = application_sends.job_id
      and jobs.user_id = (select auth.uid())
  )
  and (
    cv_id is null
    or exists (
      select 1
      from public.cvs
      where cvs.id = application_sends.cv_id
        and cvs.user_id = (select auth.uid())
    )
  )
);

revoke all on table public.user_settings, public.application_sends from anon;
revoke all on table public.user_settings, public.application_sends from authenticated;
grant select, insert, update, delete on table public.user_settings to authenticated;
grant select, insert on table public.application_sends to authenticated;
grant all on table public.user_settings, public.application_sends to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_settings'
  ) then
    alter publication supabase_realtime add table public.user_settings;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'application_sends'
  ) then
    alter publication supabase_realtime add table public.application_sends;
  end if;
end $$;
