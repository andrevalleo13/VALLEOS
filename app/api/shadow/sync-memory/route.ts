import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { NextResponse } from "next/server";

const MEMORY_DIR = join(
  homedir(),
  ".claude/projects/-Users-andrevalleortega-Desktop-ValleOS/memory"
);

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function getSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

function fm(name: string, description: string, todayStr: string) {
  return `---\nname: ${name}\ndescription: "${description}"\nmetadata:\n  type: user\n---\n\n_Último sync: ${todayStr}_\n\n`;
}

async function buildHabits(sb: ReturnType<typeof getSb>, today: Date, todayStr: string) {
  const d30 = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const [{ data: hs }, { data: cs }] = await Promise.all([
    sb.from("habits").select("*").eq("active", true).order("sort_order"),
    sb.from("habit_completions").select("*").gte("date", d30),
  ]);

  const cMap: Record<string, Record<string, { value: number | null; frozen: boolean }>> = {};
  for (const c of cs ?? []) {
    (cMap[c.date] ??= {})[c.habit_id] = c;
  }

  let md = fm("personal-habits", "André's active habits, streaks, and completion rates — synced from Valle OS", todayStr);
  md += "## Hábitos activos\n\n";

  for (const h of hs ?? []) {
    const sched: number[] = h.schedule_days ?? [0, 1, 2, 3, 4, 5, 6];
    let scheduled = 0, completed = 0, streak = 0, streakDone = false;
    const d = new Date(today);

    for (let i = 0; i < 60; i++) {
      const ds = d.toISOString().split("T")[0];
      const dow = d.getDay();
      if (sched.includes(dow)) {
        const c = cMap[ds]?.[h.id];
        const done = c && (c.value! > 0 || c.frozen);
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
    md += `- Tipo: ${h.type}${h.daily_target ? ` · meta ${h.daily_target} ${h.unit ?? ""}` : ""}\n`;
    md += `- Días: ${sched.map((d) => DAYS[d]).join(", ")}\n`;
    md += `- Últimos 30d: ${completed}/${scheduled} (${pct}%)\n`;
    md += `- Racha actual: ${streak} días\n\n`;
  }
  return md;
}

async function buildGoals(sb: ReturnType<typeof getSb>, todayStr: string) {
  const d30 = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const [{ data: gs }, { data: ms }, { data: links }, { data: habits }, { data: comps }, { data: clients }, { data: projects }] = await Promise.all([
    sb.from("goals").select("*").neq("status", "completed").neq("status", "archived").order("sort_order"),
    sb.from("goal_milestones").select("*").order("sort_order"),
    sb.from("goal_habits").select("*"),
    sb.from("habits").select("id, name").eq("active", true),
    sb.from("habit_completions").select("habit_id, date").gte("date", d30).lte("date", todayStr),
    sb.from("flouvia_clients").select("*").order("sort_order"),
    sb.from("flouvia_projects").select("*").order("created_at", { ascending: false }),
  ]);

  type Ms = { goal_id: string; title: string; done: boolean; due_date: string | null };
  const msById: Record<string, Ms[]> = {};
  for (const m of (ms ?? []) as Ms[]) (msById[m.goal_id] ??= []).push(m);

  const habitName: Record<string, string> = {};
  for (const h of habits ?? []) habitName[h.id] = h.name;
  const compCount: Record<string, number> = {};
  for (const c of comps ?? []) compCount[c.habit_id] = (compCount[c.habit_id] ?? 0) + 1;
  const linksByGoal: Record<string, string[]> = {};
  for (const l of links ?? []) (linksByGoal[l.goal_id] ??= []).push(l.habit_id);

  let md = fm("goals-flouvia", "André's active goals, milestones, and Flouvia CRM — synced from Valle OS", todayStr);
  md += "## Metas activas\n\n";

  for (const g of gs ?? []) {
    const hitos = (msById[g.id] ?? []).slice().sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
    const pct = g.progress_type === "milestones" && hitos.length
      ? Math.round(100 * hitos.filter((m) => m.done).length / hitos.length)
      : g.target_value ? Math.round(100 * g.current_value / g.target_value)
      : Math.round(g.current_value);
    md += `### ${g.title}\n`;
    md += `- Categoría: ${g.category} · Estado: ${g.status} · Progreso: ${pct}%\n`;
    if (g.target_value != null) md += `- Medida: ${g.current_value}/${g.target_value} ${g.unit ?? ""}\n`;
    if (g.target_date) md += `- Fecha meta: ${g.target_date}\n`;
    if (g.description) md += `- ${g.description}\n`;
    if (hitos.length) {
      md += `- Hitos (${hitos.filter((m) => m.done).length}/${hitos.length}):\n`;
      for (const h of hitos) md += `  - [${h.done ? "x" : " "}] ${h.title}${h.due_date ? ` · ${h.due_date}` : ""}\n`;
    }
    const linked = (linksByGoal[g.id] ?? []).map((id) => `${habitName[id] ?? "?"} (${Math.round(100 * (compCount[id] ?? 0) / 30)}% 30d)`);
    if (linked.length) md += `- Sostenida por hábitos: ${linked.join(", ")}\n`;
    md += "\n";
  }

  const active = (clients ?? []).filter((c) => c.status === "activo");
  const mrr = active.reduce((s, c) => s + (c.monthly_value ?? 0), 0);
  md += `## Flouvia — CRM\n\n**MRR activo: ${fmt(mrr)} MXN**\n\n`;

  const statusLabel: Record<string, string> = { propuesta: "Propuesta", activo: "Activo", pausado: "Pausado", completado: "Completado" };
  for (const c of clients ?? []) {
    md += `### ${c.name} [${statusLabel[c.status] ?? c.status}]\n`;
    if (c.monthly_value) md += `- Mensualidad: ${fmt(c.monthly_value)}\n`;
    if (c.project_value) md += `- Valor proyecto: ${fmt(c.project_value)}\n`;
    if (c.description) md += `- ${c.description}\n`;
    const cps = (projects ?? []).filter((p) => p.client_id === c.id);
    if (cps.length) md += `- Proyectos: ${cps.map((p) => `${p.name} (${p.status})`).join(", ")}\n`;
    md += "\n";
  }
  return md;
}

async function buildAcademia(sb: ReturnType<typeof getSb>, today: Date, todayStr: string) {
  const [{ data: courses }, { data: comps }] = await Promise.all([
    sb.from("academic_courses").select("*").eq("active", true).order("name"),
    sb.from("grade_components").select("*").order("sort_order"),
  ]);

  const compsByCourse: Record<string, typeof comps> = {};
  for (const c of comps ?? []) (compsByCourse[c.course_id] ??= []).push(c as never);

  const graded = (courses ?? []).filter((c) => c.grade != null);
  const gpa = graded.length ? (graded.reduce((s, c) => s + c.grade!, 0) / graded.length).toFixed(2) : "—";

  let md = fm("academia-data", "André's Panamericana courses, grades, exams, and absences — synced from Valle OS", todayStr);
  md += `## Situación académica\n\nGPA actual: **${gpa}** · Materias activas: ${courses?.length ?? 0}\n\n`;

  for (const course of courses ?? []) {
    const risk = course.max_absences
      ? course.absences >= course.max_absences ? "PELIGRO" : course.absences >= course.max_absences * 0.75 ? "advertencia" : "ok"
      : "ok";
    md += `### ${course.name}${course.code ? ` (${course.code})` : ""}\n`;
    md += `- Calificación: ${course.grade ?? "—"}/10 · Meta: ${course.target_grade}\n`;
    if (course.credits) md += `- Créditos: ${course.credits}\n`;
    md += `- Faltas: ${course.absences}/${course.max_absences ?? "∞"} [${risk}]\n`;
    for (const comp of (compsByCourse[course.id] as typeof comps) ?? []) {
      const g = comp!.grade != null ? `${comp!.grade}/10` : "pendiente";
      const dif = comp!.difficulty ? ` dif${comp!.difficulty}` : "";
      const date = comp!.date ? ` · ${comp!.date}` : "";
      md += `- ${comp!.name} (${comp!.weight}%${dif})${date}: ${g}\n`;
      if (comp!.grade == null && comp!.study_start_date) md += `  → Estudiar desde: ${comp!.study_start_date}\n`;
      if (comp!.topics) md += `  → Temas: ${comp!.topics}\n`;
    }
    md += "\n";
  }

  const upcoming = (comps ?? [])
    .filter((c) => c.kind === "examen" && c.grade == null && c.date)
    .sort((a, b) => a.date!.localeCompare(b.date!))
    .slice(0, 6);

  if (upcoming.length) {
    md += "## Próximos exámenes\n\n";
    for (const e of upcoming) {
      const course = courses?.find((c) => c.id === e.course_id);
      const days = Math.round((new Date(e.date!).getTime() - today.getTime()) / 86400000);
      const when = days > 0 ? `en ${days}d` : days === 0 ? "hoy" : `hace ${-days}d`;
      md += `- **${course?.name ?? "?"}** — ${e.name} · ${e.date} (${when}) · dif ${e.difficulty ?? "?"}/5\n`;
    }
    md += "\n";
  }
  return md;
}

async function buildGym(sb: ReturnType<typeof getSb>, todayStr: string) {
  const d30 = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const d90 = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];

  const [{ data: routines }, { data: days }, { data: exercises }, { data: sessions }, { data: sets }] = await Promise.all([
    sb.from("workout_routines").select("*"),
    sb.from("workout_days").select("*").order("day_order"),
    sb.from("workout_exercises").select("*").order("sort_order"),
    sb.from("workout_sessions").select("*").gte("created_at", d90 + "T00:00:00").order("created_at", { ascending: false }),
    sb.from("workout_sets").select("*").gte("created_at", d90 + "T00:00:00"),
  ]);

  const active = routines?.find((r) => r.active);
  const rDays = (days ?? []).filter((d) => d.routine_id === active?.id);
  const exByDay: Record<string, typeof exercises> = {};
  for (const e of exercises ?? []) (exByDay[e.day_id] ??= []).push(e as never);

  let md = fm("gym-data", "André's workout routine, exercises, and recent training sessions — synced from Valle OS", todayStr);
  md += `## Rutina activa: ${active?.name ?? "Ninguna"}\n\n`;

  for (const day of rDays) {
    md += `### ${day.name} — ${(day.muscle_groups ?? []).join(", ")}\n`;
    for (const e of (exByDay[day.id] as typeof exercises) ?? []) {
      md += `- ${e!.name} ${e!.target_sets}×${e!.target_reps} · ${e!.muscle_group}\n`;
    }
    md += "\n";
  }

  const recent = (sessions ?? []).filter((s) => s.created_at >= d30 + "T00:00:00");
  md += `## Sesiones (${recent.length} en 30d · ${sessions?.length ?? 0} en 90d)\n\n`;
  for (const s of recent.slice(0, 8)) {
    const sSets = (sets ?? []).filter((x) => x.session_id === s.id);
    const vol = sSets.reduce((sum, x) => sum + (x.weight ?? 0) * (x.reps ?? 0), 0);
    md += `- **${s.created_at.split("T")[0]}** · ${s.day_name ?? "Libre"} · ${sSets.length} series · ${Math.round(vol / 1000)}k vol\n`;
  }

  const prMap: Record<string, number> = {};
  for (const s of sets ?? []) {
    if (s.weight && (!prMap[s.exercise_name] || s.weight > prMap[s.exercise_name])) {
      prMap[s.exercise_name] = s.weight;
    }
  }
  const prs = Object.entries(prMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (prs.length) {
    md += "\n## PRs recientes (90d)\n\n";
    for (const [name, w] of prs) md += `- ${name}: ${w}kg\n`;
  }
  return md;
}

async function buildFinances(sb: ReturnType<typeof getSb>, todayStr: string) {
  const d30 = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  const [{ data: accounts }, { data: cards }, { data: investments }, { data: entries }, { data: recurring }, { data: capGoals }] = await Promise.all([
    sb.from("bank_accounts").select("*").eq("active", true).order("sort_order"),
    sb.from("credit_cards").select("*").eq("active", true).order("sort_order"),
    sb.from("investments").select("*").eq("active", true),
    sb.from("financial_entries").select("*").gte("date", d30).order("date", { ascending: false }),
    sb.from("recurring_charges").select("*").eq("active", true),
    sb.from("capital_goals").select("*"),
  ]);

  const totalAcc = (accounts ?? []).reduce((s, a) => s + a.current_balance, 0);
  const totalCards = (cards ?? []).reduce((s, c) => s + c.current_balance, 0);
  const totalInv = (investments ?? []).reduce((s, i) => s + i.current_value, 0);
  const net = totalAcc + totalInv - totalCards;

  const thisMonth = todayStr.slice(0, 7) + "-01";
  const monthEntries = (entries ?? []).filter((e) => e.date >= thisMonth);
  const income = monthEntries.filter((e) => e.category === "flouvia_ingreso").reduce((s, e) => s + e.amount, 0);
  const expense = monthEntries.filter((e) => ["gasto_personal", "gasto_flouvia"].includes(e.category)).reduce((s, e) => s + e.amount, 0);

  let md = fm("finance-data", "André's financial situation, accounts, investments, and expenses — synced from Valle OS", todayStr);
  md += "## Patrimonio\n\n";
  md += `- **Patrimonio neto: ${fmt(net)} MXN**\n`;
  md += `- Efectivo/débito: ${fmt(totalAcc)}\n`;
  md += `- Inversiones: ${fmt(totalInv)}\n`;
  md += `- Deuda tarjetas: ${fmt(totalCards)}\n\n`;
  md += `## Este mes (${todayStr.slice(0, 7)})\n\n`;
  md += `- Ingresos: ${fmt(income)}\n`;
  md += `- Gastos: ${fmt(expense)}\n`;
  md += `- Balance: ${fmt(income - expense)}\n\n`;

  md += "## Cuentas\n\n";
  for (const a of accounts ?? []) {
    md += `- **${a.name}** (${a.bank ?? a.type}): ${fmt(a.current_balance)} ${a.currency}\n`;
  }

  md += "\n## Tarjetas\n\n";
  for (const c of cards ?? []) {
    const util = c.credit_limit ? `${Math.round(100 * c.current_balance / c.credit_limit)}% uso` : "";
    md += `- **${c.name}**: ${fmt(c.current_balance)} usado`;
    if (c.credit_limit) md += ` / ${fmt(c.credit_limit)} límite (${util})`;
    if (c.statement_balance) md += ` · corte: ${fmt(c.statement_balance)}`;
    if (c.due_day) md += ` · paga día ${c.due_day}`;
    md += "\n";
  }

  if (investments?.length) {
    md += "\n## Inversiones\n\n";
    for (const inv of investments) {
      const g = inv.current_value - inv.amount_invested;
      const gp = inv.amount_invested ? Math.round(100 * g / inv.amount_invested) : 0;
      md += `- **${inv.name}** (${inv.type}): ${fmt(inv.current_value)} · ${g >= 0 ? "+" : ""}${gp}%\n`;
    }
  }

  if (capGoals?.length) {
    md += "\n## Metas de capital\n\n";
    for (const g of capGoals) {
      const pct = Math.round(100 * g.current_amount / g.target_amount);
      md += `- **${g.name}**: ${fmt(g.current_amount)} / ${fmt(g.target_amount)} (${pct}%)\n`;
    }
  }

  if (recurring?.length) {
    const total = recurring.reduce((s, r) => s + r.amount, 0);
    md += `\n## Cargos recurrentes (${fmt(total)}/mes)\n\n`;
    for (const r of recurring) md += `- ${r.name}: ${fmt(r.amount)} · día ${r.charge_day ?? "?"}\n`;
  }

  const buckets: Record<string, number> = {};
  for (const e of (entries ?? []).filter((e) => ["gasto_personal", "gasto_flouvia"].includes(e.category))) {
    const k = e.subcategory ?? "otros";
    buckets[k] = (buckets[k] ?? 0) + e.amount;
  }
  const top = Object.entries(buckets).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (top.length) {
    md += "\n## Distribución del gasto (30d)\n\n";
    for (const [cat, amt] of top) md += `- ${cat}: ${fmt(amt)}\n`;
  }
  return md;
}

async function buildShadowMemory(sb: ReturnType<typeof getSb>, todayStr: string) {
  const { data } = await sb.from("shadow_memory").select("*").order("importance", { ascending: false });
  if (!data?.length) return null;

  let md = fm("shadow-memory", "Persistent facts Shadow has learned about André — stored in Valle OS", todayStr);
  md += "## Memoria persistente de Shadow\n\n";

  const byCategory: Record<string, { fact: string }[]> = {};
  for (const m of data) (byCategory[m.category] ??= []).push(m);
  for (const [cat, facts] of Object.entries(byCategory)) {
    md += `### ${cat}\n`;
    for (const f of facts) md += `- ${f.fact}\n`;
    md += "\n";
  }
  return md;
}

function updateIndex(written: string[]) {
  const indexPath = join(MEMORY_DIR, "MEMORY.md");
  let content = readFileSync(indexPath, "utf8");

  const entries: Record<string, string> = {
    "personal_habits.md": "[Hábitos activos](personal_habits.md) — Hábitos de André, rachas y % cumplimiento",
    "goals_flouvia.md":   "[Metas y Flouvia](goals_flouvia.md) — Metas activas, hitos y CRM Flouvia",
    "academia_data.md":   "[Academia Panamericana](academia_data.md) — Materias, calificaciones, exámenes y faltas",
    "gym_data.md":        "[Gym](gym_data.md) — Rutina de entrenamiento, ejercicios y sesiones recientes",
    "finance_data.md":    "[Finanzas](finance_data.md) — Patrimonio, cuentas, tarjetas y gastos",
    "shadow_memory.md":   "[Memoria de Shadow](shadow_memory.md) — Hechos persistentes aprendidos por Shadow",
  };

  for (const [file, line] of Object.entries(entries)) {
    if (written.includes(file) && !content.includes(file)) {
      content += `- ${line}\n`;
    }
  }
  writeFileSync(indexPath, content, "utf8");
}

export async function POST() {
  try {
    const sb = getSb();
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const [h, g, a, gy, f, sm] = await Promise.all([
      buildHabits(sb, today, todayStr),
      buildGoals(sb, todayStr),
      buildAcademia(sb, today, todayStr),
      buildGym(sb, todayStr),
      buildFinances(sb, todayStr),
      buildShadowMemory(sb, todayStr),
    ]);

    const written: string[] = [];
    const save = (file: string, content: string) => {
      writeFileSync(join(MEMORY_DIR, file), content, "utf8");
      written.push(file);
    };

    save("personal_habits.md", h);
    save("goals_flouvia.md", g);
    save("academia_data.md", a);
    save("gym_data.md", gy);
    save("finance_data.md", f);
    if (sm) save("shadow_memory.md", sm);

    updateIndex(written);

    return NextResponse.json({ ok: true, files: written, syncedAt: todayStr });
  } catch (e) {
    console.error("[sync-memory]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
