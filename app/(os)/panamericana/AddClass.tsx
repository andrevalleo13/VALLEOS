"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";
import { syncClass } from "@/lib/academia/calendar";

const DAYS = [
  { v: 1, l: "Lunes" }, { v: 2, l: "Martes" }, { v: 3, l: "Miércoles" },
  { v: 4, l: "Jueves" }, { v: 5, l: "Viernes" }, { v: 6, l: "Sábado" }, { v: 0, l: "Domingo" },
];

export function AddClass({
  courses,
  variant = "ghost",
  label = "Clase",
}: {
  courses: { id: string; name: string }[];
  variant?: "ghost" | "primary";
  label?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [day, setDay] = useState(1);
  const [start, setStart] = useState("07:00");
  const [end, setEnd] = useState("08:30");
  const [room, setRoom] = useState("");
  const [saving, setSaving] = useState(false);

  const disabled = courses.length === 0;

  async function save() {
    if (!courseId) return;
    setSaving(true);
    const calendarEventId = await syncClass({
      courseName: courses.find((c) => c.id === courseId)?.name ?? "Clase",
      dayOfWeek: day,
      startTime: start,
      endTime: end,
      room: room.trim() || null,
    });
    await supabase.from("class_schedule").insert({
      course_id: courseId, day_of_week: day, start_time: start, end_time: end, room: room.trim() || null,
      calendar_event_id: calendarEventId,
    });
    setSaving(false);
    setOpen(false);
    setRoom("");
    router.refresh();
  }

  return (
    <>
      <button className={`btn btn-${variant} btn-sm`} onClick={() => setOpen(true)} disabled={disabled} title={disabled ? "Agrega una materia primero" : ""}>
        <CalendarPlus size={13} /> {label}
      </button>
      {open && (
        <Modal title="Agregar clase al horario" onClose={() => setOpen(false)}>
          <Field label="Materia">
            <select className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Día">
            <select className="input" value={day} onChange={(e) => setDay(parseInt(e.target.value))}>
              {DAYS.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
            </select>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Inicio">
              <input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="Fin">
              <input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
          <Field label="Salón (opcional)">
            <input className="input" placeholder="ej. A-305" value={room} onChange={(e) => setRoom(e.target.value)} />
          </Field>
          <p className="tick" style={{ marginTop: -4 }}>Se agregará como evento semanal recurrente a tu Google Calendar.</p>
          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !courseId}>
              {saving ? "Guardando…" : "Agregar clase"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
