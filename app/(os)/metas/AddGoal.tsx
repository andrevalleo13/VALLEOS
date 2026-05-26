"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";
import { GOAL_CATS } from "@/lib/metas/categories";
import type { LinkedHabit } from "./page";

type LocalMs = { id: string; title: string; due_date: string };

export function AddGoal({
  variant = "primary",
  label = "Nueva meta",
  habits = [],
}: {
  variant?: "ghost" | "primary";
  label?: string;
  habits?: LinkedHabit[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("career");
  const [progressType, setProgressType] = useState<"percentage" | "numeric" | "milestones">("percentage");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [description, setDescription] = useState("");
  const [pinned, setPinned] = useState(false);
  const [ms, setMs] = useState<LocalMs[]>([]);
  const [linked, setLinked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  function reset() {
    setTitle(""); setTargetValue(""); setUnit(""); setTargetDate(""); setDescription("");
    setPinned(false); setProgressType("percentage"); setMs([]); setLinked(new Set());
  }

  function addMs() {
    setMs((p) => [...p, { id: crypto.randomUUID(), title: "", due_date: "" }]);
  }
  function toggleHabit(id: string) {
    setLinked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const { data: goal } = await supabase.from("goals").insert({
      title: title.trim(),
      category,
      description: description.trim() || null,
      target_date: targetDate || null,
      started_at: new Date().toISOString().split("T")[0],
      progress_type: progressType,
      current_value: 0,
      target_value: progressType === "numeric" && targetValue ? parseFloat(targetValue) : null,
      unit: progressType === "numeric" ? (unit.trim() || null) : null,
      image_url: null,
      pinned,
      status: "active",
      completed_at: null,
      sort_order: 0,
    }).select("id").single();

    const goalId = (goal as { id: string } | null)?.id;
    if (goalId) {
      const validMs = ms.filter((m) => m.title.trim());
      if (validMs.length) {
        await supabase.from("goal_milestones").insert(
          validMs.map((m, i) => ({ goal_id: goalId, title: m.title.trim(), due_date: m.due_date || null, done: false, done_at: null, sort_order: i }))
        );
      }
      if (linked.size) {
        await supabase.from("goal_habits").insert([...linked].map((habit_id) => ({ goal_id: goalId, habit_id })));
      }
    }

    setSaving(false);
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <>
      <button className={`btn btn-${variant} btn-sm`} onClick={() => setOpen(true)}>
        <Plus size={14} /> {label}
      </button>
      {open && (
        <Modal title="Nueva meta" onClose={() => setOpen(false)} wide>
          <Field label="Título">
            <input className="input" autoFocus placeholder="ej. Comprar Lincoln Corsair" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Categoría">
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {GOAL_CATS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
            </Field>
            <Field label="Progreso por">
              <select className="input" value={progressType} onChange={(e) => setProgressType(e.target.value as typeof progressType)}>
                <option value="percentage">Porcentaje</option>
                <option value="numeric">Numérico</option>
                <option value="milestones">Hitos</option>
              </select>
            </Field>
          </div>
          {progressType === "numeric" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Meta (valor objetivo)">
                <input className="input" type="number" inputMode="decimal" placeholder="100" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
              </Field>
              <Field label="Unidad">
                <input className="input" placeholder="ej. libros, km" value={unit} onChange={(e) => setUnit(e.target.value)} />
              </Field>
            </div>
          )}
          <Field label="Fecha objetivo (opcional)">
            <input className="input" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </Field>
          <Field label="Descripción (opcional)">
            <input className="input" placeholder="Por qué importa" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>

          {/* Hitos iniciales */}
          <div className="mt-mng-section">
            <div className="mt-mng-head">
              <span className="modal-field-label">Hitos {progressType === "milestones" && "(definen el progreso)"}</span>
              <button className="btn btn-ghost btn-sm" onClick={addMs}><Plus size={13} /> Hito</button>
            </div>
            {ms.length > 0 && (
              <div className="flex flex-col gap-2">
                {ms.map((m) => (
                  <div key={m.id} className="mt-mng-ms">
                    <input className="input" placeholder="Hito" value={m.title} onChange={(e) => setMs((p) => p.map((x) => x.id === m.id ? { ...x, title: e.target.value } : x))} style={{ flex: 1 }} />
                    <input className="input" type="date" value={m.due_date} onChange={(e) => setMs((p) => p.map((x) => x.id === m.id ? { ...x, due_date: e.target.value } : x))} style={{ width: 150 }} />
                    <button className="mt-gear" onClick={() => setMs((p) => p.filter((x) => x.id !== m.id))} title="Quitar"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Motor de hábitos */}
          {habits.length > 0 && (
            <div className="mt-mng-section">
              <span className="modal-field-label">Motor · hábitos que sostienen esta meta</span>
              <div className="mt-hab-pick">
                {habits.map((h) => {
                  const on = linked.has(h.id);
                  return (
                    <button key={h.id} className={`mt-hab-chip${on ? " on" : ""}`} onClick={() => toggleHabit(h.id)} style={on ? { borderColor: h.color, background: `${h.color}1f` } : {}}>
                      <span className="mt-engine-dot" style={{ background: h.color }} />
                      {h.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--bone-dim)" }}>
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            Anclar al inicio
          </label>
          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !title.trim()}>
              {saving ? "Guardando…" : "Crear meta"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
