"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, X, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/Modal";
import { WEEK_ORDER, type Weekday } from "@/lib/gym/schedule";
import type { WorkoutRoutine, WorkoutDay, WorkoutSchedule } from "@/lib/supabase/types";

type Row = Pick<WorkoutSchedule, "id" | "weekday" | "day_id" | "sort_order">;

export function ScheduleEditor({
  routines, days, schedule, label = "Horario",
}: {
  routines: WorkoutRoutine[];
  days: WorkoutDay[];
  schedule: WorkoutSchedule[];
  label?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (open) setRows(schedule.map((s) => ({ id: s.id, weekday: s.weekday, day_id: s.day_id, sort_order: s.sort_order })));
  }, [open, schedule]);

  const activeRoutine = routines.find((r) => r.active) ?? routines[0] ?? null;
  const routineName = (rid: string) => routines.find((r) => r.id === rid)?.name ?? "";
  const dayName = (id: string) => days.find((d) => d.id === id)?.name ?? "Día";
  const orderedDays = [...days].sort((a, b) => {
    const ra = a.routine_id === activeRoutine?.id ? 0 : 1;
    const rb = b.routine_id === activeRoutine?.id ? 0 : 1;
    return ra - rb || a.day_order - b.day_order;
  });

  function close() {
    setOpen(false);
    router.refresh();
  }

  async function addDay(weekday: Weekday, day_id: string) {
    if (!day_id) return;
    const order = rows.filter((r) => r.weekday === weekday).reduce((m, r) => Math.max(m, r.sort_order), -1) + 1;
    const { data } = await supabase
      .from("workout_schedule")
      .insert({ weekday, day_id, sort_order: order })
      .select("*")
      .single();
    if (data) setRows((p) => [...p, { id: data.id, weekday: data.weekday, day_id: data.day_id, sort_order: data.sort_order }]);
  }
  async function removeRow(id: string) {
    setRows((p) => p.filter((r) => r.id !== id));
    await supabase.from("workout_schedule").delete().eq("id", id);
  }

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        <CalendarDays size={13} /> {label}
      </button>
      {open && (
        <Modal title="Horario semanal" onClose={close} wide>
          <p className="tick" style={{ marginBottom: 14 }}>
            Asigna qué toca cada día. Puedes poner varias rutinas el mismo día (ej. Upper + Abdomen). Sin nada = descanso.
          </p>
          <div className="gym-sched-edit">
            {WEEK_ORDER.map(({ idx, label }) => {
              const dayRows = rows.filter((r) => r.weekday === idx).sort((a, b) => a.sort_order - b.sort_order);
              return (
                <div key={idx} className="gym-sched-row">
                  <span className="gym-sched-wd">{label}</span>
                  <div className="gym-sched-assigned">
                    {dayRows.length === 0 && <span className="gym-sched-rest">Descanso</span>}
                    {dayRows.map((r) => (
                      <span key={r.id} className="gym-sched-tag">
                        {dayName(r.day_id)}
                        <button onClick={() => removeRow(r.id)} aria-label="Quitar"><X size={11} /></button>
                      </span>
                    ))}
                    <select
                      className="input gym-sched-add"
                      value=""
                      onChange={(e) => { addDay(idx, e.target.value); e.target.value = ""; }}
                    >
                      <option value="">+ día…</option>
                      {orderedDays.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}{d.routine_id !== activeRoutine?.id ? ` · ${routineName(d.routine_id)}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
          {days.length === 0 && (
            <p className="tick" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={12} /> Primero crea días en tu rutina (botón “Editar rutina”).
            </p>
          )}
          <div className="modal-actions">
            <button className="btn btn-primary btn-sm" onClick={close}>Listo</button>
          </div>
        </Modal>
      )}
    </>
  );
}
