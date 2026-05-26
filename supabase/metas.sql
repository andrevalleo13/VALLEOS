-- Valle OS · Metas (migración aditiva)
-- Corre esto en el SQL Editor de Supabase. NO borra datos existentes.
-- Agrega: vínculo hábito↔meta (qué hábitos sostienen qué meta) y normaliza progress_type.

create extension if not exists "uuid-ossp";

-- Qué hábitos sostienen qué meta (el "motor" de cada meta).
create table if not exists goal_habits (
  goal_id uuid not null references goals(id) on delete cascade,
  habit_id uuid not null references habits(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (goal_id, habit_id)
);

create index if not exists idx_goal_habits_goal on goal_habits (goal_id);
create index if not exists idx_goal_habits_habit on goal_habits (habit_id);

-- Los hitos con fecha ya existen (goal_milestones.due_date). Aseguramos start tracking.
alter table goals add column if not exists started_at date;

-- La app usa 'percentage'; el check original solo permitía 'percent'. Lo ampliamos.
alter table goals drop constraint if exists goals_progress_type_check;
alter table goals add constraint goals_progress_type_check
  check (progress_type in ('percent','percentage','numeric','boolean','milestones'));

alter table goal_habits enable row level security;

do $$
declare
  rol text;
  roles text[] := array['authenticated','anon'];
begin
  foreach rol in array roles loop
    execute format(
      'drop policy if exists "Allow %s" on goal_habits',
      case when rol = 'authenticated' then 'all for authenticated' else 'anon' end
    );
    execute format(
      'create policy "Allow %s" on goal_habits for all to %I using (true) with check (true)',
      case when rol = 'authenticated' then 'all for authenticated' else 'anon' end, rol
    );
  end loop;
end $$;
