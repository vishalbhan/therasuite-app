-- Create the storage bucket for profile photos
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true);

-- Allow authenticated users to upload files to the profile-photos bucket
create policy "Allow authenticated users to upload profile photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-photos' AND
  auth.role() = 'authenticated'
);

-- Allow authenticated users to update their own files
create policy "Allow users to update their own photos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-photos' AND
  owner = auth.uid()
);

-- Allow public access to read profile photos
create policy "Allow public access to profile photos"
on storage.objects for select
to public
using (bucket_id = 'profile-photos');

-- Allow users to delete their own photos
create policy "Allow users to delete their own photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-photos' AND
  owner = auth.uid()
); 