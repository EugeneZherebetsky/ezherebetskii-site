create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.jobs
  alter column data set default '{}'::jsonb,
  add column company text not null default '',
  add column role_title text not null default '',
  add column status text not null default 'saved',
  add column location text,
  add column job_url text,
  add column source text,
  add column salary_text text,
  add column contact_name text,
  add column contact_email text,
  add column applied_at date,
  add column next_action_at timestamptz,
  add column notes text,
  add column created_at timestamptz not null default now(),
  add column version integer not null default 1,
  add constraint jobs_status_check check (
    status in ('saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn', 'closed')
  ),
  add constraint jobs_version_positive check (version > 0);

alter table public.cvs
  alter column data set default '{}'::jsonb,
  add column name text not null default 'Untitled CV',
  add column storage_path text,
  add column target_role text,
  add column notes text,
  add column created_at timestamptz not null default now(),
  add column version integer not null default 1,
  add constraint cvs_version_positive check (version > 0);

alter table public.jobs drop constraint jobs_user_id_fkey;
alter table public.jobs
  add constraint jobs_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.cvs drop constraint cvs_user_id_fkey;
alter table public.cvs
  add constraint cvs_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

create index jobs_user_id_idx on public.jobs (user_id);
create index jobs_user_status_idx on public.jobs (user_id, status);
create index jobs_user_updated_at_idx on public.jobs (user_id, updated_at desc);
create index jobs_next_action_idx on public.jobs (user_id, next_action_at)
  where next_action_at is not null;
create index cvs_user_id_idx on public.cvs (user_id);
create index cvs_user_updated_at_idx on public.cvs (user_id, updated_at desc);

create or replace function private.touch_record()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.version = old.version + 1;
  return new;
end;
$$;

revoke execute on function private.touch_record() from public, anon, authenticated;

create trigger jobs_touch_record
before update on public.jobs
for each row execute function private.touch_record();

create trigger cvs_touch_record
before update on public.cvs
for each row execute function private.touch_record();

drop policy if exists "Users manage own jobs" on public.jobs;
drop policy if exists "Users manage own cvs" on public.cvs;

create policy "Users can view own jobs"
on public.jobs for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can create own jobs"
on public.jobs for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update own jobs"
on public.jobs for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can delete own jobs"
on public.jobs for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can view own cvs"
on public.cvs for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can create own cvs"
on public.cvs for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update own cvs"
on public.cvs for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can delete own cvs"
on public.cvs for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

revoke all on table public.jobs, public.cvs from anon;
revoke all on table public.jobs, public.cvs from authenticated;
grant select, insert, update, delete on table public.jobs, public.cvs to authenticated;
grant all on table public.jobs, public.cvs to service_role;
