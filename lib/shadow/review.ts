// Motor de cierre semanal/mensual: cruza todos los módulos y rankea "qué necesita tu atención".
// Determinista (score por días-restantes × severidad × peso del módulo) + roll-up del período.
// Puro: no toca Supabase ni Anthropic — la ruta recolecta los datos y llama buildReview().

import type {
  Habit, Goal, GoalMilestone, FlouviaFollowup,
  HealthEntry, CreditCard, RecurringCharge,
  AcademicCourse, GradeComponent, FinancialEntry,
} from "@/lib/supabase/types";
import { buildUpcomingPayments } from "@/lib/finance/payments";
import { goalPct, goalPace, milestoneState } from "@/lib/metas/progress";
import {
  computeCourseGrades, neededForTarget, studyState, absenceRisk,
  DIFFICULTY_LABELS, daysUntil as examDaysUntil,
} from "@/lib/academia/grades";
import { sleepDebt, avg, compareWindows } from "@/lib/salud/health";
import { fmtHours } from "@/lib/tiempo/categories";
import { formatCurrency } from "@/lib/utils";

export type Period = "week" | "month";

export type AttentionItem = {
  module: string;
  title: string;
  detail: string;
  dueDate: string | null;
  daysUntil: number | null;
  severity: 1 | 2 | 3; // info / warn / crítico
  score: number; // 0-100, determinista
  href: string;
};

export type ReviewRollup = {
  habitos: string;
  metas: string;
  finanzas: string;
  tiempo: string;
  academia: string;
  salud: string;
};

export type ReviewResult = {
  period: Period;
  rangeLabel: string;
  items: AttentionItem[];
  rollup: ReviewRollup;
  context: string;
};

type TimeLogLite = { duration_minutes: number | null; category: string | null; started_at: string };

export type ReviewInput = {
  period: Period;
  today: string;
  now: Date;
  habits: Habit[];
  completions: { habit_id: string; date: string }[];
  components: GradeComponent[];
  courses: AcademicCourse[];
  cards: CreditCard[];
  recurring: RecurringCharge[];
  goals: Goal[];
  milestones: GoalMilestone[];
  followups: (FlouviaFollowup & { clientName?: string | null })[];
  timeLogs: TimeLogLite[];
  health: HealthEntry[];
  entries: FinancialEntry[];
  agenda: string;
};

const DAY = 86400000;
const PRODUCTIVE: ReadonlySet<string> = new Set(["Flouvia", "Panamericana", "Estudio", "Deep work"]);

const MODULE_WEIGHT: Record<string, number> = {
  Academia: 1.0,
  Finanzas: 0.95,
  Salud: 0.85,
  Metas: 0.85,
  Hábitos: 0.7,
  Tiempo: 0.6,
  Flouvia: 0.55,
};

const SEV_FACTOR: Record<1 | 2 | 3, number> = { 1: 0.5, 2: 0.75, 3: 1.0 };

// Cercanía → multiplicador. Vencido/hoy = 1.0, decae a 0.3 a las 3 semanas, 0.45 si no hay fecha.
function urgency(days: number | null): number {
  if (days == null) return 0.45;
  if (days <= 0) return 1.0;
  if (days >= 21) return 0.3;
  return 1 - (days / 21) * 0.7;
}

function score(module: string, sev: 1 | 2 | 3, days: number | null): number {
  const w = MODULE_WEIGHT[module] ?? 0.6;
  return Math.round(100 * w * SEV_FACTOR[sev] * urgency(days));
}

function item(module: string, sev: 1 | 2 | 3, days: number | null, title: string, detail: string, href: string, dueDate: string | null = null): AttentionItem {
  return { module, title, detail, dueDate, daysUntil: days, severity: sev, score: score(module, sev, days), href };
}

const fmtDay = (s: string) => new Date(s + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });
const dueWord = (days: number | null) =>
  days == null ? "" : days < 0 ? `venció hace ${Math.abs(days)} d` : days === 0 ? "hoy" : `en ${days} d`;

function rangeLabel(period: Period, now: Date): string {
  if (period === "month") return now.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  const start = new Date(now.getTime() - 6 * DAY);
  return `${start.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}–${now.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`;
}

