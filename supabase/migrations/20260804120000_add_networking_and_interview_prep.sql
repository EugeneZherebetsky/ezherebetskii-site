-- Add the networking tracker and the interview preparation workspace.

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  company text,
  role_title text,
  email text,
  phone text,
  linkedin_url text,
  relationship text not null default 'other',
  pipeline_stage text not null default 'to_contact',
  job_id uuid references public.jobs(id) on delete set null,
  next_action text,
  next_action_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  data jsonb not null default '{}'::jsonb,
  constraint contacts_relationship_check check (
    relationship in ('recruiter', 'referral', 'hiring_manager', 'colleague', 'friend', 'other')
  ),
  constraint contacts_pipeline_stage_check check (
    pipeline_stage in ('to_contact', 'contacted', 'in_conversation', 'meeting_scheduled', 'dormant', 'closed')
  ),
  constraint contacts_version_positive check (version > 0)
);

create table if not exists public.contact_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  channel text not null default 'other',
  summary text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  data jsonb not null default '{}'::jsonb,
  constraint contact_interactions_channel_check check (
    channel in ('email', 'call', 'linkedin', 'meeting', 'message', 'other')
  ),
  constraint contact_interactions_version_positive check (version > 0)
);

create table if not exists public.star_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  situation text,
  task text,
  action text,
  result text,
  skills text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  data jsonb not null default '{}'::jsonb,
  constraint star_stories_version_positive check (version > 0)
);

create table if not exists public.interview_preps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  research_notes text,
  questions_to_ask text,
  checklist jsonb not null default '{}'::jsonb,
  post_interview_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  data jsonb not null default '{}'::jsonb,
  constraint interview_preps_version_positive check (version > 0),
  constraint interview_preps_job_unique unique (job_id)
);

create index if not exists contacts_user_updated_idx
  on public.contacts (user_id, updated_at desc);

create index if not exists contacts_user_stage_idx
  on public.contacts (user_id, pipeline_stage);

create index if not exists contacts_next_action_idx
  on public.contacts (user_id, next_action_at)
  where next_action_at is not null;

create index if not exists contacts_job_id_idx
  on public.contacts (job_id)
  where job_id is not null;

create index if not exists contact_interactions_user_id_idx
  on public.contact_interactions (user_id);

create index if not exists contact_interactions_contact_occurred_idx
  on public.contact_interactions (contact_id, occurred_at desc);

create index if not exists star_stories_user_updated_idx
  on public.star_stories (user_id, updated_at desc);

create index if not exists interview_preps_user_id_idx
  on public.interview_preps (user_id);

drop trigger if exists contacts_touch_record on public.contacts;
create trigger contacts_touch_record
before update on public.contacts
for each row execute function private.touch_record();

drop trigger if exists contact_interactions_touch_record on public.contact_interactions;
create trigger contact_interactions_touch_record
before update on public.contact_interactions
for each row execute function private.touch_record();

drop trigger if exists star_stories_touch_record on public.star_stories;
create trigger star_stories_touch_record
before update on public.star_stories
for each row execute function private.touch_record();

drop trigger if exists interview_preps_touch_record on public.interview_preps;
create trigger interview_preps_touch_record
before update on public.interview_preps
for each row execute function private.touch_record();

-- Filtered Postgres DELETE subscriptions cannot reliably identify the former
-- owner, so deletions are broadcast on the private per-user channel instead.
create or replace function private.broadcast_networking_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and old.user_id <> (select auth.uid()) then
    raise exception 'Cannot broadcast a deletion for another user';
  end if;

  perform realtime.send(
    jsonb_build_object('table', tg_table_name, 'id', old.id),
    'record_deleted',
    'opportunity-desk:' || old.user_id::text,
    true
  );
  return old;
end;
$$;

revoke execute on function private.broadcast_networking_deletion()
from public, anon, authenticated, service_role;

drop trigger if exists contacts_broadcast_deletion on public.contacts;
create trigger contacts_broadcast_deletion
after delete on public.contacts
for each row execute function private.broadcast_networking_deletion();

drop trigger if exists contact_interactions_broadcast_deletion on public.contact_interactions;
create trigger contact_interactions_broadcast_deletion
after delete on public.contact_interactions
for each row execute function private.broadcast_networking_deletion();

drop trigger if exists star_stories_broadcast_deletion on public.star_stories;
create trigger star_stories_broadcast_deletion
after delete on public.star_stories
for each row execute function private.broadcast_networking_deletion();

drop trigger if exists interview_preps_broadcast_deletion on public.interview_preps;
create trigger interview_preps_broadcast_deletion
after delete on public.interview_preps
for each row execute function private.broadcast_networking_deletion();

alter table public.contacts enable row level security;
alter table public.contact_interactions enable row level security;
alter table public.star_stories enable row level security;
alter table public.interview_preps enable row level security;

create policy "Users can view own contacts"
on public.contacts for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can create own contacts"
on public.contacts for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and (
    job_id is null
    or exists (
      select 1
      from public.jobs
      where jobs.id = contacts.job_id
        and jobs.user_id = (select auth.uid())
    )
  )
);

create policy "Users can update own contacts"
on public.contacts for update
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
)
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and (
    job_id is null
    or exists (
      select 1
      from public.jobs
      where jobs.id = contacts.job_id
        and jobs.user_id = (select auth.uid())
    )
  )
);

create policy "Users can delete own contacts"
on public.contacts for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can view own contact interactions"
on public.contact_interactions for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can create own contact interactions"
on public.contact_interactions for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and exists (
    select 1
    from public.contacts
    where contacts.id = contact_interactions.contact_id
      and contacts.user_id = (select auth.uid())
  )
);

create policy "Users can update own contact interactions"
on public.contact_interactions for update
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
)
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and exists (
    select 1
    from public.contacts
    where contacts.id = contact_interactions.contact_id
      and contacts.user_id = (select auth.uid())
  )
);

create policy "Users can delete own contact interactions"
on public.contact_interactions for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can view own star stories"
on public.star_stories for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can create own star stories"
on public.star_stories for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update own star stories"
on public.star_stories for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can delete own star stories"
on public.star_stories for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can view own interview preparation"
on public.interview_preps for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can create own interview preparation"
on public.interview_preps for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and exists (
    select 1
    from public.jobs
    where jobs.id = interview_preps.job_id
      and jobs.user_id = (select auth.uid())
  )
);

create policy "Users can update own interview preparation"
on public.interview_preps for update
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
)
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and exists (
    select 1
    from public.jobs
    where jobs.id = interview_preps.job_id
      and jobs.user_id = (select auth.uid())
  )
);

create policy "Users can delete own interview preparation"
on public.interview_preps for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

revoke all on table public.contacts, public.contact_interactions, public.star_stories, public.interview_preps from anon;
revoke all on table public.contacts, public.contact_interactions, public.star_stories, public.interview_preps from authenticated;
grant select, insert, update, delete on table public.contacts, public.contact_interactions, public.star_stories, public.interview_preps to authenticated;
grant all on table public.contacts, public.contact_interactions, public.star_stories, public.interview_preps to service_role;

do $$
declare
  tracked_table text;
begin
  foreach tracked_table in array array['contacts', 'contact_interactions', 'star_stories', 'interview_preps'] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tracked_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tracked_table);
    end if;
  end loop;
end $$;
