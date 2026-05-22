"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";

const num = (s: string) => (s.trim() && isFinite(parseFloat(s)) ? parseFloat(s) : null);

export function LogHealth({ variant = "primary", label = "Registrar hoy" }: { variant?: "ghost" | "primary"; label?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [sleep, setSleep] = useState("");
  const [quality, setQuality] = useState("");
  const [weight, setWeight] = useState("");
  const [mood, setMood] = useState("");
  const [energy, setEnergy] = useState("");
  const [workoutMin, setWorkoutMin] = useState("");
  const [workoutType, setWorkoutType] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await supabase.from("health_entries").upsert(
      {
        date,
        sleep_hours: num(sleep),
        sleep_quality: num(quality),
        weight_kg: num(weight),
        calories: null,
        protein_g: null,
        water_l: null,
        workout_minutes: num(workoutMin),
        workout_type: workoutType.trim() || null,
        mood: num(mood),
        energy: num(energy),
        notes: notes.trim() || null,
      },
      { onConflict: "date" }
    );
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button className={`btn btn-${variant} btn-sm`} onClick={() => setOpen(true)}>
        <Plus size={14} /> {label}
      </button>
      {open && (
        <Modal title="Registro de salud" onClose={() => setOpen(false)}>
          <Field label="Fecha">
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Sueño (horas)">
              <input className="input" type="number" inputMode="decimal" placeholder="7.5" value={sleep} onChange={(e) => setSleep(e.target.value)} />
            </Field>
            <Field label="Calidad sueño (1-5)">
              <input className="input" type="number" min="1" max="5" placeholder="4" value={quality} onChange={(e) => setQuality(e.target.value)} />
            </Field>
            <Field label="Peso (kg)">
              <input className="input" type="number" inputMode="decimal" placeholder="72" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </Field>
            <Field label="Ejercicio (min)">
              <input className="input" type="number" placeholder="45" value={workoutMin} onChange={(e) => setWorkoutMin(e.target.value)} />
            </Field>
            <Field label="Mood (1-5)">
              <input className="input" type="number" min="1" max="5" placeholder="4" value={mood} onChange={(e) => setMood(e.target.value)} />
            </Field>
            <Field label="Energía (1-5)">
              <input className="input" type="number" min="1" max="5" placeholder="4" value={energy} onChange={(e) => setEnergy(e.target.value)} />
            </Field>
          </div>
          <Field label="Tipo de ejercicio">
            <input className="input" placeholder="ej. Empuje, Cardio" value={workoutType} onChange={(e) => setWorkoutType(e.target.value)} />
          </Field>
          <Field label="Notas">
            <input className="input" placeholder="Cómo te sentiste" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
