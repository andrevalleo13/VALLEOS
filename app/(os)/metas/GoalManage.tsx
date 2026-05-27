"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";
import { GOAL_CATS } from "@/lib/metas/categories";
import type { Goal, GoalMilestone } from "@/lib/supabase/types";
import type { LinkedHabit } from "./page";

type LocalMs = { id: string; title: string; due_date: string; done: boolean; done_at: string | null; isNew: boolean };

export function GoalManage({
  goal,
  milestones,
  linkedHabitIds,
  allHabits,
  color,
  onClose,
}: {
  goal: Goal;
  milestones: GoalMilestone[];
  linkedHabitIds: string[];
  allHabits: LinkedHabit[];
  color: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState(goal.title);
  const [category, setCategory] = useState(goal.category);
  const [status, setStatus] = useState(goal.status);
  const [progressType, setProgressType] = useState(goal.progress_type === "percent" ? "percentage" : goal.progress_type);
  const [targetValue, setTargetValue] = useState(goal.target_value != null ? String(goal.target_value) : "");
  const [unit, setUnit] = useState(goal.unit ?? "");
  const [targetDate, setTargetDate] = useState(goal.target_date ?? "");
  const [description, setDescription] = useState(goal.description ?? "");
  const [pinned, setPinned] = useState(goal.pinned);

  const [ms, setMs] = useState<LocalMs[]>(
    milestones.map((m) => ({ id: m.id, title: m.title, due_date: m.due_date ?? "", done: m.done, done_at: m.done_at, isNew: false }))
  );
  const [linked, setLinked] = useState<Set<string>>(new Set(linkedHabitIds));

  const [saving, setSaving] = useState(false);

  function addMs() {
    setMs((p) => [...p, { id: crypto.randomUUID(), title: "", due_date: "", done: false, done_at: null, isNew: true }]);
  }
  function updateMs(id: string, patch: Partial<LocalMs>) {
    setMs((p) => p.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }
  function removeMs(id: string) {
    setMs((p) => p.filter((m) => m.id !== id));
  }
  function toggleHabit(id: string) {
    setLinked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function save() {
    setSaving(true);

    await supabase.from("goals").update({
      title: title.trim(),
      category,
      status,
      progress_type: progressType,
      target_value: progressType === "numeric" && targetValue ? parseFloat(targetValue) : null,
      unit: progressType === "numeric" ? (unit.trim() || null) : null,
      target_date: targetDate || null,
      description: description.trim() || null,
      pinned,
      ...(status === "completed" && !goal.completed_at ? { completed_at: new Date().toISOString() } : {}),
    }).eq("id", goal.id);

    // Hitos: diff contra los originales
    const origIds = new Set(milestones.map((m) => m.id));
    const localIds = new Set(ms.filter((m) => !m.isNew).map((m) => m.id));
    const toDelete = [...origIds].filter((id) => !localIds.has(id));
    if (toDelete.length) await supabase.from("goal_milestones").delete().in("id", toDelete);

    const valid = ms.filter((m) => m.title.trim());
    for (let i = 0; i < valid.length; i++) {
      const m = valid[i];
      if (m.isNew) {
        await supabase.from("goal_milestones").insert({
          goal_id: goal.id, title: m.title.trim(), due_date: m.due_date || null,
          done: false, done_at: null, sort_order: i,
        });
      } else {
        await supabase.from("goal_milestones").update({
          title: m.title.trim(), due_date: m.due_date || null, sort_order: i,
        }).eq("id", m.id);
      }
    }

    // Vínculos hábito↔meta
    const origLinks = new Set(linkedHabitIds);
    const toLink = [...linked].filter((id) => !origLinks.has(id));
    const toUnlink = [...origLinks].filter((id) => !linked.has(id));
    if (toLink.length) await supabase.from("goal_habits").insert(toLink.map((habit_id) => ({ goal_id: goal.id, habit_id })));
    for (const habit_id of toUnlink) {
      await supabase.from("goal_habits").delete().eq("goal_id", goal.id).eq("habit_id", habit_id);
    }

    setSaving(false);
    onClose();
    router.refresh();
  }

  async function remove() {
    if (!confirm("¿Eliminar esta meta y sus hitos?")) return;
    setSaving(true);
    await supabase.from("goals").delete().eq("id", goal.id);
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <Modal title="Gestionar meta" onClose={onClose} wide>
      <Field label="Título">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>

      <div className="r3">
        <Field label="Categoría">
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {GOAL_CATS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
        </Field>
        <Field label="Estado">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Activa</option>
            <option value="paused">Pausada</option>
            <option value="completed">Completada</option>
            <option value="archived">Archivada</option>
          </select>
        </Field>
        <Field label="Progreso por">
          <select className="input" value={progressType} onChange={(e) => setProgressType(e.target.value)}>
            <option value="percentage">Porcentaje</option>
            <option value="numeric">Numérico</option>
            <option value="milestones">Hitos</option>
          </select>
        </Field>
      </div>

      {progressType === "numeric" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Meta (valor objetivo)">
            <input className="input" type="number" inputMode="decimal" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
          </Field>
          <Field label="Unidad">
            <input className="input" placeholder="ej. libros, km" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </Field>
        </div>
      )}

      <Field label="Fecha objetivo">
        <input className="input" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
      </Field>
      <Field label="Descripción">
        <input className="input" placeholder="Por qué importa" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      {/* Hitos con fecha */}
      <div className="mt-mng-section">
        <div className="mt-mng-head">
          <span className="modal-field-label">Hitos {progressType === "milestones" && "(definen el progreso)"}</span>
          <button className="btn btn-ghost btn-sm" onClick={addMs}><Plus size={13} /> Hito</button>
        </div>
        {ms.length === 0 ? (
          <p className="tick">Sin hitos. Agrega pasos con fecha para trazar el camino.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {ms.map((m) => (
              <div key={m.id} className="mt-mng-ms">
                <GripVertical size={13} style={{ color: "var(--mute-2)", flexShrink: 0 }} />
                <input
                  className="input"
                  placeholder="Hito"
                  value={m.title}
                  onChange={(e) => updateMs(m.id, { title: e.target.value })}
                  style={{ flex: 1 }}
                />
                <input
                  className="input"
                  type="date"
                  value={m.due_date}
                  onChange={(e) => updateMs(m.id, { due_date: e.target.value })}
                  style={{ width: 150 }}
                />
                <button className="mt-gear" onClick={() => removeMs(m.id)} title="Quitar"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hábitos que sostienen la meta */}
      <div className="mt-mng-section">
        <span className="modal-field-label">Motor · hábitos que sostienen esta meta</span>
        {allHabits.length === 0 ? (
          <p className="tick">No tienes hábitos activos. Créalos en Hábitos para vincularlos.</p>
        ) : (
          <div className="mt-hab-pick">
            {allHabits.map((h) => {
              const on = linked.has(h.id);
              return (
                <button
                  key={h.id}
                  className={`mt-hab-chip${on ? " on" : ""}`}
                  onClick={() => toggleHabit(h.id)}
                  style={on ? { borderColor: h.color, background: `${h.color}1f` } : {}}
                >
                  <span className="mt-engine-dot" style={{ background: h.color }} />
                  {h.name}
                  <span className="tick" style={{ marginLeft: 4 }}>{h.adherence}%</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="modal-actions" style={{ justifyContent: "space-between" }}>
        <button className="btn btn-ghost btn-sm" onClick={remove} disabled={saving} style={{ color: "var(--red)" }}>
          <Trash2 size={13} /> Eliminar
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !title.trim()}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
