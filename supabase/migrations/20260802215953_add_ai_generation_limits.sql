create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  cv_id uuid references public.cvs(id) on delete set null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'pending',
  model text not null,
  input_tokens integer,
  output_tokens integer,
  error_code text,
  constraint ai_generations_status_check check (status in ('pending', 'completed', 'failed')),
  constraint ai_generations_input_tokens_check check (input_tokens is null or input_tokens >= 0),
  constraint ai_generations_output_tokens_check check (output_tokens is null or output_tokens >= 0)
);

create index ai_generations_user_requested_at_idx
  on public.ai_generations (user_id, requested_at desc);

alter table public.ai_generations enable row level security;

revoke all on table public.ai_generations from anon, authenticated;
grant all on table public.ai_generations to service_role;

create or replace function public.reserve_ai_generation(
  p_user_id uuid,
  p_job_id uuid,
  p_cv_id uuid,
  p_model text,
  p_daily_limit integer default 10
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  generation_id uuid;
  recent_count integer;
begin
  if p_daily_limit < 1 or p_daily_limit > 100 then
    raise exception using errcode = '22023', message = 'AI_DAILY_LIMIT_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  if not exists (
    select 1 from public.jobs where id = p_job_id and user_id = p_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'AI_JOB_NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.cvs where id = p_cv_id and user_id = p_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'AI_CV_NOT_FOUND';
  end if;

  select count(*)::integer into recent_count
  from public.ai_generations
  where user_id = p_user_id
    and requested_at >= now() - interval '24 hours';

  if recent_count >= p_daily_limit then
    raise exception using errcode = 'P0001', message = 'AI_DAILY_LIMIT_REACHED';
  end if;

  insert into public.ai_generations (user_id, job_id, cv_id, model)
  values (p_user_id, p_job_id, p_cv_id, p_model)
  returning id into generation_id;

  return generation_id;
end;
$$;

revoke all on function public.reserve_ai_generation(uuid, uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.reserve_ai_generation(uuid, uuid, uuid, text, integer) to service_role;
