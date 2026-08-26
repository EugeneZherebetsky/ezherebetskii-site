-- Reusable CV content blocks. A block is a piece of CV text the user has
-- already written and verified once, so a tailored CV can be assembled from
-- existing material instead of being rewritten for every role. STAR stories
-- remain in their own table and supply the experience evidence.

create table if not exists public.cv_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  block_type text not null default 'achievement',
  title text not null,
  content text not null,
  tags text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  data jsonb not null default '{}'::jsonb,
  constraint cv_blocks_block_type_check check (
    block_type in ('summary', 'skills', 'experience', 'achievement', 'education', 'certification', 'other')
  ),
  constraint cv_blocks_version_positive check (version > 0)
);

create index if not exists cv_blocks_user_updated_idx
  on public.cv_blocks (user_id, updated_at desc);

create index if not exists cv_blocks_user_type_order_idx
  on public.cv_blocks (user_id, block_type, sort_order);

drop trigger if exists cv_blocks_touch_record on public.cv_blocks;
create trigger cv_blocks_touch_record
before update on public.cv_blocks
for each row execute function private.touch_record();

-- Reuses the deletion broadcast added with the networking tables, because
-- filtered Postgres DELETE subscriptions cannot identify the former owner.
drop trigger if exists cv_blocks_broadcast_deletion on public.cv_blocks;
create trigger cv_blocks_broadcast_deletion
after delete on public.cv_blocks
for each row execute function private.broadcast_networking_deletion();

alter table public.cv_blocks enable row level security;

create policy "Users can view own CV blocks"
on public.cv_blocks for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can create own CV blocks"
on public.cv_blocks for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can update own CV blocks"
on public.cv_blocks for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "Users can delete own CV blocks"
on public.cv_blocks for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

revoke all on table public.cv_blocks from anon;
revoke all on table public.cv_blocks from authenticated;
grant select, insert, update, delete on table public.cv_blocks to authenticated;
grant all on table public.cv_blocks to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cv_blocks'
  ) then
    alter publication supabase_realtime add table public.cv_blocks;
  end if;
end $$;
