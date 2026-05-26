import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { formatCurrency } from "@/lib/utils";
import { buildUpcomingPayments } from "@/lib/finance/payments";
import { studyState, daysUntil, DIFFICULTY_LABELS } from "@/lib/academia/grades";
import { milestoneState } from "@/lib/metas/progress";

type DB = SupabaseClient<Database>;

// Una señal accionable del día. tone = color CSS; urgent = pide acción ya.
export type RadarItem = {
  key: string;
  icon: "Dumbbell" | "GraduationCap" | "CreditCard" | "Flag" | "Briefcase";
  label: string;
  detail: string;
  href: string;
  tone: string;
  urgent: boolean;
};

export type BriefRadar = {
  items: RadarItem[];
  tiempoHoy: number; // minutos registrados hoy
  libro: { title: string; current: number | null; total: number | null; pct: number | null } | null;
};

const addDays = (today: string, n: number) => {
  const d = new Date(today + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
};

// Construye el "radar" del día: lo que André tiene que atender hoy, cruzando
// los mismos cálculos que usa Shadow (consultar_estado) pero como datos para la UI.
export async function buildBriefRadar(supabase: DB, today: string): Promise<BriefRadar> {
  const in3 = addDays(today, 3);
  const in7 = addDays(today, 7);
  const now = new Date(today + "T00:00:00");

  const [
    { data: routines },
    { data: days },
    { data: lastSess },
    { data: exams },
    { data: courses },
    { data: cards },
    { data: recurring },
    { data: milestones },
    { data: goals },
    { data: followupsRaw },
    { data: reading },
    { data: timeLogs },
  ] = await Promise.all([
    supabase.from("workout_routines").select("id, name, active").order("sort_order"),
    supabase.from("workout_days").select("id, name, muscle_groups, day_order, routine_id").order("day_order"),
    supabase.from("workout_sessions").select("day_id, date").not("day_id", "is", null).order("date", { ascending: false }).limit(1),
    supabase.from("grade_components").select("name, date, course_id, difficulty, study_start_date, status").eq("kind", "examen").neq("status", "done").gte("date", today).order("date").limit(5),
    supabase.from("academic_courses").select("id, name").eq("active", true),
    supabase.from("credit_cards").select("*").eq("active", true),
    supabase.from("recurring_charges").select("*").eq("active", true),
    supabase.from("goal_milestones").select("title, due_date, done, goal_id").eq("done", false).not("due_date", "is", null).lte("due_date", in7).order("due_date"),
    supabase.from("goals").select("id, title").eq("status", "active"),
    supabase.from("flouvia_followups").select("title, due_date, flouvia_clients(name)").eq("done", false).not("due_date", "is", null).lte("due_date", in3).order("due_date").limit(5),
    supabase.from("reading_items").select("title, type, current_page, total_pages, added_at").eq("status", "reading").order("added_at", { ascending: false }),
    supabase.from("time_logs").select("duration_minutes").gte("started_at", `${today}T00:00:00-06:00`),
  ]);

  const items: RadarItem[] = [];

  // ── Pagos ≤3 días ──────────────────────────────────────────────────────────
  const payments = buildUpcomingPayments(cards ?? [], recurring ?? [], now).filter((p) => p.daysUntil <= 3);
  for (const p of payments.slice(0, 3)) {
    const whenStr = p.daysUntil <= 0 ? "vence hoy" : p.daysUntil === 1 ? "mañana" : `en ${p.daysUntil} días`;
    items.push({
      key: `pay-${p.id}`,
      icon: "CreditCard",
      label: "Pago",
      detail: `${p.name}${p.amount ? ` · ${formatCurrency(p.amount)}` : ""} · ${whenStr}`,
      href: "/finanzas",
      tone: "var(--red)",
      urgent: p.daysUntil <= 1,
    });
  }

  // ── Exámenes próximos (≤30d) ────────────────────────────────────────────────
  const courseName = new Map((courses ?? []).map((c) => [c.id, c.name]));
  let examShown = 0;
  for (const ex of exams ?? []) {
    const d = daysUntil(ex.date, now);
    if (d === null || d < 0 || d > 30) continue;
    const state = studyState(ex.date, ex.study_start_date, ex.status, now);
    const actionable = state === "urgent" || state === "study-now" || state === "soon";
    // Muestra siempre el examen más cercano; los demás solo si ya piden acción.
    if (examShown >= 1 && !actionable) break;
    const urgent = state === "urgent" || state === "study-now";
    const tone = state === "urgent" ? "var(--red)" : actionable ? "var(--gold)" : "var(--mute)";
    const cue =
      state === "urgent" ? "estudia ya" :
      state === "study-now" ? "toca estudiar" :
      state === "soon" ? "empieza pronto" : "";
    const diff = ex.difficulty ? ` · ${DIFFICULTY_LABELS[ex.difficulty]}` : "";
    items.push({
      key: `exam-${ex.course_id}-${ex.name}`,
      icon: "GraduationCap",
      label: "Examen",
      detail: `${courseName.get(ex.course_id) ?? "Materia"}: ${ex.name} · en ${d}d${diff}${cue ? ` · ${cue}` : ""}`,
      href: "/panamericana",
      tone,
      urgent,
    });
    if (++examShown >= 3) break;
  }

  // ── Hitos de metas que vencen ───────────────────────────────────────────────
  const goalTitle = new Map((goals ?? []).map((g) => [g.id, g.title]));
  for (const m of milestones ?? []) {
    const state = milestoneState({ done: false, due_date: m.due_date }, today);
    if (state !== "overdue" && state !== "soon") continue;
    items.push({
      key: `ms-${m.goal_id}-${m.title}`,
      icon: "Flag",
      label: "Hito",
      detail: `${goalTitle.get(m.goal_id) ?? "Meta"}: ${m.title} · ${state === "overdue" ? "vencido" : "vence pronto"}`,
      href: "/metas",
      tone: state === "overdue" ? "var(--red)" : "var(--gold)",
      urgent: state === "overdue",
    });
  }

  // ── Follow-ups de Flouvia ───────────────────────────────────────────────────
  const followups = (followupsRaw ?? []) as unknown as { title: string; due_date: string | null; flouvia_clients: { name: string } | null }[];
  for (const f of followups.slice(0, 3)) {
    const d = f.due_date ? daysUntil(f.due_date, now) : null;
    const whenStr = d == null ? "" : d < 0 ? "atrasado" : d === 0 ? "hoy" : d === 1 ? "mañana" : `en ${d}d`;
    items.push({
      key: `fu-${f.title}-${f.due_date}`,
      icon: "Briefcase",
      label: "Flouvia",
      detail: `${f.flouvia_clients?.name ? `${f.flouvia_clients.name}: ` : ""}${f.title}${whenStr ? ` · ${whenStr}` : ""}`,
      href: "/flouvia",
      tone: "var(--blue)",
      urgent: d != null && d <= 0,
    });
  }

  // ── Gym: hoy toca (siguiente día del ciclo) ─────────────────────────────────
  const routine = (routines ?? []).find((r) => r.active) ?? (routines ?? [])[0] ?? null;
  if (routine) {
    const dlist = (days ?? []).filter((d) => d.routine_id === routine.id);
    let suggested = dlist[0] ?? null;
    const lastDayId = lastSess?.[0]?.day_id;
    if (lastDayId && dlist.length) {
      const idx = dlist.findIndex((d) => d.id === lastDayId);
      if (idx >= 0) suggested = dlist[(idx + 1) % dlist.length];
    }
    if (suggested) {
      const mg = (suggested.muscle_groups as string[] | null) ?? [];
      items.push({
        key: "gym",
        icon: "Dumbbell",
        label: "Gym",
        detail: `Hoy toca: ${suggested.name}${mg.length ? ` · ${mg.slice(0, 3).join(", ")}` : ""}`,
        href: "/gym",
        tone: "var(--green)",
        urgent: false,
      });
    }
  }

  // Urgentes primero, manteniendo el orden relativo dentro de cada grupo.
  items.sort((a, b) => Number(b.urgent) - Number(a.urgent));

  const tiempoHoy = (timeLogs ?? []).reduce((a, l) => a + (l.duration_minutes ?? 0), 0);

  const r = (reading ?? [])[0] ?? null;
  const libro = r
    ? {
        title: r.title ?? "Sin título",
        current: r.current_page,
        total: r.total_pages,
        pct: r.current_page != null && r.total_pages ? Math.round((r.current_page / r.total_pages) * 100) : null,
      }
    : null;

  return { items, tiempoHoy, libro };
}
