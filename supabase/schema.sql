-- Valle OS · Comprehensive Schema
-- Run this in the Supabase SQL Editor
-- ⚠️  This script drops and recreates all tables (safe for fresh setup)

-- Drop old tables in reverse dependency order
drop table if exists goal_milestones cascade;
drop table if exists goals cascade;
drop table if exists custom_pages cascade;
drop table if exists reading_items cascade;
drop table if exists time_logs cascade;
drop table if exists time_blocks cascade;
drop table if exists health_entries cascade;
drop table if exists class_schedule cascade;
drop table if exists assignments cascade;
drop table if exists academic_exams cascade;
drop table if exists academic_courses cascade;
drop table if exists semesters cascade;
drop table if exists brain_notes cascade;
drop table if exists notifications cascade;
drop table if exists shadow_memory cascade;
drop table if exists shadow_cache cascade;
drop table if exists shadow_messages cascade;
drop table if exists shadow_conversations cascade;
drop table if exists flouvia_invoices cascade;
drop table if exists flouvia_projects cascade;
drop table if exists flouvia_followups cascade;
drop table if exists flouvia_contacts cascade;
drop table if exists flouvia_clients cascade;
drop table if exists recurring_charges cascade;
drop table if exists budgets cascade;
drop table if exists net_worth_snapshots cascade;
drop table if exists capital_goals cascade;
drop table if exists financial_entries cascade;
drop table if exists debts cascade;
drop table if exists investments cascade;
drop table if exists credit_cards cascade;
drop table if exists bank_accounts cascade;
drop table if exists habit_completions cascade;
drop table if exists habits cascade;
drop table if exists daily_notes cascade;
drop table if exists priorities cascade;
drop table if exists user_preferences cascade;

-- Also drop old tables from previous schema
drop table if exists paginas cascade;
drop table if exists libros cascade;
drop table if exists metas cascade;
drop table if exists habitos_log cascade;
drop table if exists habitos cascade;
drop table if exists finanzas_transacciones cascade;
drop table if exists shadow_briefings cascade;
drop table if exists flouvia_deals cascade;

-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- ── User preferences (singleton row id=1) ─────────────────────────────────
create table user_preferences (
  id int primary key default 1,
  display_name text not null default 'André',
  vision_primary text not null default '',
  vision_secondary text not null default '',
  vision_metadata text not null default '',
  brief_sections jsonb not null default '["priorities","habits","finances","shadow"]'::jsonb,
  updated_at timestamptz default now()
);
insert into user_preferences (id, display_name) values (1, 'André') on conflict do nothing;

-- ── Daily ──────────────────────────────────────────────────────────────────
create table priorities (
  id uuid primary key default uuid_generate_v4(),
  text text not null,
  date date not null default current_date,
  completed boolean not null default false,
  created_at timestamptz default now()
);

create table daily_notes (
  date date primary key,
  focus text,
  reflection text,
  created_at timestamptz default now()
);

-- ── Habits ─────────────────────────────────────────────────────────────────
create table habits (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  active boolean not null default true,
  sort_order int not null default 0,
  type text not null default 'binary' check (type in ('binary', 'numeric')),
  unit text,
  daily_target numeric,
  color text not null default '#C9A84C',
  icon text,
  freezes_available int not null default 0,
  schedule_days int[] not null default '{1,2,3,4,5,6,7}',
  created_at timestamptz default now()
);

create table habit_completions (
  habit_id uuid not null references habits(id) on delete cascade,
  date date not null default current_date,
  value numeric,
  frozen boolean not null default false,
  primary key (habit_id, date)
);

