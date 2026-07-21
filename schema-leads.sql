-- ============================================================
-- TABEL LEADS (calon klien yang minta demo)
-- Jalankan di SQL Editor Supabase
-- ============================================================
create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  nama text not null,
  email text not null,
  status text not null default 'baru' check (status in ('baru','demo_terkirim','followup_1','followup_2','deal','batal')),
  catatan text,
  last_contacted_at timestamptz,
  created_at timestamptz default now()
);

alter table leads enable row level security;

-- Siapa saja (calon klien, tanpa login) boleh KIRIM/insert data leads baru
create policy "publik bisa daftar demo" on leads
  for insert with check (true);

-- Hanya staf yang login yang boleh LIHAT/ubah data leads
create policy "staf bisa lihat leads" on leads
  for select using (auth.role() = 'authenticated');
create policy "staf bisa update leads" on leads
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "staf bisa hapus leads" on leads
  for delete using (auth.role() = 'authenticated');
