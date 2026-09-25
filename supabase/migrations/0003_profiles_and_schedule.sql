-- Avatars: each user may write only under media/avatars/<their uid>/
create policy avatars_write on storage.objects for insert
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text);
create policy avatars_update on storage.objects for update
  using (bucket_id = 'media' and (storage.foldername(name))[1] = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text);

-- Calendar queries
create index if not exists schedule_slots_brand_time_idx on schedule_slots(brand_id, scheduled_at);
