-- Migración aditiva: vincular movimientos materializados a su cargo recurrente.
-- Da idempotencia al cron: un solo financial_entry por (recurring_id, mes).
-- Correr en Supabase SQL Editor.

ALTER TABLE financial_entries
  ADD COLUMN IF NOT EXISTS recurring_id uuid REFERENCES recurring_charges(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS financial_entries_recurring_idx
  ON financial_entries (recurring_id, date);
