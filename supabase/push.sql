-- Migración aditiva: Web Push en background (PWA cerrada).
-- Correr en Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint   text PRIMARY KEY,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Marca para no re-empujar la misma notificación en cada corrida del cron
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS pushed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS notifications_pushable_idx
  ON notifications (pushed, dismissed, created_at);
