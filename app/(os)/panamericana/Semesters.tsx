"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Archive, GraduationCap, TrendingUp, Pencil, X, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";
import { useAppStore } from "@/lib/store";
import type { AcademicCourse, Semester } from "@/lib/supabase/types";
import {
  cumulativeGpa, buildTrajectory, nextTermNumber, semesterGpa, gpaColor,
} from "@/lib/academia/semesters";

type Props = {
  closed: Semester[];
  activeSemester: Semester | null;
  courses: AcademicCourse[];
};

const DEFAULT_META = { targetGpa: 9.0, creditsTarget: 400 };

export function Semesters({ closed, activeSemester, courses }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const setAjustes = useAppStore((s) => s.setAjustes);
  const meta = useAppStore((s) => s.ajustes.academia) ?? DEFAULT_META;

  const [addOpen, setAddOpen] = useState(false);
  const [editMeta, setEditMeta] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const activeGpa = useMemo(() => semesterGpa(courses), [courses]);
  const cumulative = useMemo(() => cumulativeGpa(closed, courses), [closed, courses]);
  const activeTerm = activeSemester?.term_number ?? nextTermNumber(closed);
  const activeLabel = activeSemester?.label ?? `${activeTerm}° semestre`;
  const trajectory = useMemo(
    () => buildTrajectory(closed, activeTerm, activeGpa, activeLabel),
    [closed, activeTerm, activeGpa, activeLabel]
  );

  const target = meta.targetGpa;
  const cumColor = gpaColor(cumulative.gpa, target);
  const becaRisk = cumulative.gpa !== null && cumulative.gpa < target;
  const creditPct = meta.creditsTarget > 0 ? Math.min(100, (cumulative.creditsTaken / meta.creditsTarget) * 100) : 0;

  async function closeSemester() {
    const graded = courses.filter((c) => c.grade !== null);
    if (graded.length === 0) {
      if (!confirm("Ninguna materia activa tiene calificación. ¿Cerrar el semestre de todos modos?")) return;
    }
    const gpa = semesterGpa(courses);
    if (!confirm(`Cerrar ${activeLabel} con promedio ${gpa !== null ? gpa.toFixed(2) : "—"}? Sus materias pasarán al historial.`)) return;
    setBusy("close");
    const credits = courses.reduce((a, c) => a + (c.credits ?? 0), 0);
    const today = new Date().toISOString().split("T")[0];
    const payload = {
      label: activeLabel,
      term_number: activeTerm,
      gpa: gpa !== null ? Math.round(gpa * 100) / 100 : null,
      course_count: courses.length,
      credits_taken: credits,
      credits_passed: credits,
      status: "closed",
      start_date: activeSemester?.start_date ?? null,
      end_date: today,
      notes: activeSemester?.notes ?? null,
    };
    let semesterId = activeSemester?.id ?? null;
    if (activeSemester) {
      await supabase.from("semesters").update(payload).eq("id", activeSemester.id);
    } else {
      const { data } = await supabase.from("semesters").insert(payload).select("id").single();
      semesterId = (data as { id: string } | null)?.id ?? null;
    }
    if (semesterId) {
      await supabase.from("academic_courses")
        .update({ active: false, semester_id: semesterId })
        .in("id", courses.map((c) => c.id));
    }
    setBusy(null);
    router.refresh();
  }

  async function deleteSemester(s: Semester) {
    if (!confirm(`Eliminar ${s.label} del historial?`)) return;
    setBusy(s.id);
    await supabase.from("semesters").delete().eq("id", s.id);
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="card mb-6 ac-traj">
      <div className="ac-traj-top">
        <div>
          <p className="eyebrow-gold" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <GraduationCap size={12} /> Trayectoria académica
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
            <span style={{ fontFamily: "var(--f-mono)", fontSize: 34, color: cumColor, lineHeight: 1 }}>
              {cumulative.gpa !== null ? cumulative.gpa.toFixed(2) : "—"}
            </span>
            <span className="tick">promedio general · {cumulative.materias} materias</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {courses.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={closeSemester} disabled={busy === "close"}>
              <Archive size={13} /> {busy === "close" ? "Cerrando…" : "Cerrar semestre"}
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setAddOpen(true)}>
            <Plus size={13} /> Semestre pasado
          </button>
        </div>
      </div>

      {/* Meta de promedio (beca) */}
      <div className="ac-meta-row">
        {editMeta ? (
          <MetaEditor
            meta={meta}
            onSave={(m) => { setAjustes({ academia: m }); setEditMeta(false); }}
            onCancel={() => setEditMeta(false)}
          />
        ) : (
          <>
            <span className={`ac-meta-tag${becaRisk ? " risk" : " ok"}`}>
              {becaRisk ? "En riesgo de beca" : "Beca a salvo"}
            </span>
            <span className="tick">
              meta {target.toFixed(1)}
              {cumulative.gpa !== null && (
                <> · {becaRisk
                  ? `te faltan ${(target - cumulative.gpa).toFixed(2)} para la meta`
                  : `vas ${(cumulative.gpa - target).toFixed(2)} arriba`}</>
              )}
            </span>
            <button className="ac-meta-edit" onClick={() => setEditMeta(true)} aria-label="Editar meta">
              <Pencil size={12} />
            </button>
          </>
        )}
      </div>

      {/* Trayectoria */}
      {trajectory.length > 0 && <Trajectory points={trajectory} target={target} />}

      {/* Créditos hacia titulación */}
      <div className="ac-credits">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span className="tick" style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <TrendingUp size={12} /> Avance de créditos
          </span>
          <span className="tick">{cumulative.creditsTaken} / {meta.creditsTarget} · {creditPct.toFixed(0)}%</span>
        </div>
        <div className="ac-credit-track"><div className="ac-credit-fill" style={{ width: `${creditPct}%` }} /></div>
      </div>

      {/* Historial de semestres cerrados */}
      {closed.length > 0 && (
        <div className="ac-sem-list">
          {[...closed].sort((a, b) => (a.term_number ?? 0) - (b.term_number ?? 0)).map((s) => (
            <div key={s.id} className="ac-sem-row">
              <span className="ac-sem-term">{s.term_number ?? "—"}°</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, color: "var(--bone-dim)" }}>{s.label}</p>
                <p className="tick">
                  {s.course_count ?? 0} materias{s.credits_passed != null ? ` · ${s.credits_passed} créditos` : ""}
                </p>
              </div>
              <span style={{ fontFamily: "var(--f-mono)", fontSize: 16, color: gpaColor(s.gpa, target) }}>
                {s.gpa !== null ? s.gpa.toFixed(2) : "—"}
              </span>
              <button className="ac-del" onClick={() => deleteSemester(s)} disabled={busy === s.id} aria-label="Eliminar">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {addOpen && <AddSemesterModal nextTerm={nextTermNumber(closed)} onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function MetaEditor({ meta, onSave, onCancel }: {
  meta: { targetGpa: number; creditsTarget: number };
  onSave: (m: { targetGpa: number; creditsTarget: number }) => void;
  onCancel: () => void;
}) {
  const [gpa, setGpa] = useState(String(meta.targetGpa));
  const [credits, setCredits] = useState(String(meta.creditsTarget));
  return (
    <div className="ac-meta-editor">
      <label className="tick">Meta de promedio (beca)
        <input className="input" type="number" step="0.1" value={gpa} onChange={(e) => setGpa(e.target.value)} />
      </label>
      <label className="tick">Créditos para titularte
        <input className="input" type="number" value={credits} onChange={(e) => setCredits(e.target.value)} />
      </label>
      <button className="ac-meta-edit" onClick={() => onSave({ targetGpa: parseFloat(gpa) || 9, creditsTarget: parseInt(credits) || 400 })} aria-label="Guardar"><Check size={13} /></button>
      <button className="ac-meta-edit" onClick={onCancel} aria-label="Cancelar"><X size={13} /></button>
    </div>
  );
}

function Trajectory({ points, target }: { points: { term: number; label: string; gpa: number; current: boolean }[]; target: number }) {
  const min = Math.max(0, Math.min(target, ...points.map((p) => p.gpa)) - 0.5);
  const max = 10;
  const range = max - min || 1;
  const h = (gpa: number) => `${((gpa - min) / range) * 100}%`;

  return (
    <div className="ac-traj-chart">
      {points.map((p, i) => (
        <div key={i} className="ac-traj-col">
          <span className="ac-traj-val" style={{ color: p.current ? "var(--gold)" : "var(--bone-dim)" }}>{p.gpa.toFixed(1)}</span>
          <div className="ac-traj-barwrap">
            <div className={`ac-traj-bar${p.current ? " current" : ""}`} style={{ height: h(p.gpa), background: gpaColor(p.gpa, target) }} />
          </div>
          <span className="ac-traj-lbl">{p.term}°{p.current ? " · ahora" : ""}</span>
        </div>
      ))}
    </div>
  );
}

// ── Agregar semestre pasado (rápido o detallado) ────────────────────────────
type DetailRow = { name: string; grade: string; credits: string };

function AddSemesterModal({ nextTerm, onClose }: { nextTerm: number; onClose: () => void }) {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"quick" | "detailed">("quick");
  const [label, setLabel] = useState(`${nextTerm}° semestre`);
  const [term, setTerm] = useState(String(nextTerm));
  const [saving, setSaving] = useState(false);

  // rápido
  const [gpa, setGpa] = useState("");
  const [count, setCount] = useState("");
  const [credits, setCredits] = useState("");

  // detallado
  const [rows, setRows] = useState<DetailRow[]>([{ name: "", grade: "", credits: "" }]);

  function setRow(i: number, patch: Partial<DetailRow>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  const detailValid = rows.filter((r) => r.name.trim() && r.grade.trim());

  async function save() {
    setSaving(true);
    const termNum = parseInt(term) || nextTerm;
    if (mode === "quick") {
      await supabase.from("semesters").insert({
        label: label.trim() || `${termNum}° semestre`,
        term_number: termNum,
        gpa: gpa.trim() ? Math.round(parseFloat(gpa) * 100) / 100 : null,
        course_count: count.trim() ? parseInt(count) : null,
        credits_taken: credits.trim() ? parseInt(credits) : null,
        credits_passed: credits.trim() ? parseInt(credits) : null,
        status: "closed",
        start_date: null, end_date: null, notes: null,
      });
    } else {
      const valid = detailValid;
      const grades = valid.map((r) => parseFloat(r.grade));
      const avg = grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : null;
      const totalCredits = valid.reduce((a, r) => a + (r.credits.trim() ? parseInt(r.credits) : 0), 0);
      const { data } = await supabase.from("semesters").insert({
        label: label.trim() || `${termNum}° semestre`,
        term_number: termNum,
        gpa: avg !== null ? Math.round(avg * 100) / 100 : null,
        course_count: valid.length,
        credits_taken: totalCredits,
        credits_passed: totalCredits,
        status: "closed",
        start_date: null, end_date: null, notes: null,
      }).select("id").single();
      const semesterId = (data as { id: string } | null)?.id ?? null;
      if (semesterId && valid.length) {
        await supabase.from("academic_courses").insert(
          valid.map((r) => ({
            name: r.name.trim(),
            professor: null, credits: r.credits.trim() ? parseInt(r.credits) : null,
            grade: parseFloat(r.grade), code: null, semester: label.trim() || null,
            semester_id: semesterId, target_grade: 9, notes: null, professor_email: null,
            active: false, color: "#8A8A8A", absences: 0, max_absences: null,
          }))
        );
      }
    }
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <Modal title="Semestre pasado" onClose={onClose} wide>
      <div className="seg" style={{ marginBottom: 14 }}>
        <button className={`seg-btn${mode === "quick" ? " on" : ""}`} onClick={() => setMode("quick")}>Rápido</button>
        <button className={`seg-btn${mode === "detailed" ? " on" : ""}`} onClick={() => setMode("detailed")}>Materia por materia</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <Field label="Nombre del semestre">
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="1er semestre" />
        </Field>
        <Field label="Número">
          <input className="input" type="number" value={term} onChange={(e) => setTerm(e.target.value)} />
        </Field>
      </div>

      {mode === "quick" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Promedio">
            <input className="input" type="number" step="0.1" placeholder="9.2" value={gpa} onChange={(e) => setGpa(e.target.value)} />
          </Field>
          <Field label="Nº de materias">
            <input className="input" type="number" placeholder="6" value={count} onChange={(e) => setCount(e.target.value)} />
          </Field>
          <Field label="Créditos">
            <input className="input" type="number" placeholder="48" value={credits} onChange={(e) => setCredits(e.target.value)} />
          </Field>
        </div>
      ) : (
        <div>
          <p className="eyebrow mb-2">Materias</p>
          <div className="flex flex-col gap-2">
            {rows.map((r, i) => (
              <div key={i} className="ac-sem-detrow">
                <input className="input" placeholder="Materia" value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} />
                <input className="input" type="number" step="0.1" placeholder="Calif." value={r.grade} onChange={(e) => setRow(i, { grade: e.target.value })} />
                <input className="input" type="number" placeholder="Créd." value={r.credits} onChange={(e) => setRow(i, { credits: e.target.value })} />
                <button className="ac-del" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))} aria-label="Quitar" disabled={rows.length === 1}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setRows((rs) => [...rs, { name: "", grade: "", credits: "" }])}>
            <Plus size={13} /> Materia
          </button>
          {detailValid.length > 0 && (
            <p className="tick" style={{ marginTop: 8 }}>
              Promedio: {(detailValid.reduce((a, r) => a + parseFloat(r.grade), 0) / detailValid.length).toFixed(2)} · {detailValid.length} materias
            </p>
          )}
        </div>
      )}

      <div className="modal-actions">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || (mode === "detailed" && detailValid.length === 0)}>
          {saving ? "Guardando…" : "Guardar semestre"}
        </button>
      </div>
    </Modal>
  );
}
