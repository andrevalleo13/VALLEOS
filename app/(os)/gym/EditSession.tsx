"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";
import { MUSCLES } from "@/lib/gym/muscles";
import type { WorkoutSession, WorkoutSet } from "@/lib/supabase/types";

const num = (s: string) => (s.trim() && isFinite(parseFloat(s)) ? parseFloat(s) : null);
const int = (s: string) => (s.trim() && isFinite(parseInt(s)) ? parseInt(s) : null);

type SetRow = { weight: string; reps: string; duration: string };
type Entry = { exerciseId: string | null; name: string; muscle: string | null; trackingType: string; sets: SetRow[] };

const emptySet = (): SetRow => ({ weight: "", reps: "", duration: "" });

function buildEntries(sets: WorkoutSet[]): Entry[] {
  const order: string[] = [];
  const map = new Map<string, { ex: WorkoutSet; rows: WorkoutSet[] }>();
  for (const s of sets) {
    const key = (s.exercise_id ?? "") + "|" + s.exercise_name;
    if (!map.has(key)) { map.set(key, { ex: s, rows: [] }); order.push(key); }
    map.get(key)!.rows.push(s);
  }
  return order.map((key) => {
    const { ex, rows } = map.get(key)!;
    rows.sort((a, b) => a.set_number - b.set_number);
    const tracking = rows.some((r) => r.duration_seconds != null)
      ? "timed"
      : rows.some((r) => r.weight_kg != null)
      ? "strength"
      : "bodyweight";
    return {
      exerciseId: ex.exercise_id,
      name: ex.exercise_name,
      muscle: ex.muscle_group,
      trackingType: tracking,
      sets: rows.map((r) => ({
        weight: r.weight_kg?.toString() ?? "",
        reps: r.reps?.toString() ?? "",
        duration: r.duration_seconds?.toString() ?? "",
      })),
    };
  });
}

export function EditSession({
  session, sets, onClose,
}: {
  session: WorkoutSession;
  sets: WorkoutSet[];
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const [date, setDate] = useState(session.date);
  const [duration, setDuration] = useState(session.duration_minutes?.toString() ?? "");
  const [bodyweight, setBodyweight] = useState(session.bodyweight_kg?.toString() ?? "");
  const [notes, setNotes] = useState(session.notes ?? "");
  const [entries, setEntries] = useState<Entry[]>(() => buildEntries(sets));

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
    setEntries((prev) => [...prev, { exerciseId: null, name: "", muscle: null, trackingType: "strength", sets: [emptySet()] }]);
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
          session_id: session.id,
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
      toast.error("Deja al menos una serie, o elimina la sesión completa.");
      return;
    }

    setSaving(true);
    const oldIds = sets.map((s) => s.id);

    await supabase
      .from("workout_sessions")
      .update({
        date,
        duration_minutes: int(duration),
        bodyweight_kg: num(bodyweight),
        notes: notes.trim() || null,
      })
      .eq("id", session.id);

    // Inserta las nuevas series primero; solo si funciona, borra las viejas
    // (evita perder datos si el insert falla).
    const { error: insErr } = await supabase.from("workout_sets").insert(rows);
    if (insErr) {
      setSaving(false);
      toast.error(`No se guardaron los cambios: ${insErr.message}`);
      return;
    }
    if (oldIds.length) await supabase.from("workout_sets").delete().in("id", oldIds);

    setSaving(false);
    toast.success("Sesión actualizada");
    onClose();
    router.refresh();
  }

  async function del() {
    setSaving(true);
    const { error } = await supabase.from("workout_sessions").delete().eq("id", session.id);
    setSaving(false);
    if (error) {
      toast.error(`No se pudo eliminar: ${error.message}`);
      return;
    }
    toast.success("Sesión eliminada");
    onClose();
    router.refresh();
  }

  return (
    <Modal title={`Editar · ${session.day_name ?? "sesión"}`} onClose={onClose} wide>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Fecha">
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Duración (min)">
          <input className="input" inputMode="numeric" placeholder="60" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </Field>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 6 }}>
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
              <button className="habit-del" onClick={() => removeEntry(ei)} title="Quitar ejercicio"><Trash2 size={13} /></button>
            </div>
            <div className="gym-set-rows">
              {e.sets.map((s, si) => (
                <div key={si} className="gym-set-row">
                  <span className="gym-set-num">{si + 1}</span>
                  {e.trackingType === "timed" ? (
                    <>
                      <input className="input gym-set-input" inputMode="numeric" placeholder="seg" value={s.duration} onChange={(ev) => setCell(ei, si, "duration", ev.target.value)} />
                      <span className="gym-set-x" style={{ fontSize: 11, color: "var(--mute)" }}>seg</span>
                    </>
                  ) : (
                    <>
                      {e.trackingType === "strength" && (
                        <>
                          <input className="input gym-set-input" inputMode="decimal" placeholder="kg" value={s.weight} onChange={(ev) => setCell(ei, si, "weight", ev.target.value)} />
                          <span className="gym-set-x">×</span>
                        </>
                      )}
                      <input className="input gym-set-input" inputMode="numeric" placeholder="reps" value={s.reps} onChange={(ev) => setCell(ei, si, "reps", ev.target.value)} />
                    </>
                  )}
                  <button className="gym-set-del" onClick={() => removeSet(ei, si)} title="Quitar serie"><X size={12} /></button>
                </div>
              ))}
              <button className="gym-add-set" onClick={() => addSet(ei)}><Plus size={12} /> serie</button>
            </div>
          </div>
        ))}
        {entries.length === 0 && <p className="tick">Sin ejercicios. Agrega uno o elimina la sesión.</p>}
        <button className="btn btn-ghost btn-sm" onClick={addCustom} style={{ alignSelf: "flex-start" }}>
          <Plus size={13} /> Ejercicio libre
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 6 }}>
        <Field label="Peso corporal (kg)">
          <input className="input" inputMode="decimal" placeholder="72" value={bodyweight} onChange={(e) => setBodyweight(e.target.value)} />
        </Field>
        <Field label="Notas">
          <input className="input" placeholder="Cómo se sintió" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>

      <div className="modal-actions" style={{ justifyContent: "space-between" }}>
        {confirmDel ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="tick" style={{ color: "var(--red)" }}>¿Eliminar?</span>
            <button className="btn btn-ghost btn-sm" onClick={del} disabled={saving} style={{ color: "var(--red)" }}>Sí, eliminar</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(false)}>No</button>
          </div>
        ) : (
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(true)} style={{ color: "var(--red)" }}>
            <Trash2 size={13} /> Eliminar sesión
          </button>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </Modal>
  );
}
