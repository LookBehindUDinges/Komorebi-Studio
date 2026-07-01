begin;

create extension if not exists pgcrypto;

create table if not exists public.practice_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity text not null check (length(trim(activity)) between 1 and 80),
  subcategory text check (subcategory is null or length(trim(subcategory)) between 1 and 80),
  minutes integer not null check (minutes between 1 and 1440),
  logged_at timestamptz not null default now(),
  notes text check (notes is null or length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.weekly_goals (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity text not null check (length(trim(activity)) between 1 and 80),
  target_minutes integer not null check (target_minutes between 1 and 10080),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, activity)
);

create index if not exists practice_logs_user_logged_at_idx
  on public.practice_logs (user_id, logged_at desc);

alter table public.practice_logs enable row level security;
alter table public.practice_logs force row level security;
alter table public.weekly_goals enable row level security;
alter table public.weekly_goals force row level security;

revoke all on public.practice_logs from anon;
revoke all on public.weekly_goals from anon;
grant select, insert, update, delete on public.practice_logs to authenticated;
grant select, insert, update, delete on public.weekly_goals to authenticated;

drop policy if exists "practice_logs_select_own" on public.practice_logs;
create policy "practice_logs_select_own" on public.practice_logs
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "practice_logs_insert_own" on public.practice_logs;
create policy "practice_logs_insert_own" on public.practice_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "practice_logs_update_own" on public.practice_logs;
create policy "practice_logs_update_own" on public.practice_logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "practice_logs_delete_own" on public.practice_logs;
create policy "practice_logs_delete_own" on public.practice_logs
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "weekly_goals_select_own" on public.weekly_goals;
create policy "weekly_goals_select_own" on public.weekly_goals
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "weekly_goals_insert_own" on public.weekly_goals;
create policy "weekly_goals_insert_own" on public.weekly_goals
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "weekly_goals_update_own" on public.weekly_goals;
create policy "weekly_goals_update_own" on public.weekly_goals
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "weekly_goals_delete_own" on public.weekly_goals;
create policy "weekly_goals_delete_own" on public.weekly_goals
  for delete to authenticated using ((select auth.uid()) = user_id);

commit;
