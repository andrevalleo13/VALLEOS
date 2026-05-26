-- ── Tiempo v2 — migración aditiva (no borra datos) ─────────────────────────
-- Vincula cada sesión de tiempo a un cliente de Flouvia para medir el tiempo
-- por cliente. Correr en el SQL Editor de Supabase.

-- Cliente de Flouvia al que se le dedicó la sesión (opcional)
alter table time_logs
  add column if not exists client_id uuid references flouvia_clients(id) on delete set null;

-- Índices para el heatmap, las barras semanales y la distribución
create index if not exists time_logs_started_idx on time_logs (started_at desc);
create index if not exists time_logs_client_idx on time_logs (client_id);
create index if not exists time_logs_category_idx on time_logs (category);
