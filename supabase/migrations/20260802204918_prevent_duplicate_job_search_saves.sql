-- Prevent the same provider listing from being saved twice for one user.

drop index if exists public.jobs_user_external_source_idx;

create unique index jobs_user_external_source_idx
  on public.jobs (user_id, source, external_job_id)
  where external_job_id is not null;
