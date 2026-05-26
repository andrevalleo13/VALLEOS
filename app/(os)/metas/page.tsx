import { createClient } from "@/lib/supabase/server";
import { Target } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency } from "@/lib/utils";
import { AddGoal } from "./AddGoal";
import { GoalCard } from "./GoalCard";
import { catColor } from "@/lib/metas/categories";
import { goalPct } from "@/lib/metas/progress";
import type { Goal, GoalMilestone, GoalHabit, Habit } from "@/lib/supabase/types";

export const revalidate = 0;

type GoalWithMilestones = Goal & { goal_milestones: GoalMilestone[] };
export type LinkedHabit = { id: string; name: string; color: string; adherence: number };

const iso = (d: Date) => d.toISOString().split("T")[0];

export default async function MetasPage() {
  const supabase = await createClient();

  const start30 = new Date();
  start30.setDate(start30.getDate() - 29);

  const [{ data: goals }, { data: capitalGoals }, { data: links }, { data: habits }, { data: comps }] = await Promise.all([
    supabase
      .from("goals")
      .select("*, goal_milestones(*)")
      .neq("status", "abandoned")
      .neq("status", "archived")
      .order("pinned", { ascending: false })
      .order("sort_order")
      .order("created_at"),
    supabase.from("capital_goals").select("*"),
    supabase.from("goal_habits").select("*"),
    supabase.from("habits").select("*").eq("active", true).order("sort_order"),
    supabase.from("habit_completions").select("habit_id, date").gte("date", iso(start30)).lte("date", iso(new Date())),
  ]);

  const typedGoals = (goals ?? []) as unknown as GoalWithMilestones[];
  const allHabits = (habits ?? []) as Habit[];
  const allLinks = (links ?? []) as GoalHabit[];

  // Adherencia 30d por hábito (completados / 30), igual que el desglose de Hábitos.
  const compCount: Record<string, number> = {};
  for (const c of comps ?? []) compCount[c.habit_id] = (compCount[c.habit_id] ?? 0) + 1;
  const adherence: Record<string, number> = {};
  for (const h of allHabits) adherence[h.id] = Math.round(((compCount[h.id] ?? 0) / 30) * 100);

  function habitsFor(goalId: string): LinkedHabit[] {
    return allLinks
      .filter((l) => l.goal_id === goalId)
      .map((l) => allHabits.find((h) => h.id === l.habit_id))
      .filter((h): h is Habit => !!h)
      .map((h) => ({ id: h.id, name: h.name, color: h.color, adherence: adherence[h.id] ?? 0 }));
  }

  const activeGoals = typedGoals.filter((g) => g.status === "active");
  const active = activeGoals.length;
  const completed = typedGoals.filter((g) => g.status === "completed").length;
  const avgProgress = active > 0
    ? Math.round(activeGoals.reduce((a, g) => a + goalPct(g, g.goal_milestones ?? []), 0) / active)
    : 0;

  const habitOptions = allHabits.map((h) => ({ id: h.id, name: h.name, color: h.color, adherence: adherence[h.id] ?? 0 }));

  return (
    <div>
      <div className="page-header">
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow mb-2">07 · OBJETIVOS</p>
            <h1 className="page-title">Metas.</h1>
          </div>
          <AddGoal habits={habitOptions} />
        </div>
      </div>

      <div className="page-body">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="card text-center">
            <p style={{ fontFamily: "var(--f-mono)", fontSize: 36, color: "var(--bone)" }}>{active}</p>
            <p className="metric-label">Metas activas</p>
          </div>
          <div className="card text-center">
            <p style={{ fontFamily: "var(--f-mono)", fontSize: 36, color: "var(--gold)" }}>{completed}</p>
            <p className="metric-label">Completadas</p>
          </div>
          <div className="card text-center">
            <p style={{ fontFamily: "var(--f-mono)", fontSize: 36, color: "var(--green)" }}>{avgProgress}%</p>
            <p className="metric-label">Progreso promedio</p>
          </div>
        </div>

        {/* Capital goals from schema */}
        {(capitalGoals ?? []).length > 0 && (
          <div className="card mb-6" style={{ borderColor: "var(--gold)" }}>
            <p className="eyebrow-gold mb-4">Metas de capital</p>
            {(capitalGoals ?? []).map((g) => {
              const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));
              return (
                <div key={g.id} className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <p style={{ fontFamily: "var(--f-serif)", fontSize: 20, color: "var(--bone)", flex: 1 }}>{g.name}</p>
                    <span className="eyebrow-gold">{pct}%</span>
                  </div>
                  {g.description && <p style={{ color: "var(--mute)", fontSize: 12, marginBottom: 8 }}>{g.description}</p>}
                  <div className="progress progress-lg mb-2">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between">
                    <span className="tick">{formatCurrency(g.current_amount)} acumulado</span>
                    <span className="tick">meta: {formatCurrency(g.target_amount)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Goals */}
        {typedGoals.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Target}
              title="Sin metas configuradas"
              hint="Define tu primer objetivo y traza el camino con hitos y hábitos que lo sostengan."
            >
              <AddGoal label="Crear primera meta" habits={habitOptions} />
            </EmptyState>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {typedGoals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                milestones={g.goal_milestones ?? []}
                linkedHabits={habitsFor(g.id)}
                allHabits={habitOptions}
                color={catColor(g.category)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
