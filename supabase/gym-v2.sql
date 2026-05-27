-- Valle OS · Gym v2 (migración aditiva)
-- Horario semanal + cardio/carrera + asegura columnas de tracking.
-- Corre esto en el SQL Editor de Supabase. NO borra datos existentes.

create extension if not exists "uuid-ossp";

-- Asegura columnas de tracking (por si gym-tracking.sql no se corrió → es la causa
-- de que las series no se guarden: el insert falla en silencio sin estas columnas).
alter table workout_exercises
  add column if not exists tracking_type text not null default 'strength'
    check (tracking_type in ('strength', 'timed', 'bodyweight'));
alter table workout_exercises
  add column if not exists target_duration_seconds integer;
alter table workout_sets
  add column if not exists duration_seconds integer;

-- Horario semanal: qué día(s) de rutina tocan cada día de la semana.
-- weekday usa convención JS (0=Domingo … 6=Sábado).
-- Varias filas en el mismo weekday = varias rutinas ese día (ej. Upper + Abdomen).
-- Sin filas para un weekday = descanso.
create table if not exists workout_schedule (
  id uuid primary key default uuid_generate_v4(),
  weekday int not null check (weekday between 0 and 6),
  day_id uuid not null references workout_days(id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- Cardio / carrera. Serie propia, separada de las pesas.
create table if not exists cardio_sessions (
  id uuid primary key default uuid_generate_v4(),
  date date not null default current_date,
  activity text not null default 'run',  -- run, walk, bike, swim, row, other
  distance_km numeric(6,2),
  duration_minutes int,
  avg_hr int,
  elevation_m int,
  calories int,
  notes text,
  created_at timestamptz default now()
);

-- Meta de carrera (fila única). Objetivo semanal + carrera objetivo (ej. 10K).
create table if not exists cardio_goal (
  id int primary key default 1,
  weekly_km_target numeric(6,2),
  race_distance_km numeric(6,2),
  race_date date,
  updated_at timestamptz default now(),
  constraint cardio_goal_singleton check (id = 1)
);

create index if not exists idx_workout_schedule_weekday on workout_schedule (weekday, sort_order);
create index if not exists idx_workout_schedule_day on workout_schedule (day_id);
create index if not exists idx_cardio_sessions_date on cardio_sessions (date desc);

alter table workout_schedule enable row level security;
alter table cardio_sessions enable row level security;
alter table cardio_goal enable row level security;

do $$
declare
  tbl text;
  tables text[] := array['workout_schedule','cardio_sessions','cardio_goal'];
  rol text;
  roles text[] := array['authenticated','anon'];
begin
  foreach tbl in array tables loop
    foreach rol in array roles loop
      execute format(
        'drop policy if exists "Allow %s" on %I',
        case when rol = 'authenticated' then 'all for authenticated' else 'anon' end, tbl
      );
      execute format(
        'create policy "Allow %s" on %I for all to %I using (true) with check (true)',
        case when rol = 'authenticated' then 'all for authenticated' else 'anon' end, tbl, rol
      );
    end loop;
  end loop;
end $$;
