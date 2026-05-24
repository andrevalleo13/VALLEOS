-- Valle OS · Gym / Entrenamiento (migración aditiva)
-- Corre esto en el SQL Editor de Supabase. NO borra datos existentes.

create extension if not exists "uuid-ossp";

-- Rutina (ej. "PPL", "Upper/Lower"). Puede haber varias; una activa a la vez.
create table if not exists workout_routines (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  active boolean not null default true,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- Día de la rutina (ej. "Push", "Pull", "Pierna"). day_order define el ciclo.
create table if not exists workout_days (
  id uuid primary key default uuid_generate_v4(),
  routine_id uuid not null references workout_routines(id) on delete cascade,
  name text not null,
  day_order int not null default 0,
  muscle_groups text[] not null default '{}',
  created_at timestamptz default now()
);

-- Ejercicio plantilla dentro de un día.
create table if not exists workout_exercises (
  id uuid primary key default uuid_generate_v4(),
  day_id uuid not null references workout_days(id) on delete cascade,
  name text not null,
  muscle_group text,
  target_sets int not null default 3,
  target_reps text,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- Sesión registrada (un entrenamiento de un día).
create table if not exists workout_sessions (
  id uuid primary key default uuid_generate_v4(),
  date date not null default current_date,
  routine_id uuid references workout_routines(id) on delete set null,
  day_id uuid references workout_days(id) on delete set null,
  day_name text,
  duration_minutes int,
  bodyweight_kg numeric(5,2),
  notes text,
  created_at timestamptz default now()
);

-- Serie registrada (peso x reps). exercise_name denormalizado para sobrevivir ediciones.
create table if not exists workout_sets (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references workout_sessions(id) on delete cascade,
  exercise_id uuid references workout_exercises(id) on delete set null,
  exercise_name text not null,
  muscle_group text,
  set_number int not null default 1,
  weight_kg numeric(6,2),
  reps int,
  rpe numeric(3,1),
  created_at timestamptz default now()
);

create index if not exists idx_workout_days_routine on workout_days (routine_id, day_order);
create index if not exists idx_workout_exercises_day on workout_exercises (day_id, sort_order);
create index if not exists idx_workout_sessions_date on workout_sessions (date desc);
create index if not exists idx_workout_sets_session on workout_sets (session_id);

alter table workout_routines enable row level security;
alter table workout_days enable row level security;
alter table workout_exercises enable row level security;
alter table workout_sessions enable row level security;
alter table workout_sets enable row level security;

do $$
declare
  tbl text;
  tables text[] := array['workout_routines','workout_days','workout_exercises','workout_sessions','workout_sets'];
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

-- Semilla opcional: una rutina Push/Pull/Legs de ejemplo (solo si no hay rutinas).
do $$
declare
  rid uuid;
  push_id uuid; pull_id uuid; legs_id uuid;
begin
  if not exists (select 1 from workout_routines) then
    insert into workout_routines (name, active, sort_order) values ('Push / Pull / Legs', true, 0) returning id into rid;

    insert into workout_days (routine_id, name, day_order, muscle_groups)
      values (rid, 'Push', 0, '{pecho,hombros,triceps}') returning id into push_id;
    insert into workout_days (routine_id, name, day_order, muscle_groups)
      values (rid, 'Pull', 1, '{espalda,trapecio,biceps,antebrazo}') returning id into pull_id;
    insert into workout_days (routine_id, name, day_order, muscle_groups)
      values (rid, 'Pierna', 2, '{cuadriceps,isquios,gluteos,pantorrillas}') returning id into legs_id;

    insert into workout_exercises (day_id, name, muscle_group, target_sets, target_reps, sort_order) values
      (push_id, 'Press banca', 'pecho', 4, '6-10', 0),
      (push_id, 'Press inclinado mancuerna', 'pecho', 3, '8-12', 1),
      (push_id, 'Press militar', 'hombros', 3, '8-10', 2),
      (push_id, 'Elevaciones laterales', 'hombros', 3, '12-15', 3),
      (push_id, 'Fondos / Extensión tríceps', 'triceps', 3, '10-12', 4),
      (pull_id, 'Dominadas', 'espalda', 4, '6-10', 0),
      (pull_id, 'Remo con barra', 'espalda', 4, '8-10', 1),
      (pull_id, 'Jalón al pecho', 'espalda', 3, '10-12', 2),
      (pull_id, 'Curl bíceps barra', 'biceps', 3, '8-12', 3),
      (pull_id, 'Curl martillo', 'antebrazo', 3, '10-12', 4),
      (legs_id, 'Sentadilla', 'cuadriceps', 4, '6-10', 0),
      (legs_id, 'Peso muerto rumano', 'isquios', 3, '8-10', 1),
      (legs_id, 'Prensa', 'cuadriceps', 3, '10-12', 2),
      (legs_id, 'Hip thrust', 'gluteos', 3, '10-12', 3),
      (legs_id, 'Elevación de talones', 'pantorrillas', 4, '12-15', 4);
  end if;
end $$;
