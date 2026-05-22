"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";

const CATS = [
  { v: "career", l: "Carrera" },
  { v: "finance", l: "Finanzas" },
  { v: "health", l: "Salud" },
  { v: "learning", l: "Aprendizaje" },
  { v: "relationships", l: "Relaciones" },
  { v: "experience", l: "Experiencias" },
  { v: "creative", l: "Creativo" },
  { v: "other", l: "Otro" },
];

export function AddGoal({ variant = "primary", label = "Nueva meta" }: { variant?: "ghost" | "primary"; label?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("career");
  const [progressType, setProgressType] = useState<"percentage" | "numeric">("percentage");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [description, setDescription] = useState("");
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    await supabase.from("goals").insert({
      title: title.trim(),
      category,
      description: description.trim() || null,
      target_date: targetDate || null,
      progress_type: progressType,
      current_value: 0,
      target_value: progressType === "numeric" && targetValue ? parseFloat(targetValue) : null,
      unit: progressType === "numeric" ? (unit.trim() || null) : null,
      image_url: null,
      pinned,
      status: "active",
      completed_at: null,
      sort_order: 0,
    });
    setSaving(false);
    setOpen(false);
    setTitle(""); setTargetValue(""); setUnit(""); setTargetDate(""); setDescription(""); setPinned(false);
    router.refresh();
  }

  return (
    <>
      <button className={`btn btn-${variant} btn-sm`} onClick={() => setOpen(true)}>
        <Plus size={14} /> {label}
      </button>
      {open && (
        <Modal title="Nueva meta" onClose={() => setOpen(false)}>
          <Field label="Título">
            <input className="input" autoFocus placeholder="ej. Comprar Lincoln Corsair" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Categoría">
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
            </Field>
            <Field label="Tipo de progreso">
              <select className="input" value={progressType} onChange={(e) => setProgressType(e.target.value as "percentage" | "numeric")}>
                <option value="percentage">Porcentaje</option>
                <option value="numeric">Numérico</option>
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
