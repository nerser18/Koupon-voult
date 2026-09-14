-- ============================================================
-- ארנק שוברים - סכמת מסד נתונים ל-Supabase
-- להריץ במלואו ב-SQL Editor של הפרויקט (ר' README.md, שלב 1)
-- ============================================================

-- טבלת הקופונים/שוברים
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_name text not null,
  title text,
  code text,
  discount_value text,
  expiry_date date,
  category text not null default 'אחר',
  notes text,
  is_used boolean not null default false,
  image_path text,
  created_at timestamptz not null default now()
);

alter table public.coupons enable row level security;

drop policy if exists "select_own_coupons" on public.coupons;
create policy "select_own_coupons" on public.coupons
  for select using (auth.uid() = user_id);

drop policy if exists "insert_own_coupons" on public.coupons;
create policy "insert_own_coupons" on public.coupons
  for insert with check (auth.uid() = user_id);

drop policy if exists "update_own_coupons" on public.coupons;
create policy "update_own_coupons" on public.coupons
  for update using (auth.uid() = user_id);

drop policy if exists "delete_own_coupons" on public.coupons;
create policy "delete_own_coupons" on public.coupons
  for delete using (auth.uid() = user_id);

-- אינדקס לשליפה מהירה לפי תאריך תפוגה
create index if not exists coupons_expiry_idx on public.coupons (expiry_date);

-- ============================================================
-- אחסון תמונות (צילום השובר הפיזי)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('coupon-images', 'coupon-images', false)
on conflict (id) do nothing;

drop policy if exists "select_own_images" on storage.objects;
create policy "select_own_images" on storage.objects
  for select using (
    bucket_id = 'coupon-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "insert_own_images" on storage.objects;
create policy "insert_own_images" on storage.objects
  for insert with check (
    bucket_id = 'coupon-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "delete_own_images" on storage.objects;
create policy "delete_own_images" on storage.objects
  for delete using (
    bucket_id = 'coupon-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
