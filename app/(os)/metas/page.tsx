import { createClient } from "@/lib/supabase/server";
import { Plus, Target } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Goal, GoalMilestone } from "@/lib/supabase/types";

export const revalidate = 0;

const CAT_COLORS: Record<string, string> = {
  career: "var(--gold)",
  finance: "var(--green)",
  health: "var(--red)",
  learning: "var(--violet)",
  relationships: "var(--blue)",
  experience: "var(--gold-2)",
  creative: "var(--violet)",
  other: "var(--mute)",
};

const CAT_LABELS: Record<string, string> = {
  career: "Carrera",
  finance: "Finanzas",
  health: "Salud",
  learning: "Aprendizaje",
  relationships: "Relaciones",
  experience: "Experiencias",
  creative: "Creativo",
  other: "Otro",
};

type GoalWithMilestones = Goal & { goal_milestones: GoalMilestone[] };

export default async function MetasPage() {
  const supabase = await createClient();

  const { data: goals } = await supabase
    .from("goals")
    .select("*, goal_milestones(*)")
    .neq("status", "abandoned")
    .order("pinned", { ascending: false })
    .order("sort_order")
    .order("created_at");

  const { data: capitalGoals } = await supabase
    .from("capital_goals")
    .select("*");

  const typedGoals = (goals ?? []) as unknown as GoalWithMilestones[];
  const active = typedGoals.filter((g) => g.status === "active").length;
  const completed = typedGoals.filter((g) => g.status === "completed").length;
  const avgProgress = typedGoals.length > 0
    ? Math.round(typedGoals.filter(g => g.status === "active").reduce((a, g) => a + g.current_value, 0) / (active || 1))
    : 0;

  function getProgress(g: GoalWithMilestones) {
    if (g.progress_type === "milestones" && g.goal_milestones.length > 0) {
      return Math.round((g.goal_milestones.filter((m) => m.done).length / g.goal_milestones.length) * 100);
    }
    if (g.progress_type === "percentage") return Math.min(100, g.current_value);
    if (g.progress_type === "numeric" && g.target_value) {
      return Math.min(100, Math.round((g.current_value / g.target_value) * 100));
    }
    return 0;
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow mb-2">Objetivos 2026</p>
            <h1 className="page-title">Metas</h1>
          </div>
          <button className="btn btn-primary btn-sm">
            <Plus size={14} /> Nueva meta
          </button>
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
          <div className="card text-center py-12">
            <Target size={32} style={{ color: "var(--mute-2)", margin: "0 auto 12px" }} />
            <p style={{ color: "var(--mute)", fontSize: 14 }}>Sin metas configuradas</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {typedGoals.map((g) => {
              const color = CAT_COLORS[g.category] ?? "var(--mute)";
              const pct = getProgress(g);
              const milestones = g.goal_milestones?.sort((a, b) => a.sort_order - b.sort_order) ?? [];

              return (
                <div key={g.id} className="card" style={g.pinned ? { borderColor: color } : {}}>
                  <div className="flex items-start gap-4">
                    <div
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: `${color}22`, border: `1px solid ${color}`,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}
                    >
                      <Target size={16} style={{ color }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 style={{ fontWeight: 500, color: "var(--bone)", fontSize: 15 }}>{g.title}</h3>
                        {g.pinned && <span className="tag-gold tag" style={{ fontSize: 10 }}>Anclada</span>}
                        <div className="ml-auto flex gap-2">
                          {g.target_date && <span className="tag" style={{ fontSize: 10 }}>{g.target_date}</span>}
                          <span
                            className="tag"
                            style={{ borderColor: color, color, background: `${color}15`, fontSize: 10 }}
                          >
                            {CAT_LABELS[g.category] ?? g.category}
                          </span>
                        </div>
                      </div>

                      {g.description && (
                        <p style={{ color: "var(--mute)", fontSize: 13, marginBottom: 10 }}>{g.description}</p>
                      )}

                      {/* Numeric progress */}
                      {g.progress_type === "numeric" && g.target_value && (
                        <p style={{ fontFamily: "var(--f-mono)", fontSize: 13, color: "var(--bone-dim)", marginBottom: 8 }}>
                          {g.current_value} {g.unit} / {g.target_value} {g.unit}
                        </p>
                      )}

                      <div className="flex justify-between mb-1">
                        <span className="tick">Progreso</span>
                        <span className="tick" style={{ color }}>{pct}%</span>
                      </div>
                      <div className="progress mb-3">
                        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                      </div>

                      {/* Milestones */}
                      {milestones.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {milestones.map((ms) => (
                            <span
                              key={ms.id}
                              className="tag"
                              style={ms.done
                                ? { borderColor: "var(--green)", color: "var(--green)", background: "rgba(127,169,140,0.15)", fontSize: 11 }
                                : { fontSize: 11 }
                              }
                            >
                              {ms.done ? "✓ " : ""}{ms.title}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
