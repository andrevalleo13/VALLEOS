#!/usr/bin/env node
// Exporta datos de Valle OS a la memoria de Claude.
// Uso: node scripts/sync-memory.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Parse .env.local
const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const idx = line.indexOf('=');
  if (idx > 0 && !line.startsWith('#')) {
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
}

const MEMORY_DIR = path.join(os.homedir(), '.claude/projects/-Users-andrevalleortega-Desktop-ValleOS/memory');
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const today = new Date();
const todayStr = today.toISOString().split('T')[0];
const d30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
const d90 = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function save(filename, content) {
  fs.writeFileSync(path.join(MEMORY_DIR, filename), content, 'utf8');
  console.log(`  ✓ ${filename}`);
}

function frontmatter(name, description) {
  return `---\nname: ${name}\ndescription: "${description}"\nmetadata:\n  type: user\n---\n\n_Último sync: ${todayStr}_\n\n`;
}

async function habits() {
  const [{ data: hs }, { data: cs }] = await Promise.all([
    sb.from('habits').select('*').eq('active', true).order('sort_order'),
    sb.from('habit_completions').select('*').gte('date', d30),
  ]);

  const cMap = {};
  for (const c of cs ?? []) {
    (cMap[c.date] ??= {})[c.habit_id] = c;
  }

  let md = frontmatter('personal-habits', "André's active habits, streaks, and completion rates — synced from Valle OS");
  md += '## Hábitos activos\n\n';

  for (const h of hs ?? []) {
    const sched = h.schedule_days ?? [0,1,2,3,4,5,6];
    let scheduled = 0, completed = 0, streak = 0, streakDone = false;
    const d = new Date(today);

    for (let i = 0; i < 60; i++) {
      const ds = d.toISOString().split('T')[0];
      const dow = d.getDay();
      if (sched.includes(dow)) {
        const c = cMap[ds]?.[h.id];
        const done = c && (c.value > 0 || c.frozen);
        if (i < 30 && ds <= todayStr) { scheduled++; if (done) completed++; }
        if (!streakDone) {
          if (done) streak++;
          else if (ds < todayStr) streakDone = true;
        }
      }
      d.setDate(d.getDate() - 1);
    }

    const pct = scheduled > 0 ? Math.round(100 * completed / scheduled) : 0;
    md += `### ${h.name}\n`;
    md += `- Tipo: ${h.type}${h.daily_target ? ` · meta ${h.daily_target} ${h.unit ?? ''}` : ''}\n`;
    md += `- Días: ${sched.map(d => DAYS[d]).join(', ')}\n`;
    md += `- Últimos 30d: ${completed}/${scheduled} (${pct}%)\n`;
    md += `- Racha actual: ${streak} días\n\n`;
  }
  return md;
}

async function goals() {
  const [{ data: gs }, { data: ms }, { data: links }, { data: habits }, { data: comps }, { data: clients }, { data: projects }] = await Promise.all([
    sb.from('goals').select('*').neq('status', 'completed').neq('status', 'archived').order('sort_order'),
    sb.from('goal_milestones').select('*').order('sort_order'),
    sb.from('goal_habits').select('*'),
    sb.from('habits').select('id, name').eq('active', true),
    sb.from('habit_completions').select('habit_id, date').gte('date', d30).lte('date', todayStr),
    sb.from('flouvia_clients').select('*').order('sort_order'),
    sb.from('flouvia_projects').select('*').order('created_at', { ascending: false }),
  ]);

  const msById = {};
  for (const m of ms ?? []) (msById[m.goal_id] ??= []).push(m);

  const habitName = {};
  for (const h of habits ?? []) habitName[h.id] = h.name;
  const compCount = {};
  for (const c of comps ?? []) compCount[c.habit_id] = (compCount[c.habit_id] ?? 0) + 1;
  const linksByGoal = {};
  for (const l of links ?? []) (linksByGoal[l.goal_id] ??= []).push(l.habit_id);

  let md = frontmatter('goals-flouvia', "André's active goals, milestones, and Flouvia CRM — synced from Valle OS");
  md += '## Metas activas\n\n';

  for (const g of gs ?? []) {
    const hitos = (msById[g.id] ?? []).slice().sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
    const pct = g.progress_type === 'milestones' && hitos.length
      ? Math.round(100 * hitos.filter(m => m.done).length / hitos.length)
      : g.target_value ? Math.round(100 * g.current_value / g.target_value)
      : Math.round(g.current_value);
    md += `### ${g.title}\n`;
    md += `- Categoría: ${g.category} · Estado: ${g.status} · Progreso: ${pct}%\n`;
    if (g.target_value != null) md += `- Medida: ${g.current_value}/${g.target_value} ${g.unit ?? ''}\n`;
    if (g.target_date) md += `- Fecha meta: ${g.target_date}\n`;
    if (g.description) md += `- ${g.description}\n`;
    if (hitos.length) {
      md += `- Hitos (${hitos.filter(m => m.done).length}/${hitos.length}):\n`;
      for (const h of hitos) md += `  - [${h.done ? 'x' : ' '}] ${h.title}${h.due_date ? ` · ${h.due_date}` : ''}\n`;
    }
    const linked = (linksByGoal[g.id] ?? []).map(id => `${habitName[id] ?? '?'} (${Math.round(100 * (compCount[id] ?? 0) / 30)}% 30d)`);
    if (linked.length) md += `- Sostenida por hábitos: ${linked.join(', ')}\n`;
    md += '\n';
  }

  const active = (clients ?? []).filter(c => c.status === 'activo');
  const mrr = active.reduce((s, c) => s + (c.monthly_value ?? 0), 0);
  md += `## Flouvia — CRM\n\n**MRR activo: $${mrr.toLocaleString()} MXN**\n\n`;

  for (const c of clients ?? []) {
    const label = { propuesta: 'Propuesta', activo: 'Activo', pausado: 'Pausado', completado: 'Completado' }[c.status] ?? c.status;
    md += `### ${c.name} [${label}]\n`;
    if (c.monthly_value) md += `- Mensualidad: $${c.monthly_value.toLocaleString()}\n`;
    if (c.project_value) md += `- Valor proyecto: $${c.project_value.toLocaleString()}\n`;
    if (c.description) md += `- ${c.description}\n`;
    const cps = (projects ?? []).filter(p => p.client_id === c.id);
    if (cps.length) md += `- Proyectos: ${cps.map(p => `${p.name} (${p.status})`).join(', ')}\n`;
    md += '\n';
  }
  return md;
}

