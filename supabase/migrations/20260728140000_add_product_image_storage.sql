-- Lets admins upload/manage a photo per material (product). Bucket rows live
-- in storage.buckets, a regular Postgres table, so the bucket is provisioned
-- here the same way as the rest of the schema instead of a manual dashboard
-- step. storage.objects already has RLS enabled by Supabase out of the box.

alter table public.products add column image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "admins manage product images" on storage.objects for all to authenticated
  using (bucket_id = 'product-images' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (bucket_id = 'product-images' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
