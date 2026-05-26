"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";

const num = (s: string) => (s.trim() && isFinite(parseFloat(s)) ? parseFloat(s) : null);
const intNum = (s: string) => {
  const n = num(s);
  return n == null ? null : Math.round(n);
};

function Rating({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="sl-rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`sl-rating-dot${Number(value) >= n ? " on" : ""}`}
          onClick={() => onChange(String(value === String(n) ? "" : n))}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function LogHealth({ variant = "primary", label = "Registrar día" }: { variant?: "ghost" | "primary"; label?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [sleep, setSleep] = useState("");
  const [quality, setQuality] = useState("");
  const [bedtime, setBedtime] = useState("");
  const [wake, setWake] = useState("");
  const [mood, setMood] = useState("");
  const [energy, setEnergy] = useState("");
  const [steps, setSteps] = useState("");
  const [restingHr, setRestingHr] = useState("");
  const [water, setWater] = useState("");
  const [workoutMin, setWorkoutMin] = useState("");
  const [workoutType, setWorkoutType] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Si llenó dormir/despertar, deriva las horas de sueño
  function deriveSleep(bed: string, wk: string): number | null {
    if (!bed || !wk) return null;
    const [bh, bm] = bed.split(":").map(Number);
    const [wh, wm] = wk.split(":").map(Number);
    let mins = wh * 60 + wm - (bh * 60 + bm);
    if (mins <= 0) mins += 24 * 60;
    return Math.round((mins / 60) * 10) / 10;
  }

  async function save() {
    setSaving(true);
    const derived = deriveSleep(bedtime, wake);
    await supabase.from("health_entries").upsert(
      {
        date,
        sleep_hours: num(sleep) ?? derived,
        sleep_quality: intNum(quality),
        weight_kg: null,
        calories: null,
        protein_g: null,
        water_l: num(water),
        workout_minutes: intNum(workoutMin),
        workout_type: workoutType.trim() || null,
        mood: intNum(mood),
        energy: intNum(energy),
        steps: intNum(steps),
        resting_hr: intNum(restingHr),
        active_calories: null,
        bedtime: bedtime || null,
        wake_time: wake || null,
        source: "manual",
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
        <Modal title="Registro del día" onClose={() => setOpen(false)} wide>
          <Field label="Fecha">
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>

          <p className="eyebrow-gold mt-4 mb-2">Sueño</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Acostado">
              <input className="input" type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} />
            </Field>
            <Field label="Despierto">
              <input className="input" type="time" value={wake} onChange={(e) => setWake(e.target.value)} />
            </Field>
            <Field label="Horas (o se calculan)">
              <input className="input" type="number" inputMode="decimal" placeholder={deriveSleep(bedtime, wake)?.toString() ?? "7.5"} value={sleep} onChange={(e) => setSleep(e.target.value)} />
            </Field>
            <Field label="Calidad">
              <Rating value={quality} onChange={setQuality} />
            </Field>
          </div>

          <p className="eyebrow-gold mt-4 mb-2">Bienestar</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Ánimo">
              <Rating value={mood} onChange={setMood} />
            </Field>
            <Field label="Energía">
              <Rating value={energy} onChange={setEnergy} />
            </Field>
          </div>

          <p className="eyebrow-gold mt-4 mb-2">Actividad</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Field label="Pasos">
              <input className="input" type="number" inputMode="numeric" placeholder="8000" value={steps} onChange={(e) => setSteps(e.target.value)} />
            </Field>
            <Field label="FC reposo">
              <input className="input" type="number" inputMode="numeric" placeholder="58" value={restingHr} onChange={(e) => setRestingHr(e.target.value)} />
            </Field>
            <Field label="Agua (L)">
              <input className="input" type="number" inputMode="decimal" placeholder="2.5" value={water} onChange={(e) => setWater(e.target.value)} />
            </Field>
            <Field label="Ejercicio (min)">
              <input className="input" type="number" inputMode="numeric" placeholder="45" value={workoutMin} onChange={(e) => setWorkoutMin(e.target.value)} />
            </Field>
            <Field label="Tipo de ejercicio">
              <input className="input" placeholder="ej. Empuje, Cardio" value={workoutType} onChange={(e) => setWorkoutType(e.target.value)} />
            </Field>
          </div>

          <Field label="Notas">
            <input className="input" placeholder="Cómo te sentiste hoy" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
