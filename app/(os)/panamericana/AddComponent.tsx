"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";
import { suggestStudyStart, DIFFICULTY_LABELS, KIND_LABELS } from "@/lib/academia/grades";

const KINDS = ["examen", "tarea", "proyecto", "participacion", "otro"] as const;

export function AddComponent({
  courses,
  defaultCourseId,
  variant = "ghost",
  label = "Componente",
}: {
  courses: { id: string; name: string }[];
  defaultCourseId?: string;
  variant?: "ghost" | "primary";
  label?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState(defaultCourseId ?? courses[0]?.id ?? "");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("examen");
  const [weight, setWeight] = useState("");
  const [grade, setGrade] = useState("");
  const [date, setDate] = useState("");
  const [difficulty, setDifficulty] = useState(3);
  const [studyStart, setStudyStart] = useState("");
  const [topics, setTopics] = useState("");
  const [saving, setSaving] = useState(false);

  const isExam = kind === "examen";
  const suggestedStudy = isExam && date ? suggestStudyStart(date, difficulty) : null;
  const disabled = courses.length === 0;

  async function save() {
    if (!name.trim() || !courseId) return;
    setSaving(true);
    const { data: maxRow } = await supabase
      .from("grade_components").select("sort_order").eq("course_id", courseId)
      .order("sort_order", { ascending: false }).limit(1);
    const g = grade.trim() ? parseFloat(grade) : null;
    await supabase.from("grade_components").insert({
      course_id: courseId,
      name: name.trim(),
      kind,
      weight: weight.trim() ? parseFloat(weight) : 0,
      grade: g,
      date: date || null,
      difficulty: isExam ? difficulty : null,
      study_start_date: isExam ? (studyStart || suggestedStudy) : null,
      topics: topics.trim() || null,
      status: g !== null ? "done" : "pending",
      sort_order: (maxRow?.[0]?.sort_order ?? 0) + 1,
    });
    if (g !== null) await recompute(supabase, courseId);
    setSaving(false);
    setOpen(false);
    setName(""); setWeight(""); setGrade(""); setDate(""); setStudyStart(""); setTopics("");
    router.refresh();
  }

  return (
    <>
      <button className={`btn btn-${variant} btn-sm`} onClick={() => setOpen(true)} disabled={disabled} title={disabled ? "Agrega una materia primero" : ""}>
        <Plus size={13} /> {label}
      </button>
      {open && (
        <Modal title="Componente de calificación" onClose={() => setOpen(false)}>
          {!defaultCourseId && (
            <Field label="Materia">
              <select className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Tipo">
              <select className="input" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                {KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
              </select>
            </Field>
            <Field label="Nombre">
              <input className="input" autoFocus placeholder={isExam ? "Parcial 1" : "Tareas"} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Peso (% del 100)">
              <input className="input" type="number" placeholder="20" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </Field>
            <Field label="Calificación (opcional)">
              <input className="input" type="number" step="0.1" placeholder="—" value={grade} onChange={(e) => setGrade(e.target.value)} />
            </Field>
            <Field label={isExam ? "Fecha del examen" : "Fecha de entrega"}>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            {isExam && (
              <Field label={`Dificultad · ${DIFFICULTY_LABELS[difficulty]}`}>
                <input className="input" type="range" min={1} max={5} value={difficulty} onChange={(e) => setDifficulty(parseInt(e.target.value))} />
              </Field>
            )}
          </div>
          {isExam && (
            <>
              <Field label="Estudiar desde">
                <input className="input" type="date" value={studyStart || suggestedStudy || ""} onChange={(e) => setStudyStart(e.target.value)} />
                {suggestedStudy && !studyStart && (
                  <p className="tick" style={{ marginTop: 4 }}>Sugerido por dificultad {DIFFICULTY_LABELS[difficulty]}: {suggestedStudy}</p>
                )}
              </Field>
              <Field label="Temas a estudiar">
                <textarea className="input" rows={2} placeholder="Capítulos, conceptos clave…" value={topics} onChange={(e) => setTopics(e.target.value)} />
              </Field>
            </>
          )}
          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !name.trim() || !courseId}>
              {saving ? "Guardando…" : "Agregar"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// Recalcula y persiste la calificación ponderada de la materia (espejo del helper del servidor).
async function recompute(supabase: ReturnType<typeof createClient>, courseId: string) {
  const { data: comps } = await supabase.from("grade_components").select("weight, grade").eq("course_id", courseId);
  const graded = (comps ?? []).filter((c) => c.grade !== null && (c.weight ?? 0) > 0);
  const gradedWeight = graded.reduce((a, c) => a + (c.weight ?? 0), 0);
  const earned = graded.reduce((a, c) => a + (c.grade as number) * ((c.weight ?? 0) / 100), 0);
  const value = gradedWeight > 0 ? Math.round((earned / (gradedWeight / 100)) * 100) / 100 : null;
  await supabase.from("academic_courses").update({ grade: value }).eq("id", courseId);
}
