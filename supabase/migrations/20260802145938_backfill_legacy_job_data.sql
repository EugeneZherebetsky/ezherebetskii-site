update public.jobs
set
  company = coalesce(nullif(data->>'company', ''), 'Company not specified'),
  role_title = coalesce(nullif(data->>'role', ''), 'Role not specified'),
  status = case lower(coalesce(data->>'status', ''))
    when 'wishlist' then 'saved'
    when 'saved' then 'saved'
    when 'applied' then 'applied'
    when 'interview' then 'interviewing'
    when 'interviewing' then 'interviewing'
    when 'offer' then 'offer'
    when 'rejected' then 'rejected'
    when 'withdrawn' then 'withdrawn'
    when 'closed' then 'closed'
    else 'saved'
  end,
  location = nullif(data->>'location', ''),
  job_url = nullif(data->>'url', ''),
  source = nullif(data->>'source', ''),
  salary_text = nullif(data->>'salary', ''),
  contact_name = nullif(data->>'contact', ''),
  contact_email = nullif(data->>'email', ''),
  applied_at = case
    when coalesce(data->>'applied', '') ~ '^\d{4}-\d{2}-\d{2}$' then (data->>'applied')::date
    else null
  end,
  next_action_at = case
    when coalesce(data->>'nextDate', '') ~ '^\d{4}-\d{2}-\d{2}' then (data->>'nextDate')::timestamptz
    else null
  end,
  notes = nullif(data->>'notes', '')
where company = '' or role_title = '';
