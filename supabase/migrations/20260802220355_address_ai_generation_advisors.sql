create index ai_generations_job_id_idx
  on public.ai_generations (job_id);

create index ai_generations_cv_id_idx
  on public.ai_generations (cv_id);

create policy "AI generation records are server managed"
  on public.ai_generations
  as restrictive
  for all
  to authenticated
  using (false)
  with check (false);