export function buildReview(input: ReviewInput): ReviewResult {
  const { period, today, now } = input;
  const trail = period === "week" ? 7 : 30;
  const lookAhead = period === "week" ? 10 : 35;
  const items: AttentionItem[] = [];

  // ── Academia: exámenes próximos + faltas en riesgo ──────────────────────────
  const courseById = new Map(input.courses.map((c) => [c.id, c]));
  const compsByCourse = new Map<string, GradeComponent[]>();
  for (const c of input.components) {
    (compsByCourse.get(c.course_id) ?? compsByCourse.set(c.course_id, []).get(c.course_id)!).push(c);
  }

  for (const ex of input.components) {
    if (ex.kind !== "examen" || ex.status === "done" || !ex.date) continue;
    const d = examDaysUntil(ex.date, now);
    if (d == null || d < 0 || d > lookAhead) continue;
    const course = courseById.get(ex.course_id);
    if (!course) continue;
    const diff = ex.difficulty ?? 3;
    const st = studyState(ex.date, ex.study_start_date, ex.status, now);
    let sev: 1 | 2 | 3 = diff >= 4 ? 3 : 2;
    if (st === "urgent" || st === "study-now") sev = 3;
    const g = course ? computeCourseGrades(compsByCourse.get(course.id) ?? []) : null;
    const need = g && course ? neededForTarget(g, course.target_grade) : null;
    const needTxt = need != null && need > 0 ? ` · necesitas ${Math.round(need * 10) / 10} en lo que falta` : "";
    items.push(item(
      "Academia", sev, d,
      `Examen: ${course?.name ?? ex.name}`,
      `${DIFFICULTY_LABELS[diff] ?? "Media"} · ${fmtDay(ex.date)} (${dueWord(d)})${st === "study-now" || st === "urgent" ? " · estudia ya" : ""}${needTxt}`,
      "/panamericana", ex.date,
    ));
  }

  for (const c of input.courses) {
    const risk = absenceRisk(c.absences, c.max_absences);
    if (risk === "warn" || risk === "danger") {
      items.push(item(
        "Academia", risk === "danger" ? 3 : 2, null,
        `Faltas: ${c.name}`,
        `${c.absences}/${c.max_absences} faltas${risk === "danger" ? " · en el límite" : ""}`,
        "/panamericana",
      ));
    }
  }

  // ── Finanzas: próximos pagos dentro de la ventana ───────────────────────────
  const payments = buildUpcomingPayments(input.cards, input.recurring, now).filter((p) => p.daysUntil <= lookAhead);
  for (const p of payments) {
    const sev: 1 | 2 | 3 = p.daysUntil <= 3 ? 3 : 2;
    items.push(item(
      "Finanzas", sev, p.daysUntil,
      `Pago: ${p.name}`,
      `${p.amount != null ? formatCurrency(p.amount) : "monto s/d"} · ${fmtDay(p.dueDate)} (${dueWord(p.daysUntil)})`,
      "/finanzas", p.dueDate,
    ));
  }

  // ── Metas: atrasadas vs. ritmo + hitos vencidos/próximos ────────────────────
  const msByGoal = new Map<string, GoalMilestone[]>();
  for (const m of input.milestones) {
    (msByGoal.get(m.goal_id) ?? msByGoal.set(m.goal_id, []).get(m.goal_id)!).push(m);
  }
  for (const goal of input.goals) {
    const ms = msByGoal.get(goal.id) ?? [];
    const pct = goalPct(goal, ms);
    const pace = goalPace(goal, pct, today);
    if (pace.status === "behind") {
      const sev: 1 | 2 | 3 = pace.daysLeft != null && pace.daysLeft < 0 ? 3 : 2;
      items.push(item(
        "Metas", sev, pace.daysLeft,
        `Meta atrasada: ${goal.title}`,
        `${pct}% vs. ${pace.expectedPct}% esperado · ${pace.label}`,
        "/metas", goal.target_date,
      ));
    }
    for (const m of ms) {
      const state = milestoneState(m, today);
      if (state === "overdue" || state === "soon") {
        const d = m.due_date ? Math.round((new Date(m.due_date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / DAY) : null;
        items.push(item(
          "Metas", state === "overdue" ? 3 : 2, d,
          `Hito: ${m.title}`,
          `${goal.title} · ${m.due_date ? `${fmtDay(m.due_date)} (${dueWord(d)})` : "sin fecha"}`,
          "/metas", m.due_date,
        ));
      }
    }
  }

  // ── Hábitos: adherencia del período (días cumplidos / días agendados) ───────
  const since = new Date(now.getTime() - (trail - 1) * DAY);
  const sinceStr = since.toISOString().split("T")[0];
  const compsByHabit = new Map<string, Set<string>>();
  for (const c of input.completions) {
    if (c.date < sinceStr) continue;
    (compsByHabit.get(c.habit_id) ?? compsByHabit.set(c.habit_id, new Set()).get(c.habit_id)!).add(c.date);
  }
  const scheduledDaysInWindow = (sched: number[]): number => {
    if (!sched || sched.length === 0) return trail; // sin schedule → diario
    let n = 0;
    for (let i = 0; i < trail; i++) {
      const d = new Date(now.getTime() - i * DAY);
      if (sched.includes(d.getDay())) n++;
    }
    return n;
  };
  const slack: { name: string; done: number; sched: number; rate: number }[] = [];
  for (const h of input.habits) {
    const sched = scheduledDaysInWindow(h.schedule_days ?? []);
    if (sched === 0) continue;
    const done = compsByHabit.get(h.id)?.size ?? 0;
    const rate = done / sched;
    if (rate < 0.5) slack.push({ name: h.name, done, sched, rate });
  }
  if (slack.length) {
    slack.sort((a, b) => a.rate - b.rate);
    const worst = slack.slice(0, 3);
    items.push(item(
      "Hábitos", slack.length >= 3 ? 3 : 2, null,
      slack.length === 1 ? `Hábito flojo: ${worst[0].name}` : `${slack.length} hábitos por debajo`,
      worst.map((w) => `${w.name} ${w.done}/${w.sched}`).join(" · "),
      "/habitos",
    ));
  }

  // ── Tiempo: enfoque productivo vs. período previo ───────────────────────────
  const winStart = now.getTime() - trail * DAY;
  const prevStart = now.getTime() - 2 * trail * DAY;
  let curFocus = 0, prevFocus = 0;
  for (const l of input.timeLogs) {
    if (!l.category || !PRODUCTIVE.has(l.category) || !l.duration_minutes) continue;
    const t = new Date(l.started_at).getTime();
    if (t >= winStart) curFocus += l.duration_minutes;
    else if (t >= prevStart) prevFocus += l.duration_minutes;
  }
  if (prevFocus > 0 && curFocus < prevFocus * 0.8) {
    const drop = Math.round((1 - curFocus / prevFocus) * 100);
    items.push(item(
      "Tiempo", 2, null,
      "Tiempo enfocado a la baja",
      `−${drop}% vs. período previo (${fmtHours(curFocus)} vs. ${fmtHours(prevFocus)})`,
      "/tiempo",
    ));
  }

  // ── Salud: deuda de sueño + energía a la baja ───────────────────────────────
  const trailHealth = input.health.filter((e) => e.date >= sinceStr);
  const sleepVals = trailHealth.map((e) => e.sleep_hours).filter((x): x is number => typeof x === "number");
  if (sleepVals.length >= 3) {
    const avgSleep = avg(sleepVals)!;
    const debt = sleepDebt(trailHealth);
    if (avgSleep < 6.5 || debt > sleepVals.length) {
      items.push(item(
        "Salud", avgSleep < 6 ? 3 : 2, null,
        "Deuda de sueño",
        `prom ${avgSleep}h · deuda acumulada ${debt > 0 ? `−${debt}h` : "0"}`,
        "/salud",
      ));
    }
  }
  const energyCmp = compareWindows(input.health, "energy");
  if (energyCmp.delta != null && energyCmp.delta <= -0.7) {
    items.push(item(
      "Salud", 2, null,
      "Energía a la baja",
      `${energyCmp.recent}/5 (${energyCmp.delta} vs. ventana previa)`,
      "/salud",
    ));
  }

  // ── Flouvia: follow-ups pendientes (peso bajo: debajo de un examen) ─────────
  for (const f of input.followups) {
    if (f.done) continue;
    const d = f.due_date ? Math.round((new Date(f.due_date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / DAY) : null;
    if (d != null && d > lookAhead) continue;
    items.push(item(
      "Flouvia", d != null && d < 0 ? 2 : 1, d,
      `Follow-up: ${f.title}`,
      `${f.clientName ? `${f.clientName} · ` : ""}${f.due_date ? `${fmtDay(f.due_date)} (${dueWord(d)})` : "sin fecha"}`,
      "/flouvia", f.due_date,
    ));
  }

  items.sort((a, b) => b.score - a.score);

  // ── Roll-up del período ─────────────────────────────────────────────────────
  const rollup = buildRollup(input, trail, sinceStr, curFocus);
  const context = buildContext(period, rangeLabel(period, now), items, rollup, input.agenda);

  return { period, rangeLabel: rangeLabel(period, now), items, rollup, context };
}

function buildRollup(input: ReviewInput, trail: number, sinceStr: string, curFocus: number): ReviewRollup {
  // Hábitos
  let schedTotal = 0, doneTotal = 0;
  const now = input.now;
  const compsByHabit = new Map<string, Set<string>>();
  for (const c of input.completions) {
    if (c.date < sinceStr) continue;
    (compsByHabit.get(c.habit_id) ?? compsByHabit.set(c.habit_id, new Set()).get(c.habit_id)!).add(c.date);
  }
  for (const h of input.habits) {
    const sched = (h.schedule_days?.length ?? 0) === 0 ? trail : (() => {
      let n = 0; for (let i = 0; i < trail; i++) if (h.schedule_days.includes(new Date(now.getTime() - i * DAY).getDay())) n++; return n;
    })();
    schedTotal += sched;
    doneTotal += Math.min(sched, compsByHabit.get(h.id)?.size ?? 0);
  }
  const habPct = schedTotal ? Math.round((doneTotal / schedTotal) * 100) : 0;

  // Metas
  const msByGoal = new Map<string, GoalMilestone[]>();
  for (const m of input.milestones) (msByGoal.get(m.goal_id) ?? msByGoal.set(m.goal_id, []).get(m.goal_id)!).push(m);
  let behind = 0, ontrack = 0;
  for (const g of input.goals) {
    const pace = goalPace(g, goalPct(g, msByGoal.get(g.id) ?? []), input.today);
    if (pace.status === "behind") behind++;
    else if (pace.status === "ahead" || pace.status === "ontrack") ontrack++;
  }

  // Finanzas
  const income = input.entries.filter((e) => e.category === "flouvia_ingreso").reduce((a, e) => a + e.amount, 0);
  const expenses = input.entries.filter((e) => e.category === "gasto_personal" || e.category === "gasto_flouvia").reduce((a, e) => a + e.amount, 0);

  // Academia
  const grades = input.courses
    .map((c) => computeCourseGrades(input.components.filter((x) => x.course_id === c.id)).currentGrade)
    .filter((x): x is number => x != null);
  const gpa = grades.length ? Math.round((grades.reduce((a, b) => a + b, 0) / grades.length) * 100) / 100 : null;
  const upcomingExams = input.components.filter((x) => x.kind === "examen" && x.status !== "done" && x.date && examDaysUntil(x.date, now)! >= 0).length;

  // Salud
  const trailHealth = input.health.filter((e) => e.date >= sinceStr);
  const avgSleep = avg(trailHealth.map((e) => e.sleep_hours));

  return {
    habitos: `${doneTotal}/${schedTotal} cumplidos (${habPct}%)`,
    metas: `${input.goals.length} activas · ${ontrack} a tiempo, ${behind} atrasada${behind === 1 ? "" : "s"}`,
    finanzas: `ingresos ${formatCurrency(income)}, gastos ${formatCurrency(expenses)}, balance ${formatCurrency(income - expenses)}`,
    tiempo: `${fmtHours(curFocus)} de trabajo enfocado`,
    academia: gpa != null ? `GPA proyectado ${gpa} · ${upcomingExams} examen(es) próximo(s)` : `${upcomingExams} examen(es) próximo(s)`,
    salud: avgSleep != null ? `sueño prom ${avgSleep}h` : "sin registros de sueño",
  };
}

function buildContext(period: Period, range: string, items: AttentionItem[], rollup: ReviewRollup, agenda: string): string {
  const sevTxt = (s: 1 | 2 | 3) => (s === 3 ? "crítico" : s === 2 ? "atención" : "menor");
  const ranked = items.length
    ? items.slice(0, 10).map((it, i) => `${i + 1}. [${it.module} · ${sevTxt(it.severity)} · score ${it.score}] ${it.title} — ${it.detail}`).join("\n")
    : "(nada urgente detectado — todo bajo control)";
  return `Período: ${period === "week" ? "esta semana" : "este mes"} (${range}).

QUÉ NECESITA TU ATENCIÓN (ya rankeado por urgencia × severidad × peso del módulo):
${ranked}

ROLL-UP DEL PERÍODO:
- Hábitos: ${rollup.habitos}
- Metas: ${rollup.metas}
- Finanzas: ${rollup.finanzas}
- Tiempo: ${rollup.tiempo}
- Academia: ${rollup.academia}
- Salud: ${rollup.salud}

Agenda próxima:
${agenda}`;
}
