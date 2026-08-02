-- Prevent the same provider listing from being saved twice for one user.

drop index if exists public.jobs_user_external_source_idx;

-- Preserve every application, but remove the provider identifier from later
-- duplicates so existing databases can install the unique index safely.
with ranked_provider_jobs as (
  select
    id,
    row_number() over (
      partition by user_id, source, external_job_id
      order by created_at, id
    ) as duplicate_number
  from public.jobs
  where source is not null
    and external_job_id is not null
)
update public.jobs as jobs
set external_job_id = null
from ranked_provider_jobs
where jobs.id = ranked_provider_jobs.id
  and ranked_provider_jobs.duplicate_number > 1;

create unique index jobs_user_external_source_idx
  on public.jobs (user_id, source, external_job_id)
  where external_job_id is not null;
