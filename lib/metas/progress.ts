import type { Goal, GoalMilestone } from "@/lib/supabase/types";

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().split("T")[0];

export function goalPct(goal: Pick<Goal, "progress_type" | "current_value" | "target_value">, milestones: GoalMilestone[]): number {
  const pt = goal.progress_type;
  if (pt === "milestones") {
    if (milestones.length === 0) return 0;
    return Math.round((milestones.filter((m) => m.done).length / milestones.length) * 100);
  }
  if (pt === "numeric" && goal.target_value) {
    return Math.min(100, Math.round((goal.current_value / goal.target_value) * 100));
  }
  // percent / percentage / boolean
  return Math.min(100, Math.max(0, Math.round(goal.current_value)));
}

export type PaceStatus = "ahead" | "ontrack" | "behind" | "done" | "none";

export type Pace = {
  status: PaceStatus;
  expectedPct: number;
  actualPct: number;
  daysLeft: number | null;
  totalDays: number | null;
  label: string;
  color: string;
};

/** Ritmo esperado vs. real según la ventana started_at → target_date. */
export function goalPace(
  goal: Pick<Goal, "started_at" | "target_date" | "created_at" | "status">,
  actualPct: number,
  todayStr?: string,
): Pace {
  const today = todayStr ?? iso(new Date());

  if (goal.status === "completed" || actualPct >= 100) {
    return { status: "done", expectedPct: 100, actualPct, daysLeft: 0, totalDays: null, label: "Completada", color: "var(--green)" };
  }
  if (!goal.target_date) {
    return { status: "none", expectedPct: 0, actualPct, daysLeft: null, totalDays: null, label: "Sin fecha objetivo", color: "var(--mute)" };
  }

  const startStr = goal.started_at ?? (goal.created_at ? goal.created_at.split("T")[0] : today);
  const start = new Date(startStr + "T00:00:00").getTime();
  const end = new Date(goal.target_date + "T00:00:00").getTime();
  const now = new Date(today + "T00:00:00").getTime();

  const totalDays = Math.max(1, Math.round((end - start) / DAY));
  const daysLeft = Math.round((end - now) / DAY);

  if (daysLeft < 0) {
    return { status: "behind", expectedPct: 100, actualPct, daysLeft, totalDays, label: `Venció hace ${Math.abs(daysLeft)} d`, color: "var(--red)" };
  }

  const elapsed = Math.min(1, Math.max(0, (now - start) / (end - start || 1)));
  const expectedPct = Math.round(elapsed * 100);
  const gap = actualPct - expectedPct;

  let status: PaceStatus;
  let color: string;
  if (gap >= 8) { status = "ahead"; color = "var(--green)"; }
  else if (gap <= -8) { status = "behind"; color = "var(--red)"; }
  else { status = "ontrack"; color = "var(--gold)"; }

  const leftLabel = daysLeft === 0 ? "vence hoy" : `faltan ${daysLeft} d`;
  const label =
    status === "ahead" ? `Adelantado · ${leftLabel}` :
    status === "behind" ? `Atrasado · ${leftLabel}` :
    `A tiempo · ${leftLabel}`;

  return { status, expectedPct, actualPct, daysLeft, totalDays, label, color };
}

export type MilestoneState = "done" | "overdue" | "soon" | "upcoming" | "nodate";

export function milestoneState(m: Pick<GoalMilestone, "done" | "due_date">, todayStr?: string): MilestoneState {
  if (m.done) return "done";
  if (!m.due_date) return "nodate";
  const today = todayStr ?? iso(new Date());
  const days = Math.round((new Date(m.due_date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / DAY);
  if (days < 0) return "overdue";
  if (days <= 7) return "soon";
  return "upcoming";
}
