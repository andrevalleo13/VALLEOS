"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Target, Check, Settings2, Flag, Activity, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { catLabel } from "@/lib/metas/categories";
import { goalPct, goalPace, milestoneState } from "@/lib/metas/progress";
import type { Goal, GoalMilestone } from "@/lib/supabase/types";
import { GoalManage } from "./GoalManage";
import type { LinkedHabit } from "./page";

const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });

export function GoalCard({
  goal,
  milestones,
  linkedHabits,
  allHabits,
  color,
}: {
  goal: Goal;
  milestones: GoalMilestone[];
  linkedHabits: LinkedHabit[];
  allHabits: LinkedHabit[];
  color: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(goal.current_value));
  const [saving, setSaving] = useState(false);
  const [managing, setManaging] = useState(false);

  const ms = [...milestones].sort((a, b) => {
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return a.sort_order - b.sort_order;
  });

  const pct = goalPct(goal, ms);
  const pace = goalPace(goal, pct);
  const isNumeric = goal.progress_type === "numeric";
  const isMilestoneDriven = goal.progress_type === "milestones";
  const canEditValue = !isMilestoneDriven;

  async function saveValue() {
    const n = parseFloat(val);
    if (!isFinite(n)) return;
    setSaving(true);
    const reached =
      (goal.progress_type !== "numeric" && n >= 100) ||
      (goal.progress_type === "numeric" && goal.target_value != null && n >= goal.target_value);
    await supabase
      .from("goals")
      .update({
        current_value: n,
        ...(reached ? { status: "completed", completed_at: new Date().toISOString() } : {}),
      })
      .eq("id", goal.id);
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  async function toggleMs(m: GoalMilestone) {
    await supabase
      .from("goal_milestones")
      .update({ done: !m.done, done_at: !m.done ? new Date().toISOString() : null })
      .eq("id", m.id);
    router.refresh();
  }

  return (
    <div className="card mt-goal" style={goal.pinned ? { borderColor: color } : {}}>
      {/* Header */}
      <div className="mt-goal-head">
        <div className="mt-goal-icon" style={{ background: `${color}1f`, border: `1px solid ${color}` }}>
          <Target size={16} style={{ color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 style={{ fontWeight: 500, color: "var(--bone)", fontSize: 15 }}>{goal.title}</h3>
            {goal.pinned && <span className="tag-gold tag" style={{ fontSize: 10 }}>Anclada</span>}
            {goal.status === "paused" && <span className="tag" style={{ fontSize: 10 }}>Pausada</span>}
            {goal.status === "completed" && <span className="tag-green tag" style={{ fontSize: 10 }}>✓ Completada</span>}
          </div>
          {goal.description && (
            <p style={{ color: "var(--mute)", fontSize: 13, marginTop: 4 }}>{goal.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
          <span className="tag" style={{ borderColor: color, color, background: `${color}15`, fontSize: 10 }}>
            {catLabel(goal.category)}
          </span>
          <button className="mt-gear" onClick={() => setManaging(true)} title="Gestionar">
            <Settings2 size={14} />
          </button>
        </div>
      </div>

      {/* Visual progress (estilo gym) */}
      <div className="mt-prog">
        <div className="mt-prog-head">
          <span className="mt-pct" style={{ color }}>{pct}%</span>
          <span className="mt-pace" style={{ color: pace.color }}>
            {pace.status === "behind" && <AlertTriangle size={11} />}
            {pace.label}
          </span>
          {isNumeric && goal.target_value != null && (
            <span className="tick" style={{ marginLeft: "auto" }}>
              {goal.current_value}{goal.unit ? ` ${goal.unit}` : ""} / {goal.target_value}{goal.unit ? ` ${goal.unit}` : ""}
            </span>
          )}
          {canEditValue && !editing && (
            <button
              className="tick mt-update"
              style={{ marginLeft: isNumeric ? 10 : "auto" }}
              onClick={() => { setVal(String(goal.current_value)); setEditing(true); }}
            >
              Actualizar
            </button>
          )}
        </div>

        {editing ? (
          <div className="mt-edit-row">
            <input
              className="input"
              type="number"
              inputMode="decimal"
              autoFocus
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveValue(); if (e.key === "Escape") setEditing(false); }}
              style={{ maxWidth: 120 }}
            />
            <span className="tick">{isNumeric ? (goal.unit ?? "") : "%"}</span>
            <button className="btn btn-primary btn-sm" onClick={saveValue} disabled={saving}>{saving ? "…" : "Guardar"}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancelar</button>
          </div>
        ) : (
          <div className="mt-track" title={pace.status !== "none" && pace.status !== "done" ? `Deberías ir en ${pace.expectedPct}%` : undefined}>
            <div className="mt-track-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}cc, ${color})` }} />
            {pace.status !== "none" && pace.status !== "done" && pace.expectedPct > 0 && pace.expectedPct < 100 && (
              <div className="mt-track-marker" style={{ left: `${pace.expectedPct}%` }} />
            )}
          </div>
        )}
      </div>

      {/* Hitos — línea de tiempo */}
      {ms.length > 0 && (
        <div className="mt-section">
          <p className="mt-section-label"><Flag size={11} /> Hitos · {ms.filter((m) => m.done).length}/{ms.length}</p>
          <div className="mt-hitos">
            {ms.map((m) => {
              const st = milestoneState(m);
              return (
                <button key={m.id} className={`mt-hito ${st}`} onClick={() => toggleMs(m)} title={m.done ? "Marcar pendiente" : "Marcar hecho"}>
                  <span className="mt-hito-dot">{m.done && <Check size={11} />}</span>
                  <span className="mt-hito-title">{m.title}</span>
                  {m.due_date && <span className="mt-hito-date">{fmtDate(m.due_date)}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Motor — hábitos que sostienen la meta */}
      {linkedHabits.length > 0 && (
        <div className="mt-section">
          <p className="mt-section-label"><Activity size={11} /> Motor · hábitos que la sostienen</p>
          <div className="mt-engine">
            {linkedHabits.map((h) => (
              <div key={h.id} className="mt-engine-row">
                <span className="mt-engine-dot" style={{ background: h.color }} />
                <span className="mt-engine-name">{h.name}</span>
                <div className="mt-engine-track">
                  <div className="mt-engine-fill" style={{ width: `${h.adherence}%`, background: h.color }} />
                </div>
                <span className="mt-engine-val" style={{ color: h.adherence >= 70 ? "var(--green)" : h.adherence >= 40 ? "var(--gold)" : "var(--mute)" }}>
                  {h.adherence}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {managing && (
        <GoalManage
          goal={goal}
          milestones={ms}
          linkedHabitIds={linkedHabits.map((h) => h.id)}
          allHabits={allHabits}
          color={color}
          onClose={() => setManaging(false)}
        />
      )}
    </div>
  );
}
