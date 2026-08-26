-- The previous freeze rule treated send_attempt_id as immutable while a send
-- was in flight, but returning an unsent message to draft has to clear it.
-- The attempt id may now be cleared, and only cleared, as part of that reset.

create or replace function private.freeze_sent_outreach()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status = 'sending' then
    if new.status not in ('sending', 'sent', 'draft') then
      raise exception 'A message being sent can only be recorded as sent or returned to draft.';
    end if;
    if new.subject is distinct from old.subject
      or new.body is distinct from old.body
      or new.recipient_email is distinct from old.recipient_email
      or new.company is distinct from old.company then
      raise exception 'A message being sent cannot be edited until its outcome is recorded.';
    end if;
    if new.send_attempt_id is distinct from old.send_attempt_id
      and not (new.status = 'draft' and new.send_attempt_id is null) then
      raise exception 'The send attempt identifier can only be cleared by returning the message to draft.';
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

    if new.cv_id is distinct from old.cv_id and new.cv_id is not null then
      raise exception 'A sent outreach email cannot be repointed at a different CV.';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.freeze_sent_outreach()
from public, anon, authenticated, service_role;
