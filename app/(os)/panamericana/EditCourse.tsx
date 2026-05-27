"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";
import { ColorPicker } from "@/components/ColorPicker";
import { deleteCalEvent } from "@/lib/academia/calendar";
import type { AcademicCourse } from "@/lib/supabase/types";

export function EditCourse({ course }: { course: AcademicCourse }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(course.name);
  const [professor, setProfessor] = useState(course.professor ?? "");
  const [email, setEmail] = useState(course.professor_email ?? "");
  const [code, setCode] = useState(course.code ?? "");
  const [credits, setCredits] = useState(course.credits != null ? String(course.credits) : "");
  const [target, setTarget] = useState(String(course.target_grade));
  const [maxAbsences, setMaxAbsences] = useState(course.max_absences != null ? String(course.max_absences) : "");
  const [color, setColor] = useState(course.color);
  const [notes, setNotes] = useState(course.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from("academic_courses").update({
      name: name.trim(),
      professor: professor.trim() || null,
      professor_email: email.trim() || null,
      code: code.trim() || null,
      credits: credits.trim() ? parseInt(credits) : null,
      target_grade: target.trim() ? parseFloat(target) : 9,
      max_absences: maxAbsences.trim() ? parseInt(maxAbsences) : null,
      color,
      notes: notes.trim() || null,
    }).eq("id", course.id);
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm(`¿Eliminar ${course.name}? Se borran sus componentes, horario y entregas.`)) return;
    setDeleting(true);
    // Limpia eventos de calendario asociados (best-effort) antes de borrar en cascada.
    const [{ data: comps }, { data: classes }, { data: assigns }] = await Promise.all([
      supabase.from("grade_components").select("calendar_event_id, study_event_id").eq("course_id", course.id),
      supabase.from("class_schedule").select("calendar_event_id").eq("course_id", course.id),
      supabase.from("assignments").select("calendar_event_id").eq("course_id", course.id),
    ]);
    const ids = [
      ...(comps ?? []).flatMap((c) => [c.calendar_event_id, c.study_event_id]),
      ...(classes ?? []).map((c) => c.calendar_event_id),
      ...(assigns ?? []).map((a) => a.calendar_event_id),
    ].filter(Boolean) as string[];
    await Promise.all(ids.map((id) => deleteCalEvent(id)));
    await supabase.from("academic_courses").delete().eq("id", course.id);
    setDeleting(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        <Pencil size={13} /> Editar materia
      </button>
      {open && (
        <Modal title="Editar materia" onClose={() => setOpen(false)}>
          <Field label="Nombre">
            <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Profesor">
              <input className="input" value={professor} onChange={(e) => setProfessor(e.target.value)} />
            </Field>
            <Field label="Correo del profesor">
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Código">
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Field label="Créditos">
              <input className="input" type="number" value={credits} onChange={(e) => setCredits(e.target.value)} />
            </Field>
            <Field label="Objetivo (meta de calif.)">
              <input className="input" type="number" step="0.1" value={target} onChange={(e) => setTarget(e.target.value)} />
            </Field>
            <Field label="Faltas permitidas">
              <input className="input" type="number" value={maxAbsences} onChange={(e) => setMaxAbsences(e.target.value)} />
            </Field>
          </div>
          <Field label="Color">
            <ColorPicker value={color} onChange={setColor} />
          </Field>
          <Field label="Notas">
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <div className="modal-actions" style={{ justifyContent: "space-between" }}>
            <button className="btn btn-ghost btn-sm" onClick={remove} disabled={deleting} style={{ color: "var(--red)" }}>
              <Trash2 size={13} /> {deleting ? "Eliminando…" : "Eliminar"}
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !name.trim()}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
