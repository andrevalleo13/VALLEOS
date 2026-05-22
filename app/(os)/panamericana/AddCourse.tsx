"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";

const COLORS = ["#C9A35F", "#7FA98C", "#5B8DB8", "#8B77CC", "#D96B58"];

export function AddCourse({ variant = "ghost", label = "Materia" }: { variant?: "ghost" | "primary"; label?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [professor, setProfessor] = useState("");
  const [credits, setCredits] = useState("");
  const [target, setTarget] = useState("9");
  const [code, setCode] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from("academic_courses").insert({
      name: name.trim(),
      professor: professor.trim() || null,
      credits: credits.trim() ? parseInt(credits) : null,
      grade: null,
      code: code.trim() || null,
      semester: null,
      target_grade: target.trim() ? parseFloat(target) : 9,
      notes: null,
      professor_email: null,
      active: true,
      color,
    });
    setSaving(false);
    setOpen(false);
    setName(""); setProfessor(""); setCredits(""); setCode("");
    router.refresh();
  }

  return (
    <>
      <button className={`btn btn-${variant} btn-sm`} onClick={() => setOpen(true)}>
        <Plus size={13} /> {label}
      </button>
      {open && (
        <Modal title="Nueva materia" onClose={() => setOpen(false)}>
          <Field label="Nombre">
            <input className="input" autoFocus placeholder="ej. Microeconomía" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Profesor">
              <input className="input" placeholder="Nombre" value={professor} onChange={(e) => setProfessor(e.target.value)} />
            </Field>
            <Field label="Código">
              <input className="input" placeholder="ej. ECO-201" value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Field label="Créditos">
              <input className="input" type="number" placeholder="8" value={credits} onChange={(e) => setCredits(e.target.value)} />
            </Field>
            <Field label="Meta de calificación">
              <input className="input" type="number" step="0.1" placeholder="9.0" value={target} onChange={(e) => setTarget(e.target.value)} />
            </Field>
          </div>
          <Field label="Color">
            <div style={{ display: "flex", gap: 10 }}>
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} aria-label={c}
                  style={{ width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer", border: color === c ? "2px solid var(--bone)" : "2px solid transparent" }} />
              ))}
            </div>
          </Field>
          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !name.trim()}>
              {saving ? "Guardando…" : "Agregar materia"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
