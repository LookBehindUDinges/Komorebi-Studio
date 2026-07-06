begin;

-- Owner-locked public music library.
-- Anyone can read (the tracks are meant to be public), but only the site
-- owner's account can publish/edit/remove tracks. The owner id below is
-- benballard122@gmail.com's Supabase auth uid — replace it if that account
-- ever changes.

create table if not exists public.public_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 120),
  description text check (description is null or length(description) <= 500),
  storage_path text not null unique check (length(trim(storage_path)) between 1 and 300),
  created_at timestamptz not null default now()
);

alter table public.public_tracks enable row level security;
alter table public.public_tracks force row level security;

revoke all on public.public_tracks from anon, authenticated;
grant select on public.public_tracks to anon, authenticated;
grant insert, update, delete on public.public_tracks to authenticated;

drop policy if exists "public_tracks_read_all" on public.public_tracks;
create policy "public_tracks_read_all" on public.public_tracks
  for select to anon, authenticated using (true);

drop policy if exists "public_tracks_owner_insert" on public.public_tracks;
create policy "public_tracks_owner_insert" on public.public_tracks
  for insert to authenticated
  with check ((select auth.uid()) = '009ad202-be4a-415d-b539-707c6e928322');

drop policy if exists "public_tracks_owner_update" on public.public_tracks;
create policy "public_tracks_owner_update" on public.public_tracks
  for update to authenticated
  using ((select auth.uid()) = '009ad202-be4a-415d-b539-707c6e928322')
  with check ((select auth.uid()) = '009ad202-be4a-415d-b539-707c6e928322');

drop policy if exists "public_tracks_owner_delete" on public.public_tracks;
create policy "public_tracks_owner_delete" on public.public_tracks
  for delete to authenticated
  using ((select auth.uid()) = '009ad202-be4a-415d-b539-707c6e928322');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-music', 'public-music', true, 52428800, array['audio/mpeg', 'audio/mp3'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public_music_storage_read" on storage.objects;
create policy "public_music_storage_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'public-music');

drop policy if exists "public_music_storage_owner_insert" on storage.objects;
create policy "public_music_storage_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'public-music' and (select auth.uid()) = '009ad202-be4a-415d-b539-707c6e928322');

drop policy if exists "public_music_storage_owner_update" on storage.objects;
create policy "public_music_storage_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'public-music' and (select auth.uid()) = '009ad202-be4a-415d-b539-707c6e928322')
  with check (bucket_id = 'public-music' and (select auth.uid()) = '009ad202-be4a-415d-b539-707c6e928322');

drop policy if exists "public_music_storage_owner_delete" on storage.objects;
create policy "public_music_storage_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'public-music' and (select auth.uid()) = '009ad202-be4a-415d-b539-707c6e928322');

commit;
