-- ── Salud v2 — migración aditiva (no borra datos) ──────────────────────────
-- 1) Peso como serie propia: André no se pesa a diario, así que el peso vive en
--    su propia tabla y solo se registra cuando se mide. El "peso actual" es el
--    último registro (persiste/estático), y la tendencia sale de mediciones
--    esporádicas.
-- 2) Sueño más detallado + métricas que pueden venir de Apple Salud (pasos, FC
--    en reposo, calorías activas, hora de dormir/despertar).
-- Correr en el SQL Editor de Supabase.

create table if not exists weight_logs (
  id uuid primary key default uuid_generate_v4(),
  date date not null default current_date unique,
  weight_kg numeric(5,2) not null,
  body_fat_pct numeric(4,1),
  muscle_kg numeric(5,2),
  notes text,
  source text default 'manual',
  created_at timestamptz default now()
);

create index if not exists weight_logs_date_idx on weight_logs (date desc);

-- Métricas extra del día (muchas pueden venir de Apple Salud)
alter table health_entries
  add column if not exists steps int,
  add column if not exists resting_hr int,
  add column if not exists active_calories int,
  add column if not exists bedtime time,
  add column if not exists wake_time time,
  add column if not exists source text default 'manual';

create index if not exists health_entries_date_idx on health_entries (date desc);

-- RLS abierto (single-user, mismo patrón que el resto del schema)
alter table weight_logs enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'weight_logs' and policyname = 'Allow anon'
  ) then
    execute 'create policy "Allow anon" on weight_logs for all to anon using (true) with check (true)';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'weight_logs' and policyname = 'Allow all for authenticated'
  ) then
    execute 'create policy "Allow all for authenticated" on weight_logs for all to authenticated using (true) with check (true)';
  end if;
end $$;
