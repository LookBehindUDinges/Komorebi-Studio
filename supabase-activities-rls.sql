begin;

create table if not exists public.activities (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(trim(id)) between 1 and 80),
  name text not null check (length(trim(name)) between 1 and 80),
  parent_id text check (parent_id is null or length(trim(parent_id)) between 1 and 80),
  color text not null default '#52836e' check (color ~ '^#[0-9a-fA-F]{6}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, parent_id) references public.activities (user_id, id) on delete set null
);

create index if not exists activities_user_parent_idx
  on public.activities (user_id, parent_id);

alter table public.activities enable row level security;
alter table public.activities force row level security;

revoke all on public.activities from anon;
grant select, insert, update, delete on public.activities to authenticated;

drop policy if exists "activities_select_own" on public.activities;
create policy "activities_select_own" on public.activities
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "activities_insert_own" on public.activities;
create policy "activities_insert_own" on public.activities
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "activities_update_own" on public.activities;
create policy "activities_update_own" on public.activities
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "activities_delete_own" on public.activities;
create policy "activities_delete_own" on public.activities
  for delete to authenticated using ((select auth.uid()) = user_id);

commit;
