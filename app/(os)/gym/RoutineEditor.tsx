"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronUp, ChevronDown, Star, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/Modal";
import { MUSCLES } from "@/lib/gym/muscles";
import type { WorkoutRoutine, WorkoutDay, WorkoutExercise } from "@/lib/supabase/types";

type Routine = Pick<WorkoutRoutine, "id" | "name" | "active" | "sort_order">;
type Day = Pick<WorkoutDay, "id" | "routine_id" | "name" | "day_order" | "muscle_groups">;
type Exercise = Pick<WorkoutExercise, "id" | "day_id" | "name" | "muscle_group" | "target_sets" | "target_reps" | "sort_order">;

export function RoutineEditor({
  routines, days, exercises, label = "Editar rutina", primary = false,
}: {
  routines: WorkoutRoutine[];
  days: WorkoutDay[];
  exercises: WorkoutExercise[];
  label?: string;
  primary?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  const [wRoutines, setWRoutines] = useState<Routine[]>([]);
  const [wDays, setWDays] = useState<Day[]>([]);
  const [wEx, setWEx] = useState<Exercise[]>([]);
  const [selId, setSelId] = useState<string>("");
  const [newRoutine, setNewRoutine] = useState("");
  const [newDay, setNewDay] = useState("");
  const [exDraft, setExDraft] = useState<Record<string, { name: string; muscle: string; sets: string; reps: string }>>({});

  useEffect(() => {
    if (!open) return;
    setWRoutines(routines.map((r) => ({ id: r.id, name: r.name, active: r.active, sort_order: r.sort_order })));
    setWDays(days.map((d) => ({ id: d.id, routine_id: d.routine_id, name: d.name, day_order: d.day_order, muscle_groups: d.muscle_groups })));
    setWEx(exercises.map((e) => ({ id: e.id, day_id: e.day_id, name: e.name, muscle_group: e.muscle_group, target_sets: e.target_sets, target_reps: e.target_reps, sort_order: e.sort_order })));
    const active = routines.find((r) => r.active) ?? routines[0];
    setSelId((prev) => prev || active?.id || "");
  }, [open, routines, days, exercises]);

  function close() {
    setOpen(false);
    router.refresh();
  }

  // ── Routines ──
  async function addRoutine() {
    const name = newRoutine.trim();
    if (!name) return;
    const sort = wRoutines.reduce((m, r) => Math.max(m, r.sort_order), 0) + 1;
    const makeActive = wRoutines.length === 0;
    const { data } = await supabase.from("workout_routines").insert({ name, active: makeActive, notes: null, sort_order: sort }).select("*").single();
    if (data) {
      setWRoutines((p) => [...p, { id: data.id, name: data.name, active: data.active, sort_order: data.sort_order }]);
      setSelId(data.id);
    }
    setNewRoutine("");
  }
  async function setActiveRoutine(id: string) {
    setWRoutines((p) => p.map((r) => ({ ...r, active: r.id === id })));
    await supabase.from("workout_routines").update({ active: false }).neq("id", id);
    await supabase.from("workout_routines").update({ active: true }).eq("id", id);
  }
  async function deleteRoutine(id: string) {
    setWRoutines((p) => p.filter((r) => r.id !== id));
    setWDays((p) => p.filter((d) => d.routine_id !== id));
    if (selId === id) setSelId(wRoutines.find((r) => r.id !== id)?.id ?? "");
    await supabase.from("workout_routines").delete().eq("id", id);
  }

  // ── Days ──
  const selDays = wDays.filter((d) => d.routine_id === selId).sort((a, b) => a.day_order - b.day_order);

  async function addDay() {
    const name = newDay.trim();
    if (!name || !selId) return;
    const order = selDays.reduce((m, d) => Math.max(m, d.day_order), -1) + 1;
    const { data } = await supabase.from("workout_days").insert({ routine_id: selId, name, day_order: order, muscle_groups: [] }).select("*").single();
    if (data) setWDays((p) => [...p, { id: data.id, routine_id: data.routine_id, name: data.name, day_order: data.day_order, muscle_groups: data.muscle_groups }]);
    setNewDay("");
  }
  function renameDayLocal(id: string, name: string) {
    setWDays((p) => p.map((d) => (d.id === id ? { ...d, name } : d)));
  }
  async function persistDayName(id: string, name: string) {
    await supabase.from("workout_days").update({ name: name.trim() || "Día" }).eq("id", id);
  }
  async function deleteDay(id: string) {
    setWDays((p) => p.filter((d) => d.id !== id));
    setWEx((p) => p.filter((e) => e.day_id !== id));
    await supabase.from("workout_days").delete().eq("id", id);
  }
  async function moveDay(id: string, dir: -1 | 1) {
    const ordered = [...selDays];
    const i = ordered.findIndex((d) => d.id === id);
    const j = i + dir;
    if (j < 0 || j >= ordered.length) return;
    const a = ordered[i], b = ordered[j];
    setWDays((p) => p.map((d) => (d.id === a.id ? { ...d, day_order: b.day_order } : d.id === b.id ? { ...d, day_order: a.day_order } : d)));
    await supabase.from("workout_days").update({ day_order: b.day_order }).eq("id", a.id);
    await supabase.from("workout_days").update({ day_order: a.day_order }).eq("id", b.id);
  }
  async function toggleMuscle(dayId: string, key: string) {
    const day = wDays.find((d) => d.id === dayId);
    if (!day) return;
    const next = day.muscle_groups.includes(key) ? day.muscle_groups.filter((m) => m !== key) : [...day.muscle_groups, key];
    setWDays((p) => p.map((d) => (d.id === dayId ? { ...d, muscle_groups: next } : d)));
    await supabase.from("workout_days").update({ muscle_groups: next }).eq("id", dayId);
  }

  // ── Exercises ──
  async function addExercise(dayId: string) {
    const draft = exDraft[dayId];
    const name = draft?.name?.trim();
    if (!name) return;
    const dayEx = wEx.filter((e) => e.day_id === dayId);
    const order = dayEx.reduce((m, e) => Math.max(m, e.sort_order), -1) + 1;
    const sets = parseInt(draft.sets) || 3;
    const { data } = await supabase.from("workout_exercises").insert({
      day_id: dayId, name, muscle_group: draft.muscle || null, target_sets: sets, target_reps: draft.reps?.trim() || null, sort_order: order,
    }).select("*").single();
    if (data) setWEx((p) => [...p, { id: data.id, day_id: data.day_id, name: data.name, muscle_group: data.muscle_group, target_sets: data.target_sets, target_reps: data.target_reps, sort_order: data.sort_order }]);
    setExDraft((p) => ({ ...p, [dayId]: { name: "", muscle: draft?.muscle ?? "", sets: "3", reps: "" } }));
  }
  function updateExLocal(id: string, patch: Partial<Exercise>) {
    setWEx((p) => p.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }
  async function persistEx(id: string) {
    const e = wEx.find((x) => x.id === id);
    if (!e) return;
    await supabase.from("workout_exercises").update({ name: e.name.trim() || "Ejercicio", muscle_group: e.muscle_group, target_sets: e.target_sets, target_reps: e.target_reps }).eq("id", id);
  }
  async function deleteExercise(id: string) {
    setWEx((p) => p.filter((e) => e.id !== id));
    await supabase.from("workout_exercises").delete().eq("id", id);
  }

  const draftFor = (dayId: string) => exDraft[dayId] ?? { name: "", muscle: "", sets: "3", reps: "" };

  return (
    <>
      <button className={`btn btn-${primary ? "primary" : "ghost"} btn-sm`} onClick={() => setOpen(true)}>
        <Pencil size={13} /> {label}
      </button>
      {open && (
        <Modal title="Editor de rutina" onClose={close} wide>
          {/* Rutinas */}
          <div className="re-routines">
            {wRoutines.map((r) => (
              <div key={r.id} className={`re-routine-chip${r.id === selId ? " sel" : ""}`} onClick={() => setSelId(r.id)}>
                {r.active && <Star size={11} style={{ color: "var(--gold)" }} fill="var(--gold)" />}
                <span>{r.name}</span>
              </div>
            ))}
          </div>
          <div className="re-routine-actions">
            <input className="input" style={{ flex: 1 }} placeholder="Nueva rutina (ej. Upper/Lower)" value={newRoutine}
              onChange={(e) => setNewRoutine(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRoutine()} />
            <button className="btn btn-ghost btn-sm" onClick={addRoutine}><Plus size={13} /></button>
            {selId && (
              <>
                {!wRoutines.find((r) => r.id === selId)?.active && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setActiveRoutine(selId)}><Star size={12} /> Activar</button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => deleteRoutine(selId)} style={{ color: "var(--red)" }}><Trash2 size={13} /></button>
              </>
            )}
          </div>

          {/* Días del routine seleccionado */}
          {selId && (
            <div className="re-days">
              {selDays.map((d) => {
                const dayEx = wEx.filter((e) => e.day_id === d.id).sort((a, b) => a.sort_order - b.sort_order);
                const draft = draftFor(d.id);
                return (
                  <div key={d.id} className="re-day">
                    <div className="re-day-head">
                      <input className="re-day-name" value={d.name}
                        onChange={(e) => renameDayLocal(d.id, e.target.value)} onBlur={(e) => persistDayName(d.id, e.target.value)} />
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="tb-btn" style={{ width: 26, height: 26 }} onClick={() => moveDay(d.id, -1)}><ChevronUp size={13} /></button>
                        <button className="tb-btn" style={{ width: 26, height: 26 }} onClick={() => moveDay(d.id, 1)}><ChevronDown size={13} /></button>
                        <button className="tb-btn" style={{ width: 26, height: 26, color: "var(--red)" }} onClick={() => deleteDay(d.id)}><Trash2 size={12} /></button>
                      </div>
                    </div>

                    <div className="re-muscles">
                      {MUSCLES.map((m) => (
                        <button key={m.key} className={`re-muscle${d.muscle_groups.includes(m.key) ? " on" : ""}`} onClick={() => toggleMuscle(d.id, m.key)}>
                          {m.label}
                        </button>
                      ))}
                    </div>

                    <div className="re-ex-list">
                      {dayEx.map((e) => (
                        <div key={e.id} className="re-ex-row">
                          <input className="input" style={{ flex: 1 }} value={e.name}
                            onChange={(ev) => updateExLocal(e.id, { name: ev.target.value })} onBlur={() => persistEx(e.id)} />
                          <select className="input" style={{ width: 110 }} value={e.muscle_group ?? ""}
                            onChange={(ev) => { updateExLocal(e.id, { muscle_group: ev.target.value || null }); }}
                            onBlur={() => persistEx(e.id)}>
                            <option value="">—</option>
                            {MUSCLES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                          </select>
                          <input className="input" style={{ width: 44 }} value={e.target_sets}
                            onChange={(ev) => updateExLocal(e.id, { target_sets: parseInt(ev.target.value) || 0 })} onBlur={() => persistEx(e.id)} />
                          <span className="gym-set-x">×</span>
                          <input className="input" style={{ width: 64 }} placeholder="reps" value={e.target_reps ?? ""}
                            onChange={(ev) => updateExLocal(e.id, { target_reps: ev.target.value })} onBlur={() => persistEx(e.id)} />
                          <button className="gym-set-del" onClick={() => deleteExercise(e.id)}><Trash2 size={12} /></button>
                        </div>
                      ))}
                      <div className="re-ex-add">
                        <input className="input" style={{ flex: 1 }} placeholder="Nuevo ejercicio" value={draft.name}
                          onChange={(e) => setExDraft((p) => ({ ...p, [d.id]: { ...draft, name: e.target.value } }))}
                          onKeyDown={(e) => e.key === "Enter" && addExercise(d.id)} />
                        <select className="input" style={{ width: 110 }} value={draft.muscle}
                          onChange={(e) => setExDraft((p) => ({ ...p, [d.id]: { ...draft, muscle: e.target.value } }))}>
                          <option value="">Músculo…</option>
                          {MUSCLES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                        </select>
                        <input className="input" style={{ width: 44 }} placeholder="3" value={draft.sets}
                          onChange={(e) => setExDraft((p) => ({ ...p, [d.id]: { ...draft, sets: e.target.value } }))} />
                        <span className="gym-set-x">×</span>
                        <input className="input" style={{ width: 64 }} placeholder="8-12" value={draft.reps}
                          onChange={(e) => setExDraft((p) => ({ ...p, [d.id]: { ...draft, reps: e.target.value } }))} />
                        <button className="btn btn-ghost btn-sm" onClick={() => addExercise(d.id)}><Plus size={13} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="re-routine-actions">
                <input className="input" style={{ flex: 1 }} placeholder="Nuevo día (ej. Push, Pierna)" value={newDay}
                  onChange={(e) => setNewDay(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addDay()} />
                <button className="btn btn-ghost btn-sm" onClick={addDay}><Plus size={13} /> Día</button>
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button className="btn btn-primary btn-sm" onClick={close}>Listo</button>
          </div>
        </Modal>
      )}
    </>
  );
}
