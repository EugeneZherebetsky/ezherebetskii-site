-- Link each opportunity to the CV used for it and record who a CV was tailored for.

alter table public.cvs
  add column if not exists tailored_company text;

alter table public.jobs
  add column if not exists cv_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'jobs_cv_id_fkey'
      and conrelid = 'public.jobs'::regclass
  ) then
    alter table public.jobs
      add constraint jobs_cv_id_fkey
      foreign key (cv_id)
      references public.cvs(id)
      on delete set null;
  end if;
end $$;

create index if not exists jobs_cv_id_idx
  on public.jobs (cv_id)
  where cv_id is not null;

drop policy if exists "Users can create own jobs" on public.jobs;
drop policy if exists "Users can update own jobs" on public.jobs;

create policy "Users can create own jobs"
on public.jobs for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and (
    cv_id is null
    or exists (
      select 1
      from public.cvs
      where cvs.id = jobs.cv_id
        and cvs.user_id = (select auth.uid())
    )
  )
);

create policy "Users can update own jobs"
on public.jobs for update
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
)
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and (
    cv_id is null
    or exists (
      select 1
      from public.cvs
      where cvs.id = jobs.cv_id
        and cvs.user_id = (select auth.uid())
    )
  )
);