-- ── Finance ────────────────────────────────────────────────────────────────
create table bank_accounts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null default 'checking',
  bank text,
  currency text not null default 'MXN',
  current_balance numeric(14,2) not null default 0,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table credit_cards (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  bank text,
  last_four text,
  credit_limit numeric(14,2),
  current_balance numeric(14,2) not null default 0,
  statement_day int,
  due_day int,
  apr numeric(5,2),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table investments (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null default 'stocks',
  amount_invested numeric(14,2) not null default 0,
  current_value numeric(14,2) not null default 0,
  currency text not null default 'MXN',
  expected_apy numeric(5,2),
  started_at date,
  matures_at date,
  notes text,
  active boolean not null default true,
  created_at timestamptz default now()
);

create table debts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null default 'personal',
  total_amount numeric(14,2) not null,
  current_balance numeric(14,2) not null,
  monthly_payment numeric(14,2),
  interest_rate numeric(5,2),
  due_day int,
  payoff_date date,
  active boolean not null default true,
  created_at timestamptz default now()
);

create table financial_entries (
  id uuid primary key default uuid_generate_v4(),
  category text not null check (category in ('flouvia_ingreso','gasto_personal','gasto_flouvia','ahorro','inversion')),
  amount numeric(14,2) not null,
  description text,
  date date not null default current_date,
  subcategory text,
  card_id uuid references credit_cards(id) on delete set null,
  payment_method text,
  created_at timestamptz default now()
);

create table capital_goals (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  target_amount numeric(14,2) not null,
  current_amount numeric(14,2) not null default 0,
  description text,
  created_at timestamptz default now()
);

