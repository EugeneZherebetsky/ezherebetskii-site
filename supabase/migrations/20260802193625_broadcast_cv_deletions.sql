-- Broadcast CV deletions to only the account that owned the deleted record.

drop policy if exists "Users can receive own Opportunity Desk broadcasts"
on realtime.messages;

create policy "Users can receive own Opportunity Desk broadcasts"
on realtime.messages for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) = 'opportunity-desk:' || (select auth.uid())::text
);

create or replace function private.broadcast_cv_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and old.user_id <> (select auth.uid()) then
    raise exception 'Cannot broadcast a CV deletion for another user';
  end if;

  perform realtime.send(
    jsonb_build_object('id', old.id),
    'cv_deleted',
    'opportunity-desk:' || old.user_id::text,
    true
  );
  return old;
end;
$$;

revoke execute on function private.broadcast_cv_deletion()
from public, anon, authenticated, service_role;

drop trigger if exists cvs_broadcast_deletion on public.cvs;
create trigger cvs_broadcast_deletion
after delete on public.cvs
for each row execute function private.broadcast_cv_deletion();
