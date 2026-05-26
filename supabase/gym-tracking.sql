-- Additive migration: tracking type per exercise + duration per set
-- Run in Supabase SQL Editor

ALTER TABLE workout_exercises
  ADD COLUMN IF NOT EXISTS tracking_type text NOT NULL DEFAULT 'strength'
    CHECK (tracking_type IN ('strength', 'timed', 'bodyweight'));

ALTER TABLE workout_exercises
  ADD COLUMN IF NOT EXISTS target_duration_seconds integer;

ALTER TABLE workout_sets
  ADD COLUMN IF NOT EXISTS duration_seconds integer;
