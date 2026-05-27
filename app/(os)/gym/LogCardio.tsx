"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Footprints } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";
import { useQuickAction } from "@/lib/store";
import { CARDIO_ACTIVITIES, pace } from "@/lib/gym/schedule";

const num = (s: string) => (s.trim() && isFinite(parseFloat(s)) ? parseFloat(s) : null);
const int = (s: string) => (s.trim() && isFinite(parseInt(s)) ? parseInt(s) : null);

export function LogCardio() {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  useQuickAction("cardio", () => setOpen(true));

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [activity, setActivity] = useState("run");
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [hr, setHr] = useState("");
  const [elevation, setElevation] = useState("");
  const [notes, setNotes] = useState("");

  const pacePreview = pace(num(duration), num(distance));

  function reset() {
    setActivity("run"); setDistance(""); setDuration(""); setHr(""); setElevation(""); setNotes("");
  }

  async function save() {
    const dist = num(distance);
    const dur = int(duration);
    if (dist == null && dur == null) {
      toast.error("Captura al menos distancia o tiempo.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("cardio_sessions").insert({
      date,
      activity,
      distance_km: dist,
      duration_minutes: dur,
      avg_hr: int(hr),
      elevation_m: int(elevation),
      calories: null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(`No se pudo guardar: ${error.message}`);
      return;
    }
    setOpen(false);
    const act = CARDIO_ACTIVITIES.find((a) => a.key === activity);
    toast.success(`${act?.emoji ?? "💨"} ${dist != null ? `${dist} km` : `${dur} min`} registrado`);
    reset();
    router.refresh();
  }

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        <Footprints size={14} /> Cardio
      </button>
      {open && (
        <Modal title="Registrar cardio" onClose={() => setOpen(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Fecha">
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Actividad">
              <select className="input" value={activity} onChange={(e) => setActivity(e.target.value)}>
                {CARDIO_ACTIVITIES.map((a) => (
                  <option key={a.key} value={a.key}>{a.emoji} {a.label}</option>
                ))}
              </select>
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Distancia (km)">
              <input className="input" inputMode="decimal" placeholder="5.0" value={distance} onChange={(e) => setDistance(e.target.value)} />
            </Field>
            <Field label="Tiempo (min)">
              <input className="input" inputMode="numeric" placeholder="28" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </Field>
          </div>
          {pacePreview && (
            <p className="tick" style={{ marginTop: -4, marginBottom: 6, color: "var(--gold)" }}>
              Ritmo: {pacePreview} min/km
            </p>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Pulso medio (ppm)">
              <input className="input" inputMode="numeric" placeholder="—" value={hr} onChange={(e) => setHr(e.target.value)} />
            </Field>
            <Field label="Desnivel (m)">
              <input className="input" inputMode="numeric" placeholder="—" value={elevation} onChange={(e) => setElevation(e.target.value)} />
            </Field>
          </div>
          <Field label="Notas">
            <input className="input" placeholder="Cómo se sintió" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
