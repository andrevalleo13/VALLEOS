"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";
import { useQuickAction } from "@/lib/store";
import { MUSCLES } from "@/lib/gym/muscles";
import type { WorkoutRoutine, WorkoutDay, WorkoutExercise } from "@/lib/supabase/types";

const num = (s: string) => (s.trim() && isFinite(parseFloat(s)) ? parseFloat(s) : null);
const int = (s: string) => (s.trim() && isFinite(parseInt(s)) ? parseInt(s) : null);

type SetRow = { weight: string; reps: string; duration: string };
type Entry = { dayId: string | null; exerciseId: string | null; name: string; muscle: string | null; trackingType: string; sets: SetRow[] };

const emptySet = (): SetRow => ({ weight: "", reps: "", duration: "" });

export function LogSession({
  routines, days, exercises, suggestedDayIds,
}: {
  routines: WorkoutRoutine[];
  days: WorkoutDay[];
  exercises: WorkoutExercise[];
  suggestedDayIds: string[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  useQuickAction("entreno", () => setOpen(true));

  const activeRoutine = routines.find((r) => r.active) ?? routines[0] ?? null;
  const routineName = (rid: string) => routines.find((r) => r.id === rid)?.name ?? "";
  // Días disponibles para apilar: activos primero, agrupados por rutina.
  const orderedDays = [...days].sort((a, b) => {
    const ra = a.routine_id === activeRoutine?.id ? 0 : 1;
    const rb = b.routine_id === activeRoutine?.id ? 0 : 1;
    return ra - rb || a.day_order - b.day_order;
  });

  const initialDays = suggestedDayIds.length
    ? suggestedDayIds
    : orderedDays[0]
    ? [orderedDays[0].id]
    : [];

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [duration, setDuration] = useState("");
  const [bodyweight, setBodyweight] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedDayIds, setSelectedDayIds] = useState<string[]>(initialDays);
  const [entries, setEntries] = useState<Entry[]>(() => initialDays.flatMap(dayEntries));

  function dayEntries(dId: string): Entry[] {
    return exercises
      .filter((e) => e.day_id === dId)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((e) => ({
        dayId: dId,
        exerciseId: e.id,
        name: e.name,
        muscle: e.muscle_group,
        trackingType: (e as any).tracking_type ?? "strength",
        sets: Array.from({ length: Math.max(1, e.target_sets) }, emptySet),
      }));
  }

  function toggleDay(dId: string) {
    setSelectedDayIds((prev) => {
      if (prev.includes(dId)) {
        setEntries((es) => es.filter((e) => e.dayId !== dId));
        return prev.filter((x) => x !== dId);
      }
      setEntries((es) => [...es, ...dayEntries(dId)]);
      return [...prev, dId];
    });
  }

  function setCell(ei: number, si: number, field: keyof SetRow, val: string) {
    setEntries((prev) => {
      const next = prev.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) }));
      next[ei].sets[si][field] = val;
      return next;
    });
  }
  function addSet(ei: number) {
    setEntries((prev) => {
      const next = prev.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) }));
      const last = next[ei].sets[next[ei].sets.length - 1];
      next[ei].sets.push({ weight: last?.weight ?? "", reps: last?.reps ?? "", duration: last?.duration ?? "" });
      return next;
    });
  }
  function removeSet(ei: number, si: number) {
    setEntries((prev) => {
      const next = prev.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) }));
      next[ei].sets.splice(si, 1);
      if (next[ei].sets.length === 0) next[ei].sets.push(emptySet());
      return next;
    });
  }
  function addCustom() {
    setEntries((prev) => [...prev, { dayId: null, exerciseId: null, name: "", muscle: null, trackingType: "strength", sets: [emptySet()] }]);
  }
  function removeEntry(ei: number) {
    setEntries((prev) => prev.filter((_, i) => i !== ei));
  }
  function setEntryField(ei: number, field: "name" | "muscle" | "trackingType", val: string) {
    setEntries((prev) => {
      const next = prev.map((e) => ({ ...e }));
      if (field === "name") next[ei].name = val;
      else if (field === "muscle") next[ei].muscle = val || null;
      else next[ei].trackingType = val;
      return next;
    });
  }

  function reset() {
    setSelectedDayIds(initialDays);
    setEntries(initialDays.flatMap(dayEntries));
    setDuration(""); setBodyweight(""); setNotes("");
  }

  async function save() {
    const rows: any[] = [];
    for (const e of entries) {
      const name = e.name.trim();
      if (!name) continue;
      let setNum = 0;
      for (const s of e.sets) {
        const w = num(s.weight);
        const r = int(s.reps);
        const d = int(s.duration);
        if (e.trackingType === "timed") {
          if (d == null) continue;
        } else {
          if (w == null && r == null) continue;
        }
        setNum++;
        rows.push({
          exercise_id: e.exerciseId,
          exercise_name: name,
          muscle_group: e.muscle,
          set_number: setNum,
          weight_kg: e.trackingType === "strength" ? w : null,
          reps: e.trackingType !== "timed" ? r : null,
          duration_seconds: e.trackingType === "timed" ? d : null,
          rpe: null,
        });
      }
    }

    if (rows.length === 0) {
      toast.error("Captura al menos una serie con peso, reps o tiempo.");
      return;
    }

    setSaving(true);
    const selDays = selectedDayIds.map((id) => days.find((d) => d.id === id)).filter(Boolean) as WorkoutDay[];
    const dayName = selDays.map((d) => d.name).join(" + ") || null;
    const routineId = selDays[0]?.routine_id ?? activeRoutine?.id ?? null;

    const { data: sess, error: e1 } = await supabase
      .from("workout_sessions")
      .insert({
        date,
        routine_id: routineId,
        day_id: selDays[0]?.id ?? null,
        day_name: dayName,
        duration_minutes: int(duration),
        bodyweight_kg: num(bodyweight),
        notes: notes.trim() || null,
      })
      .select("id")
      .single();

    if (e1 || !sess) {
      setSaving(false);
      toast.error(`No se pudo guardar la sesión: ${e1?.message ?? "error desconocido"}`);
      return;
    }

    const { error: e2 } = await supabase
      .from("workout_sets")
      .insert(rows.map((r) => ({ ...r, session_id: sess.id })));

    if (e2) {
      // Evita una sesión huérfana sin series.
      await supabase.from("workout_sessions").delete().eq("id", sess.id);
      setSaving(false);
      toast.error(`No se guardaron las series: ${e2.message}`);
      return;
    }

    setSaving(false);
    setOpen(false);
    toast.success(`Sesión guardada · ${rows.length} series${dayName ? ` · ${dayName}` : ""}`);
    reset();
    router.refresh();
  }

  const noRoutine = days.length === 0;

  return (
    <>
      <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)} disabled={noRoutine}>
        <Plus size={14} /> Registrar sesión
      </button>
      {open && (
        <Modal title="Registrar entrenamiento" onClose={() => setOpen(false)} wide>
          <Field label="Fecha">
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 200 }} />
          </Field>

          <div style={{ marginTop: 10 }}>
            <p className="modal-field-label" style={{ marginBottom: 6 }}>Días de esta sesión</p>
            <div className="gym-day-pick">
              {orderedDays.map((d) => (
                <button
                  key={d.id}
                  className={`gym-day-chip${selectedDayIds.includes(d.id) ? " on" : ""}`}
                  onClick={() => toggleDay(d.id)}
                >
                  {d.name}
                  {d.routine_id !== activeRoutine?.id && (
                    <span className="gym-day-chip-rt">{routineName(d.routine_id)}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
            {entries.map((e, ei) => (
              <div key={ei} className="gym-log-ex">
                <div className="gym-log-ex-head">
                  {e.exerciseId ? (
                    <>
                      <span className="gym-log-ex-name">{e.name}</span>
                      {e.trackingType !== "strength" && (
                        <span style={{ fontSize: 10, color: "var(--gold)", fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {e.trackingType === "timed" ? "⏱ tiempo" : "bw"}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <input className="input" style={{ flex: 1 }} placeholder="Ejercicio" value={e.name} onChange={(ev) => setEntryField(ei, "name", ev.target.value)} />
                      <select className="input" style={{ width: 130 }} value={e.muscle ?? ""} onChange={(ev) => setEntryField(ei, "muscle", ev.target.value)}>
                        <option value="">Músculo…</option>
                        {MUSCLES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                      </select>
                      <select className="input" style={{ width: 80, fontSize: 11 }} value={e.trackingType} onChange={(ev) => setEntryField(ei, "trackingType", ev.target.value)}>
                        <option value="strength">Fuerza</option>
                        <option value="timed">Tiempo</option>
                        <option value="bodyweight">BW</option>
                      </select>
                    </>
                  )}
                  <button className="habit-del" onClick={() => removeEntry(ei)} title="Quitar"><Trash2 size={13} /></button>
                </div>
                <div className="gym-set-rows">
                  {e.sets.map((s, si) => (
                    <div key={si} className="gym-set-row">
                      <span className="gym-set-num">{si + 1}</span>
                      {e.trackingType === "timed" ? (
                        <>
                          <input
                            className="input gym-set-input"
                            inputMode="numeric"
                            placeholder="seg"
                            value={s.duration}
                            onChange={(ev) => setCell(ei, si, "duration", ev.target.value)}
                          />
                          <span className="gym-set-x" style={{ fontSize: 11, color: "var(--mute)" }}>seg</span>
                        </>
                      ) : (
                        <>
                          {e.trackingType === "strength" && (
                            <>
                              <input
                                className="input gym-set-input"
                                inputMode="decimal"
                                placeholder="kg"
                                value={s.weight}
                                onChange={(ev) => setCell(ei, si, "weight", ev.target.value)}
                              />
                              <span className="gym-set-x">×</span>
                            </>
                          )}
                          <input
                            className="input gym-set-input"
                            inputMode="numeric"
                            placeholder="reps"
                            value={s.reps}
                            onChange={(ev) => setCell(ei, si, "reps", ev.target.value)}
                          />
                        </>
                      )}
                      <button className="gym-set-del" onClick={() => removeSet(ei, si)} title="Quitar serie"><X size={12} /></button>
                    </div>
                  ))}
                  <button className="gym-add-set" onClick={() => addSet(ei)}><Plus size={12} /> serie</button>
                </div>
              </div>
            ))}
            {entries.length === 0 && (
              <p className="tick">Elige un día arriba o agrega un ejercicio libre.</p>
            )}
            <button className="btn btn-ghost btn-sm" onClick={addCustom} style={{ alignSelf: "flex-start" }}>
              <Plus size={13} /> Ejercicio libre
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 6 }}>
            <Field label="Duración (min)">
              <input className="input" inputMode="numeric" placeholder="60" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </Field>
            <Field label="Peso corporal (kg)">
              <input className="input" inputMode="decimal" placeholder="72" value={bodyweight} onChange={(e) => setBodyweight(e.target.value)} />
            </Field>
          </div>
          <Field label="Notas">
            <input className="input" placeholder="Cómo se sintió la sesión" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar sesión"}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
