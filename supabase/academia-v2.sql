-- ── Academia v2 ─────────────────────────────────────────────────────────────
-- Migración aditiva (no borra datos). Correr en Supabase SQL Editor.
-- Añade: historial de semestres usable (cerrar/archivar + promedio general),
-- vínculo materia→semestre, y sincronización de fechas con Google Calendar.

-- Semestres: estado (activo/cerrado), número de semestre y conteo de materias
-- (este último permite el promedio general ponderado por materia incluso para
-- semestres capturados "rápido", sin desglosar materia por materia).
alter table semesters add column if not exists status text not null default 'closed';
alter table semesters add column if not exists term_number int;
alter table semesters add column if not exists course_count int;

do $$ begin
  alter table semesters add constraint semesters_status_chk check (status in ('active', 'closed'));
exception when duplicate_object then null; end $$;

-- Materia → semestre (las materias archivadas conservan su semestre histórico)
alter table academic_courses add column if not exists semester_id uuid references semesters(id) on delete set null;
create index if not exists idx_courses_semester on academic_courses (semester_id);

-- Entregas: hora límite + evento de calendario asociado
alter table assignments add column if not exists due_time time;
alter table assignments add column if not exists calendar_event_id text;

-- Exámenes/componentes: hora del examen + eventos de calendario (examen y bloque de estudio)
alter table grade_components add column if not exists exam_time time;
alter table grade_components add column if not exists calendar_event_id text;
alter table grade_components add column if not exists study_event_id text;

-- Clases: evento recurrente de calendario
alter table class_schedule add column if not exists calendar_event_id text;
