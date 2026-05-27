import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { formatCurrency } from "@/lib/utils";
import { buildUpcomingPayments } from "@/lib/finance/payments";
import { studyState, daysUntil, DIFFICULTY_LABELS } from "@/lib/academia/grades";
import { goalPct, goalPace } from "@/lib/metas/progress";
import type { PlanItem } from "@/lib/brief/plan";

type DB = SupabaseClient<Database>;

// Una observación que CRUZA módulos: la tensión que Shadow detecta entre
// academia/gym/metas/finanzas/tiempo y que ningún módulo ve por sí solo.
export type CrossInsight = {
  key: string;
  icon: "Zap" | "AlertTriangle" | "TrendingDown" | "CreditCard" | "Layers";
  text: string;
  tone: string;
  href: string;
};

const addDays = (today: string, n: number) => {
  const d = new Date(today + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
};

export async function buildCrossInsights(
  supabase: DB,
  today: string,
  plan: PlanItem[]
): Promise<CrossInsight[]> {
  const now = new Date(today + "T00:00:00");
  const in7 = addDays(today, 7);

  const [{ data: exams }, { data: courses }, { data: cards }, { data: recurring }, { data: goals }, { data: milestones }, { data: goalHabits }, { data: habits }] =
    await Promise.all([
      supabase
        .from("grade_components")
        .select("name, date, course_id, difficulty, study_start_date, status")
        .eq("kind", "examen").neq("status", "done").gte("date", today).order("date").limit(6),
      supabase.from("academic_courses").select("id, name").eq("active", true),
      supabase.from("credit_cards").select("*").eq("active", true),
      supabase.from("recurring_charges").select("*").eq("active", true),
      supabase.from("goals").select("id, title, progress_type, current_value, target_value, started_at, target_date, created_at, status").eq("status", "active"),
      supabase.from("goal_milestones").select("goal_id, done, due_date").order("sort_order"),
      supabase.from("goal_habits").select("goal_id, habit_id"),
      supabase.from("habits").select("id, name").eq("active", true),
    ]);

  const out: CrossInsight[] = [];
  const courseName = new Map((courses ?? []).map((c) => [c.id, c.name]));
  const gymToday = plan.some((p) => p.kind === "gym");

  // ── Examen apremiante (academia ↔ tiempo/gym) ────────────────────────────
  const urgentExam = (exams ?? []).find((ex) => {
    const d = daysUntil(ex.date, now);
    if (d === null || d < 0 || d > 7) return false;
    const st = studyState(ex.date, ex.study_start_date, ex.status, now);
    return st === "urgent" || st === "study-now" || (ex.difficulty ?? 0) >= 4;
  });
  if (urgentExam) {
    const d = daysUntil(urgentExam.date, now);
    const diff = urgentExam.difficulty ? DIFFICULTY_LABELS[urgentExam.difficulty] : null;
    const cn = courseName.get(urgentExam.course_id) ?? "una materia";
    const gymNote = gymToday && (d ?? 9) <= 2 ? " Hoy también entrenas — equilibra el bloque de gym con el estudio." : "";
    out.push({
      key: `exam-${urgentExam.course_id}`,
      icon: "AlertTriangle",
      text: `Examen de ${cn} en ${d}d${diff ? ` (${diff})` : ""}. Bloquea tiempo de estudio ya.${gymNote}`,
      tone: (d ?? 9) <= 2 ? "var(--red)" : "var(--gold)",
      href: "/panamericana",
    });
  }

  // ── Meta atrasada ↔ hábito que la sostiene (metas ↔ hábitos) ─────────────
  const msByGoal = new Map<string, { done: boolean; due_date: string | null }[]>();
  for (const m of milestones ?? []) {
    if (!msByGoal.has(m.goal_id)) msByGoal.set(m.goal_id, []);
    msByGoal.get(m.goal_id)!.push({ done: m.done, due_date: m.due_date });
  }
  const habitsByGoal = new Map<string, string[]>();
  for (const gh of goalHabits ?? []) {
    if (!habitsByGoal.has(gh.goal_id)) habitsByGoal.set(gh.goal_id, []);
    habitsByGoal.get(gh.goal_id)!.push(gh.habit_id);
  }
  const habitName = new Map((habits ?? []).map((h) => [h.id, h.name]));

  let worstGoal: { title: string; gap: number; habit: string | null } | null = null;
  for (const g of goals ?? []) {
    const ms = (msByGoal.get(g.id) ?? []) as unknown as Parameters<typeof goalPct>[1];
    const pct = goalPct(g, ms);
    const pace = goalPace(g, pct, today);
    if (pace.status !== "behind") continue;
    const gap = pace.expectedPct - pace.actualPct;
    if (!worstGoal || gap > worstGoal.gap) {
      const hid = (habitsByGoal.get(g.id) ?? [])[0];
      worstGoal = { title: g.title, gap, habit: hid ? habitName.get(hid) ?? null : null };
    }
  }
  if (worstGoal) {
    out.push({
      key: "goal-behind",
      icon: "TrendingDown",
      text: `Meta "${worstGoal.title}" atrasada ${Math.round(worstGoal.gap)}%${worstGoal.habit ? `. Refuerza el hábito "${worstGoal.habit}" para recuperar ritmo.` : ". Ataca su próximo hito."}`,
      tone: "var(--red)",
      href: "/metas",
    });
  }

  // ── Pagos agrupados (finanzas) ───────────────────────────────────────────
  const payments = buildUpcomingPayments(cards ?? [], recurring ?? [], now).filter((p) => p.daysUntil <= 6);
  if (payments.length >= 2) {
    const total = payments.reduce((a, p) => a + (p.amount ?? 0), 0);
    out.push({
      key: "pay-cluster",
      icon: "CreditCard",
      text: `${payments.length} pagos en los próximos 6 días${total > 0 ? ` suman ${formatCurrency(total)}` : ""}. Asegura el saldo.`,
      tone: "var(--gold)",
      href: "/finanzas",
    });
  }

  // ── Día cargado (tiempo) ─────────────────────────────────────────────────
  const compromisos = plan.length;
  if (compromisos >= 4 && out.length < 3) {
    const studyToday = plan.some((p) => p.kind === "study");
    const note = gymToday && studyToday ? " — hoy entrenas y estudias" : "";
    out.push({
      key: "loaded-day",
      icon: "Layers",
      text: `Día cargado: ${compromisos} compromisos en el plan${note}. Empieza por lo más temprano y protege tu energía.`,
      tone: "var(--blue)",
      href: "/tiempo",
    });
  }

  return out.slice(0, 3);
}
