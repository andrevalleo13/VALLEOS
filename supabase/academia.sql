-- Valle OS · Academia / Panamericana (migración aditiva)
-- Corre esto en el SQL Editor de Supabase. NO borra datos existentes.

create extension if not exists "uuid-ossp";

-- Faltas por materia (counter + límite permitido antes de perder derecho).
alter table academic_courses add column if not exists absences int not null default 0;
alter table academic_courses add column if not exists max_absences int;

-- Esquema de calificación: cada componente del 100% de una materia.
-- Incluye exámenes (con dificultad y desde cuándo estudiar), tareas, proyectos,
-- participación, etc. La calificación de la materia = promedio ponderado por weight.
create table if not exists grade_components (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references academic_courses(id) on delete cascade,
  name text not null,                       -- "Parcial 1", "Proyecto final", "Participación"
  kind text not null default 'otro' check (kind in ('examen','tarea','proyecto','participacion','otro')),
  weight numeric(5,2) not null default 0,   -- % del 100
  grade numeric(5,2),                       -- calificación obtenida 0-10 (null = pendiente)
  date date,                                -- fecha del examen / entrega
  difficulty int check (difficulty between 1 and 5), -- 1 fácil → 5 muy difícil (exámenes)
  study_start_date date,                    -- desde cuándo conviene estudiar
  topics text,                              -- temas a estudiar
  status text not null default 'pending' check (status in ('pending','studying','done')),
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_grade_components_course on grade_components (course_id, sort_order);
create index if not exists idx_grade_components_date on grade_components (date);
create index if not exists idx_class_schedule_course on class_schedule (course_id, day_of_week);

alter table grade_components enable row level security;

do $$
declare
  tbl text;
  tables text[] := array['grade_components'];
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