async function academia() {
  const [{ data: courses }, { data: comps }] = await Promise.all([
    sb.from('academic_courses').select('*').eq('active', true).order('name'),
    sb.from('grade_components').select('*').order('sort_order'),
  ]);

  const compsByCourse = {};
  for (const c of comps ?? []) (compsByCourse[c.course_id] ??= []).push(c);

  const graded = (courses ?? []).filter(c => c.grade != null);
  const gpa = graded.length ? (graded.reduce((s, c) => s + c.grade, 0) / graded.length).toFixed(2) : '—';

  let md = frontmatter('academia-data', "André's Panamericana courses, grades, exams, and absences — synced from Valle OS");
  md += `## Situación académica\n\nGPA actual: **${gpa}** · Materias activas: ${courses?.length ?? 0}\n\n`;

  for (const course of courses ?? []) {
    const risk = course.max_absences
      ? course.absences >= course.max_absences ? 'PELIGRO' : course.absences >= course.max_absences * 0.75 ? 'advertencia' : 'ok'
      : 'ok';
    md += `### ${course.name}${course.code ? ` (${course.code})` : ''}\n`;
    md += `- Calificación: ${course.grade ?? '—'}/10 · Meta: ${course.target_grade}\n`;
    if (course.credits) md += `- Créditos: ${course.credits}\n`;
    md += `- Faltas: ${course.absences}/${course.max_absences ?? '∞'} [${risk}]\n`;
    for (const comp of compsByCourse[course.id] ?? []) {
      const g = comp.grade != null ? `${comp.grade}/10` : 'pendiente';
      const dif = comp.difficulty ? ` dif${comp.difficulty}` : '';
      const date = comp.date ? ` · ${comp.date}` : '';
      md += `- ${comp.name} (${comp.weight}%${dif})${date}: ${g}\n`;
      if (comp.grade == null && comp.study_start_date) md += `  → Estudiar desde: ${comp.study_start_date}\n`;
      if (comp.topics) md += `  → Temas: ${comp.topics}\n`;
    }
    md += '\n';
  }

  const upcoming = (comps ?? [])
    .filter(c => c.kind === 'examen' && c.grade == null && c.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  if (upcoming.length) {
    md += `## Próximos exámenes\n\n`;
    for (const e of upcoming) {
      const course = courses?.find(c => c.id === e.course_id);
      const days = Math.round((new Date(e.date).getTime() - today.getTime()) / 86400000);
      const when = days > 0 ? `en ${days}d` : days === 0 ? 'hoy' : `hace ${-days}d`;
      md += `- **${course?.name ?? '?'}** — ${e.name} · ${e.date} (${when}) · dif ${e.difficulty ?? '?'}/5\n`;
    }
    md += '\n';
  }
  return md;
}

async function gym() {
  const [{ data: routines }, { data: days }, { data: exercises }, { data: sessions }, { data: sets }] = await Promise.all([
    sb.from('workout_routines').select('*'),
    sb.from('workout_days').select('*').order('day_order'),
    sb.from('workout_exercises').select('*').order('sort_order'),
    sb.from('workout_sessions').select('*').gte('created_at', d90 + 'T00:00:00').order('created_at', { ascending: false }),
    sb.from('workout_sets').select('*').gte('created_at', d90 + 'T00:00:00'),
  ]);

  const active = routines?.find(r => r.active);
  const rDays = (days ?? []).filter(d => d.routine_id === active?.id);
  const exByDay = {};
  for (const e of exercises ?? []) (exByDay[e.day_id] ??= []).push(e);

  let md = frontmatter('gym-data', "André's workout routine, exercises, and recent training sessions — synced from Valle OS");
  md += `## Rutina activa: ${active?.name ?? 'Ninguna'}\n\n`;

  for (const day of rDays) {
    md += `### ${day.name} — ${(day.muscle_groups ?? []).join(', ')}\n`;
    for (const e of exByDay[day.id] ?? []) {
      md += `- ${e.name} ${e.target_sets}×${e.target_reps} · ${e.muscle_group}\n`;
    }
    md += '\n';
  }

  const recent = (sessions ?? []).filter(s => s.created_at >= d30 + 'T00:00:00');
  md += `## Sesiones (${recent.length} en 30d · ${sessions?.length ?? 0} en 90d)\n\n`;
  for (const s of recent.slice(0, 8)) {
    const sSets = (sets ?? []).filter(x => x.session_id === s.id);
    const vol = sSets.reduce((sum, x) => sum + (x.weight ?? 0) * (x.reps ?? 0), 0);
    md += `- **${s.created_at.split('T')[0]}** · ${s.day_name ?? 'Libre'} · ${sSets.length} series · ${Math.round(vol / 1000)}k vol\n`;
  }

  const prMap = {};
  for (const s of sets ?? []) {
    if (s.weight != null && s.weight > 0 && (!prMap[s.exercise_name] || s.weight > prMap[s.exercise_name])) {
      prMap[s.exercise_name] = s.weight;
    }
  }
  const prs = Object.entries(prMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (prs.length) {
    md += `\n## PRs recientes (90d)\n\n`;
    for (const [name, w] of prs) md += `- ${name}: ${w}kg\n`;
  }
  return md;
}

async function finances() {
  const [{ data: accounts }, { data: cards }, { data: investments }, { data: entries }, { data: recurring }, { data: capGoals }] = await Promise.all([
    sb.from('bank_accounts').select('*').eq('active', true).order('sort_order'),
    sb.from('credit_cards').select('*').eq('active', true).order('sort_order'),
    sb.from('investments').select('*').eq('active', true),
    sb.from('financial_entries').select('*').gte('date', d30).order('date', { ascending: false }),
    sb.from('recurring_charges').select('*').eq('active', true),
    sb.from('capital_goals').select('*'),
  ]);

  const totalAcc = (accounts ?? []).reduce((s, a) => s + a.current_balance, 0);
  const totalCards = (cards ?? []).reduce((s, c) => s + c.current_balance, 0);
  const totalInv = (investments ?? []).reduce((s, i) => s + i.current_value, 0);
  const net = totalAcc + totalInv - totalCards;

  const thisMonth = todayStr.slice(0, 7) + '-01';
  const monthEntries = (entries ?? []).filter(e => e.date >= thisMonth);
  const income = monthEntries.filter(e => e.category === 'flouvia_ingreso').reduce((s, e) => s + e.amount, 0);
  const expense = monthEntries.filter(e => ['gasto_personal', 'gasto_flouvia'].includes(e.category)).reduce((s, e) => s + e.amount, 0);

  const fmt = n => `$${Math.round(n).toLocaleString()}`;

  let md = frontmatter('finance-data', "André's financial situation, accounts, investments, and expenses — synced from Valle OS");
  md += `## Patrimonio\n\n`;
  md += `- **Patrimonio neto: ${fmt(net)} MXN**\n`;
  md += `- Efectivo/débito: ${fmt(totalAcc)}\n`;
  md += `- Inversiones: ${fmt(totalInv)}\n`;
  md += `- Deuda tarjetas: ${fmt(totalCards)}\n\n`;

  md += `## Este mes (${todayStr.slice(0, 7)})\n\n`;
  md += `- Ingresos: ${fmt(income)}\n`;
  md += `- Gastos: ${fmt(expense)}\n`;
  md += `- Balance: ${fmt(income - expense)}\n\n`;

  md += `## Cuentas\n\n`;
  for (const a of accounts ?? []) {
    md += `- **${a.name}** (${a.bank ?? a.type}): ${fmt(a.current_balance)} ${a.currency}\n`;
  }

  md += `\n## Tarjetas\n\n`;
  for (const c of cards ?? []) {
    const util = c.credit_limit ? `${Math.round(100 * c.current_balance / c.credit_limit)}% uso` : '';
    md += `- **${c.name}**: ${fmt(c.current_balance)} usado`;
    if (c.credit_limit) md += ` / ${fmt(c.credit_limit)} límite (${util})`;
    if (c.statement_balance) md += ` · corte: ${fmt(c.statement_balance)}`;
    if (c.due_day) md += ` · paga día ${c.due_day}`;
    md += '\n';
  }

  if (investments?.length) {
    md += `\n## Inversiones\n\n`;
    for (const inv of investments) {
      const g = inv.current_value - inv.amount_invested;
      const gp = inv.amount_invested ? Math.round(100 * g / inv.amount_invested) : 0;
      md += `- **${inv.name}** (${inv.type}): ${fmt(inv.current_value)} · ${g >= 0 ? '+' : ''}${gp}%\n`;
    }
  }

  if (capGoals?.length) {
    md += `\n## Metas de capital\n\n`;
    for (const g of capGoals) {
      const pct = Math.round(100 * g.current_amount / g.target_amount);
      md += `- **${g.name}**: ${fmt(g.current_amount)} / ${fmt(g.target_amount)} (${pct}%)\n`;
    }
  }

  if (recurring?.length) {
    const total = recurring.reduce((s, r) => s + r.amount, 0);
    md += `\n## Cargos recurrentes (${fmt(total)}/mes)\n\n`;
    for (const r of recurring) md += `- ${r.name}: ${fmt(r.amount)} · día ${r.charge_day ?? '?'}\n`;
  }

  const buckets = {};
  for (const e of (entries ?? []).filter(e => ['gasto_personal', 'gasto_flouvia'].includes(e.category))) {
    buckets[e.subcategory ?? 'otros'] = (buckets[e.subcategory ?? 'otros'] ?? 0) + e.amount;
  }
  const top = Object.entries(buckets).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (top.length) {
    md += `\n## Distribución del gasto (30d)\n\n`;
    for (const [cat, amt] of top) md += `- ${cat}: ${fmt(amt)}\n`;
  }
  return md;
}

async function shadowMemory() {
  const { data } = await sb.from('shadow_memory').select('*').order('importance', { ascending: false });
  if (!data?.length) return null;

  let md = frontmatter('shadow-memory', "Persistent facts Shadow has learned about André — stored in Valle OS");
  md += '## Memoria persistente de Shadow\n\n';

  const byCategory = {};
  for (const m of data) (byCategory[m.category] ??= []).push(m);
  for (const [cat, facts] of Object.entries(byCategory)) {
    md += `### ${cat}\n`;
    for (const f of facts) md += `- ${f.fact}\n`;
    md += '\n';
  }
  return md;
}

function updateIndex(written) {
  const indexPath = path.join(MEMORY_DIR, 'MEMORY.md');
  let content = fs.readFileSync(indexPath, 'utf8');

  const entries = {
    'personal_habits.md': '[Hábitos activos](personal_habits.md) — Hábitos de André, rachas y % cumplimiento',
    'goals_flouvia.md':   '[Metas y Flouvia](goals_flouvia.md) — Metas activas, hitos y CRM Flouvia',
    'academia_data.md':   '[Academia Panamericana](academia_data.md) — Materias, calificaciones, exámenes y faltas',
    'gym_data.md':        '[Gym](gym_data.md) — Rutina de entrenamiento, ejercicios y sesiones recientes',
    'finance_data.md':    '[Finanzas](finance_data.md) — Patrimonio, cuentas, tarjetas y gastos',
    'shadow_memory.md':   '[Memoria de Shadow](shadow_memory.md) — Hechos persistentes aprendidos por Shadow',
  };

  for (const [file, line] of Object.entries(entries)) {
    if (written.includes(file) && !content.includes(file)) {
      content += `- ${line}\n`;
    }
  }
  fs.writeFileSync(indexPath, content, 'utf8');
  console.log('  ✓ MEMORY.md');
}

async function main() {
  console.log('\n🔄 Sincronizando Valle OS → memoria de Claude...\n');

  const [h, g, a, gy, f, sm] = await Promise.all([
    habits(), goals(), academia(), gym(), finances(), shadowMemory(),
  ]);

  const written = [];
  save('personal_habits.md', h); written.push('personal_habits.md');
  save('goals_flouvia.md', g);   written.push('goals_flouvia.md');
  save('academia_data.md', a);   written.push('academia_data.md');
  save('gym_data.md', gy);       written.push('gym_data.md');
  save('finance_data.md', f);    written.push('finance_data.md');
  if (sm) { save('shadow_memory.md', sm); written.push('shadow_memory.md'); }

  updateIndex(written);
  console.log('\n✅ Listo. Claude tiene tu contexto actualizado.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