create table net_worth_snapshots (
  id uuid primary key default uuid_generate_v4(),
  date date not null default current_date,
  total_assets numeric(14,2) not null,
  total_debts numeric(14,2) not null,
  net_worth numeric(14,2) not null,
  breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table budgets (
  id uuid primary key default uuid_generate_v4(),
  category text not null,
  subcategory text,
  monthly_limit numeric(14,2) not null,
  alert_threshold numeric(5,2) not null default 80,
  rollover boolean not null default false,
  active boolean not null default true,
  notes text,
  created_at timestamptz default now()
);

create table recurring_charges (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  amount numeric(14,2) not null,
  category text not null,
  subcategory text,
  card_id uuid references credit_cards(id) on delete set null,
  charge_day int,
  active boolean not null default true,
  created_at timestamptz default now()
);

-- ── Flouvia CRM ────────────────────────────────────────────────────────────
create table flouvia_clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  status text not null default 'propuesta' check (status in ('propuesta','activo','pausado','completado')),
  project_value numeric(14,2),
  monthly_value numeric(14,2),
  description text,
  notes text,
  primary_contact_id uuid,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table flouvia_contacts (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references flouvia_clients(id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  notes text,
  created_at timestamptz default now()
);

alter table flouvia_clients add constraint fk_primary_contact
  foreign key (primary_contact_id) references flouvia_contacts(id) on delete set null;

create table flouvia_followups (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references flouvia_clients(id) on delete cascade,
  contact_id uuid references flouvia_contacts(id) on delete set null,
  title text not null,
  notes text,
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz default now()
);

create table flouvia_projects (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references flouvia_clients(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'scoping' check (status in ('scoping','in_progress','review','delivered','cancelled')),
  total_value numeric(14,2),
  estimated_hours numeric(8,2),
  actual_hours numeric(8,2) not null default 0,
  started_at date,
  deadline date,
  delivered_at date,
  created_at timestamptz default now()
);

create table flouvia_invoices (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references flouvia_clients(id) on delete cascade,
  project_id uuid references flouvia_projects(id) on delete set null,
  number text,
  issued_date date not null default current_date,
  due_date date,
  paid_date date,
  status text not null default 'draft' check (status in ('draft','sent','paid','overdue','cancelled')),
  subtotal numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz default now()
);

-- ── Shadow AI ──────────────────────────────────────────────────────────────
create table shadow_conversations (
  id uuid primary key default uuid_generate_v4(),
  title text,
  pinned boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table shadow_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references shadow_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system','tool')),
  parts jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);
create index on shadow_messages (conversation_id, created_at);

create table shadow_cache (
  key text primary key,
  content text not null,
  metadata jsonb,
  generated_at timestamptz default now()
);

create table shadow_memory (
  id uuid primary key default uuid_generate_v4(),
  category text not null default 'general',
  fact text not null,
  importance int not null default 5 check (importance between 1 and 10),
  source_conversation_id uuid references shadow_conversations(id) on delete set null,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz default now()
);

create table notifications (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  body text,
  severity text not null default 'info' check (severity in ('info','warning','error','success')),
  module text,
  href text,
  read boolean not null default false,
  dismissed boolean not null default false,
  created_at timestamptz default now()
);

-- ── Brain / Second Brain ───────────────────────────────────────────────────
create table brain_notes (
  id uuid primary key default uuid_generate_v4(),
  content text not null,
  source text not null default 'manual',
  embedding vector(1536),
  created_at timestamptz default now()
);

create or replace function search_brain_notes(
  query_embedding vector(1536),
  match_count int default 10,
  min_similarity float default 0.5
) returns table (id uuid, content text, created_at timestamptz, similarity float)
language sql stable as $$
  select id, content, created_at,
    1 - (embedding <=> query_embedding) as similarity
  from brain_notes
  where 1 - (embedding <=> query_embedding) >= min_similarity
    and embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ── Academic ───────────────────────────────────────────────────────────────
create table semesters (
  id uuid primary key default uuid_generate_v4(),
  label text not null,
  start_date date,
  end_date date,
  gpa numeric(4,2),
  credits_taken int,
  credits_passed int,
  notes text,
  created_at timestamptz default now()
);

create table academic_courses (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  professor text,
  credits int,
  grade numeric(4,2),
  code text,
  semester text,
  target_grade numeric(4,2) not null default 9.0,
  notes text,
  professor_email text,
  active boolean not null default true,
  color text not null default '#C9A84C',
  created_at timestamptz default now()
);

create table academic_exams (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references academic_courses(id) on delete cascade,
  name text not null,
  date date not null,
  grade numeric(4,2),
  created_at timestamptz default now()
);

create table assignments (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references academic_courses(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  weight numeric(5,2),
  grade numeric(4,2),
  status text not null default 'pending' check (status in ('pending','submitted','graded','late')),
  created_at timestamptz default now()
);

create table class_schedule (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references academic_courses(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  room text,
  created_at timestamptz default now()
);

-- ── Health ─────────────────────────────────────────────────────────────────
create table health_entries (
  id uuid primary key default uuid_generate_v4(),
  date date not null default current_date unique,
  sleep_hours numeric(4,1),
  sleep_quality int check (sleep_quality between 1 and 5),
  weight_kg numeric(5,2),
  calories int,
  protein_g int,
  water_l numeric(4,1),
  workout_minutes int,
  workout_type text,
  mood int check (mood between 1 and 5),
  energy int check (energy between 1 and 5),
  notes text,
  created_at timestamptz default now()
);

-- ── Goals ──────────────────────────────────────────────────────────────────
create table goals (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  category text not null default 'personal',
  description text,
  target_date date,
  progress_type text not null default 'percent' check (progress_type in ('percent','numeric','boolean','milestones')),
  current_value numeric not null default 0,
  target_value numeric,
  unit text,
  image_url text,
  pinned boolean not null default false,
  status text not null default 'active' check (status in ('active','completed','paused','archived')),
  completed_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table goal_milestones (
  id uuid primary key default uuid_generate_v4(),
  goal_id uuid not null references goals(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  done_at timestamptz,
  due_date date,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- ── Time management ────────────────────────────────────────────────────────
create table time_blocks (
  id uuid primary key default uuid_generate_v4(),
  start_time time not null,
  label text not null,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

create table time_logs (
  id uuid primary key default uuid_generate_v4(),
  block_id uuid references time_blocks(id) on delete set null,
  label text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes numeric generated always as (
    case when ended_at is not null
    then extract(epoch from (ended_at - started_at)) / 60
    else null end
  ) stored,
  category text,
  created_at timestamptz default now()
);

-- ── Reading list ───────────────────────────────────────────────────────────
create table reading_items (
  id uuid primary key default uuid_generate_v4(),
  url text not null,
  title text,
  summary text,
  source text,
  type text not null default 'article' check (type in ('article','video','podcast','paper','book','other')),
  estimated_minutes int,
  status text not null default 'pending' check (status in ('pending','reading','done','archived')),
  notes text,
  added_at timestamptz default now(),
  completed_at timestamptz
);

-- ── Custom pages ───────────────────────────────────────────────────────────
create table custom_pages (
  id uuid primary key default uuid_generate_v4(),
  title text not null default 'Sin título',
  emoji text,
  content text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz default now()
);

-- ── Row Level Security ─────────────────────────────────────────────────────
alter table user_preferences enable row level security;
alter table priorities enable row level security;
alter table daily_notes enable row level security;
alter table habits enable row level security;
alter table habit_completions enable row level security;
alter table bank_accounts enable row level security;
alter table credit_cards enable row level security;
alter table investments enable row level security;
alter table debts enable row level security;
alter table financial_entries enable row level security;
alter table capital_goals enable row level security;
alter table net_worth_snapshots enable row level security;
alter table budgets enable row level security;
alter table recurring_charges enable row level security;
alter table flouvia_clients enable row level security;
alter table flouvia_contacts enable row level security;
alter table flouvia_followups enable row level security;
alter table flouvia_projects enable row level security;
alter table flouvia_invoices enable row level security;
alter table shadow_conversations enable row level security;
alter table shadow_messages enable row level security;
alter table shadow_cache enable row level security;
alter table shadow_memory enable row level security;
alter table notifications enable row level security;
alter table brain_notes enable row level security;
alter table semesters enable row level security;
alter table academic_courses enable row level security;
alter table academic_exams enable row level security;
alter table assignments enable row level security;
alter table class_schedule enable row level security;
alter table health_entries enable row level security;
alter table goals enable row level security;
alter table goal_milestones enable row level security;
alter table time_blocks enable row level security;
alter table time_logs enable row level security;
alter table reading_items enable row level security;
alter table custom_pages enable row level security;

-- Allow all operations for authenticated users (personal app, single user)
do $$
declare
  tbl text;
  tables text[] := array[
    'user_preferences','priorities','daily_notes','habits','habit_completions',
    'bank_accounts','credit_cards','investments','debts','financial_entries',
    'capital_goals','net_worth_snapshots','budgets','recurring_charges',
    'flouvia_clients','flouvia_contacts','flouvia_followups','flouvia_projects','flouvia_invoices',
    'shadow_conversations','shadow_messages','shadow_cache','shadow_memory','notifications',
    'brain_notes','semesters','academic_courses','academic_exams','assignments','class_schedule',
    'health_entries','goals','goal_milestones','time_blocks','time_logs','reading_items','custom_pages'
  ];
begin
  foreach tbl in array tables loop
    execute format('create policy "Allow all for authenticated" on %I for all to authenticated using (true) with check (true)', tbl);
  end loop;
end $$;

-- Also allow anon for the service role key usage (server-side rendering)
do $$
declare
  tbl text;
  tables text[] := array[
    'user_preferences','priorities','daily_notes','habits','habit_completions',
    'bank_accounts','credit_cards','investments','debts','financial_entries',
    'capital_goals','net_worth_snapshots','budgets','recurring_charges',
    'flouvia_clients','flouvia_contacts','flouvia_followups','flouvia_projects','flouvia_invoices',
    'shadow_conversations','shadow_messages','shadow_cache','shadow_memory','notifications',
    'brain_notes','semesters','academic_courses','academic_exams','assignments','class_schedule',
    'health_entries','goals','goal_milestones','time_blocks','time_logs','reading_items','custom_pages'
  ];
begin
  foreach tbl in array tables loop
    execute format('create policy "Allow anon" on %I for all to anon using (true) with check (true)', tbl);
  end loop;
end $$;
