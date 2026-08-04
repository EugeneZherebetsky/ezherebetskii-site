-- Record immutable application-stage history so analytics can measure real
-- conversion and durations. Revived from the parked professional-document
-- foundation branch without its CV-artifact scope.

create unique index if not exists jobs_id_user_id_idx
  on public.jobs (id, user_id);

create table public.job_stage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null,
  from_status text,
  to_status text not null,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb,
  constraint job_stage_events_job_owner_fkey
    foreign key (job_id, user_id)
    references public.jobs(id, user_id)
    on delete cascade,
  constraint job_stage_events_from_status_check check (
    from_status is null or from_status in (
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
  ),
  constraint job_stage_events_to_status_check check (
    to_status in (
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
  ),
  constraint job_stage_events_event_type_check check (
    event_type in ('created', 'status_change', 'backfill_current_state')
  )
);

create index job_stage_events_user_occurred_idx
  on public.job_stage_events (user_id, occurred_at desc);

create index job_stage_events_job_occurred_idx
  on public.job_stage_events (job_id, occurred_at);

alter table public.job_stage_events enable row level security;

create policy "Users can view own job stage events"
on public.job_stage_events for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

revoke all on table public.job_stage_events from anon, authenticated;
grant select on table public.job_stage_events to authenticated;
grant all on table public.job_stage_events to service_role;

-- Existing applications only have a trustworthy *current* state. Those
-- synthetic events are explicitly excluded from duration metrics.
insert into public.job_stage_events (
  user_id,
  job_id,
  from_status,
  to_status,
  event_type,
  occurred_at,
  details
)
select
  user_id,
  id,
  null,
  status,
  'backfill_current_state',
  coalesce(updated_at, created_at, now()),
  jsonb_build_object(
    'historical_timestamp_reliable', false,
    'exclude_from_duration_metrics', true
  )
from public.jobs;

create or replace function private.record_job_stage_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_event_type text;
  previous_status text;
  event_time timestamptz;
begin
  if (select auth.uid()) is not null and new.user_id <> (select auth.uid()) then
    raise exception 'Cannot record a job stage event for another user';
  end if;

  if tg_op = 'INSERT' then
    next_event_type := 'created';
    previous_status := null;
    event_time := coalesce(new.created_at, now());
  elsif new.status is distinct from old.status then
    next_event_type := 'status_change';
    previous_status := old.status;
    event_time := now();
  else
    return new;
  end if;

  insert into public.job_stage_events (
    user_id,
    job_id,
    from_status,
    to_status,
    event_type,
    occurred_at,
    details
  )
  values (
    new.user_id,
    new.id,
    previous_status,
    new.status,
    next_event_type,
    event_time,
    jsonb_build_object('historical_timestamp_reliable', true)
  );

  return new;
end;
$$;

revoke execute on function private.record_job_stage_event()
from public, anon, authenticated, service_role;

drop trigger if exists jobs_record_stage_event on public.jobs;
create trigger jobs_record_stage_event
after insert or update of status
on public.jobs
for each row execute function private.record_job_stage_event();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'job_stage_events'
  ) then
    alter publication supabase_realtime add table public.job_stage_events;
  end if;
end $$;
