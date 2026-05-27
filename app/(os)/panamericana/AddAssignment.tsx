"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";
import { syncAssignment } from "@/lib/academia/calendar";

export function AddAssignment({
  courses,
  variant = "ghost",
  label = "Entrega",
}: {
  courses: { id: string; name: string }[];
  variant?: "ghost" | "primary";
  label?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [weight, setWeight] = useState("");
  const [status, setStatus] = useState("pending");
  const [saving, setSaving] = useState(false);

  const disabled = courses.length === 0;

  async function save() {
    if (!title.trim() || !courseId) return;
    setSaving(true);
    let calendarEventId: string | null = null;
    if (dueDate) {
      calendarEventId = await syncAssignment({
        title: title.trim(),
        courseName: courses.find((c) => c.id === courseId)?.name,
        dueDate,
        dueTime: dueTime || null,
      });
    }
    await supabase.from("assignments").insert({
      course_id: courseId,
      title: title.trim(),
      description: null,
      due_date: dueDate || null,
      due_time: dueTime || null,
      weight: weight.trim() ? parseFloat(weight) : null,
      grade: null,
      status,
      calendar_event_id: calendarEventId,
    });
    setSaving(false);
    setOpen(false);
    setTitle(""); setDueDate(""); setDueTime(""); setWeight("");
    router.refresh();
  }

  return (
    <>
      <button className={`btn btn-${variant} btn-sm`} onClick={() => setOpen(true)} disabled={disabled} title={disabled ? "Agrega una materia primero" : ""}>
        <Plus size={13} /> {label}
      </button>
      {open && (
        <Modal title="Nueva entrega" onClose={() => setOpen(false)}>
          <Field label="Materia">
            <select className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Título">
            <input className="input" autoFocus placeholder="ej. Ensayo final" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Fecha de entrega">
              <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <Field label="Hora límite (opcional)">
              <input className="input" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
            </Field>
            <Field label="Peso (% de la calif.)">
              <input className="input" type="number" placeholder="20" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </Field>
          </div>
          {dueDate && (
            <p className="tick" style={{ marginTop: -4 }}>Se agregará a tu Google Calendar.</p>
          )}
          <Field label="Estado">
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="pending">Pendiente</option>
              <option value="doing">En proceso</option>
              <option value="done">Entregado</option>
            </select>
          </Field>
          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !title.trim() || !courseId}>
              {saving ? "Guardando…" : "Agregar entrega"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
