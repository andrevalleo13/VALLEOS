"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scale } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";

const num = (s: string) => (s.trim() && isFinite(parseFloat(s)) ? parseFloat(s) : null);

export function LogWeight({ variant = "ghost", label = "Peso" }: { variant?: "ghost" | "primary"; label?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [muscle, setMuscle] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const w = num(weight);
    if (w == null) return;
    setSaving(true);
    await supabase.from("weight_logs").upsert(
      {
        date,
        weight_kg: w,
        body_fat_pct: num(bodyFat),
        muscle_kg: num(muscle),
        notes: notes.trim() || null,
        source: "manual",
      },
      { onConflict: "date" }
    );
    setSaving(false);
    setOpen(false);
    setWeight(""); setBodyFat(""); setMuscle(""); setNotes("");
    router.refresh();
  }

  return (
    <>
      <button className={`btn btn-${variant} btn-sm`} onClick={() => setOpen(true)}>
        <Scale size={14} /> {label}
      </button>
      {open && (
        <Modal title="Registrar peso" onClose={() => setOpen(false)}>
          <p className="tick mb-3">Solo cuando te peses — el último registro queda como tu peso actual.</p>
          <Field label="Fecha">
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Field label="Peso (kg)">
              <input className="input" type="number" inputMode="decimal" placeholder="72.5" value={weight} onChange={(e) => setWeight(e.target.value)} autoFocus />
            </Field>
            <Field label="% Grasa">
              <input className="input" type="number" inputMode="decimal" placeholder="15" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} />
            </Field>
            <Field label="Músculo (kg)">
              <input className="input" type="number" inputMode="decimal" placeholder="34" value={muscle} onChange={(e) => setMuscle(e.target.value)} />
            </Field>
          </div>
          <Field label="Notas">
            <input className="input" placeholder="ej. en ayunas, post-corte" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !weight.trim()}>{saving ? "Guardando…" : "Guardar"}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
