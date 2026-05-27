"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Target } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";
import type { CardioGoal } from "@/lib/supabase/types";

const num = (s: string) => (s.trim() && isFinite(parseFloat(s)) ? parseFloat(s) : null);

export function CardioGoalEditor({ goal }: { goal: CardioGoal | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [weekly, setWeekly] = useState(goal?.weekly_km_target?.toString() ?? "");
  const [race, setRace] = useState(goal?.race_distance_km?.toString() ?? "");
  const [raceDate, setRaceDate] = useState(goal?.race_date ?? "");

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("cardio_goal").upsert({
      id: 1,
      weekly_km_target: num(weekly),
      race_distance_km: num(race),
      race_date: raceDate || null,
    });
    setSaving(false);
    if (error) {
      toast.error(`No se pudo guardar: ${error.message}`);
      return;
    }
    setOpen(false);
    toast.success("Meta de carrera actualizada");
    router.refresh();
  }

  return (
    <>
      <button className="tb-btn" style={{ width: 28, height: 28 }} onClick={() => setOpen(true)} title="Meta de carrera">
        <Target size={14} />
      </button>
      {open && (
        <Modal title="Meta de carrera" onClose={() => setOpen(false)}>
          <Field label="Objetivo semanal (km)">
            <input className="input" inputMode="decimal" placeholder="20" value={weekly} onChange={(e) => setWeekly(e.target.value)} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Carrera objetivo (km)">
              <input className="input" inputMode="decimal" placeholder="10" value={race} onChange={(e) => setRace(e.target.value)} />
            </Field>
            <Field label="Fecha de la carrera">
              <input className="input" type="date" value={raceDate} onChange={(e) => setRaceDate(e.target.value)} />
            </Field>
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
