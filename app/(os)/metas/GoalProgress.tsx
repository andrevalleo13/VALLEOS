"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Milestone = { id: string; title: string; done: boolean; sort_order: number };

export function GoalProgress({
  goalId,
  progressType,
  currentValue,
  targetValue,
  unit,
  color,
  milestones,
}: {
  goalId: string;
  progressType: string;
  currentValue: number;
  targetValue: number | null;
  unit: string | null;
  color: string;
  milestones: Milestone[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(currentValue));
  const [saving, setSaving] = useState(false);

  const ms = [...milestones].sort((a, b) => a.sort_order - b.sort_order);

  let pct = 0;
  if (progressType === "milestones" && ms.length > 0) {
    pct = Math.round((ms.filter((m) => m.done).length / ms.length) * 100);
  } else if (progressType === "percentage") {
    pct = Math.min(100, Math.max(0, currentValue));
  } else if (progressType === "numeric" && targetValue) {
    pct = Math.min(100, Math.round((currentValue / targetValue) * 100));
  }

  async function saveValue() {
    const n = parseFloat(val);
    if (!isFinite(n)) return;
    setSaving(true);
    const reached =
      (progressType === "percentage" && n >= 100) ||
      (progressType === "numeric" && targetValue != null && n >= targetValue);
    await supabase
      .from("goals")
      .update({
        current_value: n,
        ...(reached ? { status: "completed", completed_at: new Date().toISOString() } : {}),
      })
      .eq("id", goalId);
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  async function toggleMs(m: Milestone) {
    await supabase
      .from("goal_milestones")
      .update({ done: !m.done, done_at: !m.done ? new Date().toISOString() : null })
      .eq("id", m.id);
    router.refresh();
  }

  return (
    <div>
      {progressType === "numeric" && targetValue != null && (
        <p style={{ fontFamily: "var(--f-mono)", fontSize: 13, color: "var(--bone-dim)", marginBottom: 8 }}>
          {currentValue} {unit} / {targetValue} {unit}
        </p>
      )}

      <div className="flex justify-between mb-1" style={{ alignItems: "center" }}>
        <span className="tick">Progreso</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="tick" style={{ color }}>{pct}%</span>
          {progressType !== "milestones" && !editing && (
            <button className="tick" style={{ cursor: "pointer", color: "var(--gold)" }} onClick={() => { setVal(String(currentValue)); setEditing(true); }}>
              Actualizar
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "6px 0 10px" }}>
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
          <span className="tick">{progressType === "percentage" ? "%" : unit}</span>
          <button className="btn btn-primary btn-sm" onClick={saveValue} disabled={saving}>{saving ? "…" : "Guardar"}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancelar</button>
        </div>
      ) : (
        <div className="progress mb-3">
          <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
      )}

      {ms.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {ms.map((m) => (
            <button
              key={m.id}
              className="tag"
              onClick={() => toggleMs(m)}
              style={
                m.done
                  ? { borderColor: "var(--green)", color: "var(--green)", background: "rgba(127,169,140,0.15)", fontSize: 11, cursor: "pointer" }
                  : { fontSize: 11, cursor: "pointer" }
              }
            >
              {m.done ? "✓ " : ""}{m.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
