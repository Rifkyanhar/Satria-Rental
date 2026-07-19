-- ============================================================
-- SKEMA DATABASE SATRIA RENTAL
-- Cara pakai: buka project Supabase Anda -> menu "SQL Editor"
-- -> New query -> paste semua isi file ini -> klik Run
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- TABEL UNIT ARMADA ----------
create table if not exists units (
  id uuid primary key default uuid_generate_v4(),
  plat text not null,
  model text not null,
  tahun int,
  status text not null default 'tersedia' check (status in ('tersedia','disewa','perbaikan')),
  lokasi text,
  lat text,
  lng text,
  tracker_brand text,
  last_update date default current_date,
  created_at timestamptz default now()
);

-- ---------- TABEL PENYEWA ----------
create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  nama text not null,
  nik text not null,
  hp text,
  alamat text,
  ktp_foto text,
  selfie_foto text,
  created_at timestamptz default now()
);

-- ---------- TABEL KONTRAK ----------
create table if not exists contracts (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id) on delete set null,
  unit_id uuid references units(id) on delete set null,
  tgl_mulai date,
  tgl_selesai date,
  deposit numeric default 0,
  denda numeric default 0,
  lunas boolean default false,
  signature text,
  created_at timestamptz default now()
);

-- ---------- TABEL BLACKLIST INTERNAL ----------
create table if not exists blacklist (
  id uuid primary key default uuid_generate_v4(),
  nama text not null,
  nik text not null,
  alasan text not null,
  tgl_input date default current_date,
  created_at timestamptz default now()
);

-- ---------- TABEL PENGATURAN (nama usaha, dll) ----------
create table if not exists settings (
  id int primary key default 1,
  business_name text default 'SATRIA RENTAL',
  min_units int default 10,
  constraint single_row check (id = 1)
);
insert into settings (id, business_name, min_units) values (1, 'SATRIA RENTAL', 10)
  on conflict (id) do nothing;

-- ============================================================
-- ROW LEVEL SECURITY
-- Hanya user yang sudah login (staf Satria Rental) yang bisa
-- baca/tulis data. Tidak ada akses publik/anonim ke data.
-- ============================================================
alter table units enable row level security;
alter table customers enable row level security;
alter table contracts enable row level security;
alter table blacklist enable row level security;
alter table settings enable row level security;

create policy "staf login bisa akses units" on units
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "staf login bisa akses customers" on customers
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "staf login bisa akses contracts" on contracts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "staf login bisa akses blacklist" on blacklist
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "staf login bisa akses settings" on settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- STORAGE BUCKET untuk foto KTP, selfie, dan tanda tangan
-- Jalankan bagian ini juga -- atau buat manual lewat menu
-- Storage -> New bucket -> nama: satria-files -> Public: ON
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('satria-files', 'satria-files', true)
  on conflict (id) do nothing;

create policy "staf login bisa upload file" on storage.objects
  for insert with check (bucket_id = 'satria-files' and auth.role() = 'authenticated');
create policy "staf login bisa lihat file" on storage.objects
  for select using (bucket_id = 'satria-files');
create policy "staf login bisa hapus file" on storage.objects
  for delete using (bucket_id = 'satria-files' and auth.role() = 'authenticated');
