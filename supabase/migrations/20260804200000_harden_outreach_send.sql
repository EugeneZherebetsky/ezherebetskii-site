-- Two corrections to speculative outreach.
--
-- 1. A send attempt is now persisted before Gmail is called. Recording the
--    provider id only after a successful response left a window in which
--    Gmail could accept the message while the response was lost: the row
--    stayed an ordinary draft, so pressing Send again delivered a duplicate,
--    and another device could edit the draft between the two events.
--
-- 2. The freeze trigger rejected the cv_id change that the foreign key's
--    ON DELETE SET NULL performs, which rolled back the whole CV deletion.
--    Deleting any CV ever attached to outreach therefore failed.

alter table public.outreach_emails
  add column if not exists send_attempt_id uuid,
  add column if not exists send_attempted_at timestamptz;

alter table public.outreach_emails
  drop constraint if exists outreach_emails_status_check;

alter table public.outreach_emails
  add constraint outreach_emails_status_check
  check (status in ('draft', 'sending', 'sent', 'failed'));

alter table public.outreach_emails
  drop constraint if exists outreach_emails_sending_requires_attempt;

alter table public.outreach_emails
  add constraint outreach_emails_sending_requires_attempt
  check (status <> 'sending' or (send_attempt_id is not null and send_attempted_at is not null));

create index if not exists outreach_emails_in_flight_idx
  on public.outreach_emails (user_id, send_attempted_at desc)
  where status = 'sending';

create or replace function private.freeze_sent_outreach()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- While a send is in flight the message must not change on any device, and
  -- it may only resolve to sent or back to draft.
  if old.status = 'sending' then
    if new.status not in ('sending', 'sent', 'draft') then
      raise exception 'A message being sent can only be recorded as sent or returned to draft.';
    end if;
    if new.subject is distinct from old.subject
      or new.body is distinct from old.body
      or new.recipient_email is distinct from old.recipient_email
      or new.company is distinct from old.company
      or new.send_attempt_id is distinct from old.send_attempt_id then
      raise exception 'A message being sent cannot be edited until its outcome is recorded.';
    end if;
    return new;
  end if;

  if old.status = 'sent' then
    if new.status is distinct from old.status
      or new.subject is distinct from old.subject
      or new.body is distinct from old.body
      or new.recipient_email is distinct from old.recipient_email
      or new.company is distinct from old.company
      or new.sent_at is distinct from old.sent_at
      or new.provider_message_id is distinct from old.provider_message_id
      or new.attachment_filename is distinct from old.attachment_filename then
      raise exception 'A sent outreach email cannot be changed. It is the record of the message that was actually delivered.';
    end if;

    -- Deleting a CV nulls this reference through ON DELETE SET NULL. Allow
    -- that, since the CV genuinely no longer exists and attachment_filename
    -- still records what was sent, but never allow it to point elsewhere.
    if new.cv_id is distinct from old.cv_id and new.cv_id is not null then
      raise exception 'A sent outreach email cannot be repointed at a different CV.';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.freeze_sent_outreach()
from public, anon, authenticated, service_role;
