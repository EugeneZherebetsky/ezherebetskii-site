-- Speculative outreach: emails sent directly to leaders at companies of
-- interest, whether or not a role is advertised. The row keeps the exact
-- message that was sent, so the record is evidence rather than a summary.

create table if not exists public.outreach_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company text not null,
  recipient_name text,
  recipient_role text,
  recipient_email text not null,
  contact_id uuid references public.contacts(id) on delete set null,
  cv_id uuid references public.cvs(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  subject text not null,
  body text not null,
  status text not null default 'draft',
  sent_at timestamptz,
  provider text not null default 'gmail',
  provider_message_id text,
  provider_thread_id text,
  attachment_filename text,
  reply_status text not null default 'awaiting',
  replied_at timestamptz,
  follow_up_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  data jsonb not null default '{}'::jsonb,
  constraint outreach_emails_status_check check (status in ('draft', 'sent', 'failed')),
  constraint outreach_emails_reply_status_check check (reply_status in ('awaiting', 'replied', 'no_reply')),
  constraint outreach_emails_sent_requires_timestamp check (status <> 'sent' or sent_at is not null),
  constraint outreach_emails_version_positive check (version > 0)
);

create index if not exists outreach_emails_user_updated_idx
  on public.outreach_emails (user_id, updated_at desc);

create index if not exists outreach_emails_user_status_idx
  on public.outreach_emails (user_id, status, sent_at desc);

create index if not exists outreach_emails_follow_up_idx
  on public.outreach_emails (user_id, follow_up_at)
  where follow_up_at is not null;

create index if not exists outreach_emails_contact_id_idx
  on public.outreach_emails (contact_id)
  where contact_id is not null;

create index if not exists outreach_emails_cv_id_idx
  on public.outreach_emails (cv_id)
  where cv_id is not null;

create index if not exists outreach_emails_job_id_idx
  on public.outreach_emails (job_id)
  where job_id is not null;

-- Once a message has been sent it is a record of what left the mailbox, so
-- the delivered content can never be rewritten. Everything that describes
-- what happened afterwards stays editable.
create or replace function private.freeze_sent_outreach()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status = 'sent' then
    if new.status is distinct from old.status
      or new.subject is distinct from old.subject
      or new.body is distinct from old.body
      or new.recipient_email is distinct from old.recipient_email
      or new.company is distinct from old.company
      or new.sent_at is distinct from old.sent_at
      or new.provider_message_id is distinct from old.provider_message_id
      or new.attachment_filename is distinct from old.attachment_filename
      or new.cv_id is distinct from old.cv_id then
      raise exception 'A sent outreach email cannot be changed. It is the record of the message that was actually delivered.';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function private.freeze_sent_outreach()
from public, anon, authenticated, service_role;

drop trigger if exists outreach_emails_freeze_sent on public.outreach_emails;
create trigger outreach_emails_freeze_sent
before update on public.outreach_emails
for each row execute function private.freeze_sent_outreach();

drop trigger if exists outreach_emails_touch_record on public.outreach_emails;
create trigger outreach_emails_touch_record
before update on public.outreach_emails
for each row execute function private.touch_record();

drop trigger if exists outreach_emails_broadcast_deletion on public.outreach_emails;
create trigger outreach_emails_broadcast_deletion
after delete on public.outreach_emails
for each row execute function private.broadcast_networking_deletion();

alter table public.outreach_emails enable row level security;

create policy "Users can view own outreach emails"
on public.outreach_emails for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can create own outreach emails"
on public.outreach_emails for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and (
    contact_id is null
    or exists (select 1 from public.contacts where contacts.id = outreach_emails.contact_id and contacts.user_id = (select auth.uid()))
  )
  and (
    cv_id is null
    or exists (select 1 from public.cvs where cvs.id = outreach_emails.cv_id and cvs.user_id = (select auth.uid()))
  )
  and (
    job_id is null
    or exists (select 1 from public.jobs where jobs.id = outreach_emails.job_id and jobs.user_id = (select auth.uid()))
  )
);

create policy "Users can update own outreach emails"
on public.outreach_emails for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
  and (
    contact_id is null
    or exists (select 1 from public.contacts where contacts.id = outreach_emails.contact_id and contacts.user_id = (select auth.uid()))
  )
  and (
    cv_id is null
    or exists (select 1 from public.cvs where cvs.id = outreach_emails.cv_id and cvs.user_id = (select auth.uid()))
  )
  and (
    job_id is null
    or exists (select 1 from public.jobs where jobs.id = outreach_emails.job_id and jobs.user_id = (select auth.uid()))
  )
);

create policy "Users can delete own outreach emails"
on public.outreach_emails for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

revoke all on table public.outreach_emails from anon;
revoke all on table public.outreach_emails from authenticated;
grant select, insert, update, delete on table public.outreach_emails to authenticated;
grant all on table public.outreach_emails to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'outreach_emails'
  ) then
    alter publication supabase_realtime add table public.outreach_emails;
  end if;
end $$;

-- Outreach follow-ups join the reminder digest, so the delivery log has to
-- accept them alongside applications and contacts.
alter table public.reminder_deliveries
  drop constraint if exists reminder_deliveries_item_type_check;

alter table public.reminder_deliveries
  add constraint reminder_deliveries_item_type_check
  check (item_type in ('job', 'contact', 'outreach'));
