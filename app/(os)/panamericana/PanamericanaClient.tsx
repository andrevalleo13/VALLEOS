"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap, AlertTriangle, CalendarClock, ChevronDown, Trash2,
  RefreshCw, ArrowRight, Minus, Plus, BookOpen, Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Orb } from "@/components/Orb";
import { AddCourse } from "./AddCourse";
import { AddComponent } from "./AddComponent";
import { AddAssignment } from "./AddAssignment";
import { AddClass } from "./AddClass";
import { EditCourse } from "./EditCourse";
import { Semesters } from "./Semesters";
import { EmptyState } from "@/components/EmptyState";
import { deleteCalEvent } from "@/lib/academia/calendar";
import type { AcademicCourse, Assignment, GradeComponent, ClassSchedule, Semester } from "@/lib/supabase/types";
import {
  computeCourseGrades, neededForTarget, daysUntil, studyState, absenceRisk,
  DIFFICULTY_LABELS, DIFFICULTY_COLORS, KIND_LABELS, suggestStudyStart, type StudyState,
} from "@/lib/academia/grades";

type AssignmentRow = Assignment & { academic_courses: { name: string; color: string } | null };
type Props = {
  courses: AcademicCourse[];
  components: GradeComponent[];
  assignments: AssignmentRow[];
  schedule: ClassSchedule[];
  closedSemesters: Semester[];
  activeSemester: Semester | null;
  analysis: string | null;
  analysisAt: string | null;
};

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const STUDY_BADGE: Record<StudyState, { label: string; color: string } | null> = {
  done: { label: "Listo", color: "var(--green)" },
  urgent: { label: "¡Inminente!", color: "var(--red)" },
  "study-now": { label: "Estudia ya", color: "var(--gold)" },
  soon: { label: "Pronto", color: "var(--blue)" },
  later: null,
  past: null,
};

export function PanamericanaClient({ courses, components, assignments, schedule, closedSemesters, activeSemester, analysis, analysisAt }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const today = new Date().toISOString().split("T")[0];
  const todayDate = new Date(today + "T00:00:00");

  const [expanded, setExpanded] = useState<string | null>(courses.length === 1 ? courses[0].id : null);
  const [analysisText, setAnalysisText] = useState(analysis);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const compsByCourse = useMemo(() => {
    const m = new Map<string, GradeComponent[]>();
    for (const c of components) {
      if (!m.has(c.course_id)) m.set(c.course_id, []);
      m.get(c.course_id)!.push(c);
    }
    return m;
  }, [components]);

  const courseList = courses.map((c) => ({ id: c.id, name: c.name }));

  const courseData = courses.map((course) => {
    const comps = compsByCourse.get(course.id) ?? [];
    const grades = computeCourseGrades(comps);
    const need = neededForTarget(grades, course.target_grade);
    const risk = absenceRisk(course.absences, course.max_absences);
    return { course, comps, grades, need, risk };
  });

  const projectedVals = courseData.map((d) => d.grades.projectedFinal).filter((v): v is number => v !== null);
  const projectedGpa = projectedVals.length ? projectedVals.reduce((a, b) => a + b, 0) / projectedVals.length : null;
  const totalCredits = courses.reduce((a, c) => a + (c.credits ?? 0), 0);

  const upcomingExams = components
    .filter((c) => c.kind === "examen" && c.status !== "done" && c.date && (daysUntil(c.date, todayDate) ?? -1) >= 0)
    .map((c) => ({ comp: c, course: courses.find((cc) => cc.id === c.course_id), d: daysUntil(c.date, todayDate)!, st: studyState(c.date, c.study_start_date, c.status, todayDate) }))
    .sort((a, b) => a.d - b.d);

  const riskCourses = courseData.filter((d) => d.risk === "danger" || d.risk === "warn");

  // ── acciones ──────────────────────────────────────────────────────────────
  async function gradeComponent(comp: GradeComponent, value: number | null) {
    setBusy(comp.id);
    const updated = (compsByCourse.get(comp.course_id) ?? []).map((c) => c.id === comp.id ? { ...c, grade: value } : c);
    const g = computeCourseGrades(updated);
    await supabase.from("grade_components").update({ grade: value, status: value !== null ? "done" : "pending" }).eq("id", comp.id);
    await supabase.from("academic_courses").update({ grade: g.currentGrade !== null ? Math.round(g.currentGrade * 100) / 100 : null }).eq("id", comp.course_id);
    setBusy(null);
    router.refresh();
  }

  async function deleteComponent(comp: GradeComponent) {
    setBusy(comp.id);
    const updated = (compsByCourse.get(comp.course_id) ?? []).filter((c) => c.id !== comp.id);
    const g = computeCourseGrades(updated);
    await Promise.all([deleteCalEvent(comp.calendar_event_id), deleteCalEvent(comp.study_event_id)]);
    await supabase.from("grade_components").delete().eq("id", comp.id);
    await supabase.from("academic_courses").update({ grade: g.currentGrade !== null ? Math.round(g.currentGrade * 100) / 100 : null }).eq("id", comp.course_id);
    setBusy(null);
    router.refresh();
  }

  async function adjustAbsence(course: AcademicCourse, delta: number) {
    const next = Math.max(0, course.absences + delta);
    setBusy(course.id + "-abs");
    await supabase.from("academic_courses").update({ absences: next }).eq("id", course.id);
    setBusy(null);
    router.refresh();
  }

  async function deleteSchedule(id: string) {
    setBusy(id);
    const row = schedule.find((s) => s.id === id);
    await deleteCalEvent(row?.calendar_event_id);
    await supabase.from("class_schedule").delete().eq("id", id);
    setBusy(null);
    router.refresh();
  }

  async function generateAnalysis() {
    setLoading(true);
    try {
      const res = await fetch("/api/shadow/academia", { method: "POST" });
      const data = await res.json();
      setAnalysisText(data.content);
    } finally {
      setLoading(false);
      router.refresh();
    }
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow mb-2">09 · ACADEMIA</p>
            <h1 className="page-title">Panamericana.</h1>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <AddCourse />
            <AddComponent courses={courseList} />
            <AddAssignment courses={courseList} />
            <AddClass courses={courseList} />
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* KPIs */}
        <div className="kpi-strip mb-6">
          <Kpi label="GPA proyectado" val={projectedGpa !== null ? projectedGpa.toFixed(2) : "—"} color={projectedGpa !== null && projectedGpa >= 9 ? "var(--green)" : "var(--gold)"} />
          <Kpi label="Materias" val={String(courses.length)} />
          <Kpi label="Créditos" val={String(totalCredits)} />
          <Kpi label="Exámenes próx." val={String(upcomingExams.length)} color={upcomingExams.some((e) => e.st === "urgent" || e.st === "study-now") ? "var(--gold)" : undefined} />
          <Kpi label="Faltas en riesgo" val={String(riskCourses.length)} color={riskCourses.some((d) => d.risk === "danger") ? "var(--red)" : riskCourses.length ? "var(--gold)" : undefined} />
        </div>

        {/* Shadow análisis */}
        <div className="card mb-6 ac-analysis">
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <Orb size={40} state={loading ? "thinking" : "idle"} style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <p className="eyebrow-gold">Proyección de Shadow</p>
                {analysisText && (
                  <button className="tb-btn" style={{ width: 28, height: 28 }} onClick={generateAnalysis} disabled={loading} title="Regenerar análisis">
                    <RefreshCw size={13} className={loading ? "spin" : ""} />
                  </button>
                )}
              </div>
              {loading ? (
                <p style={{ color: "var(--mute)", fontSize: 14 }}>Analizando tu semestre…</p>
              ) : analysisText ? (
                <>
                  <Markdownish text={analysisText} />
                  {analysisAt && <p className="tick" style={{ marginTop: 10 }}>Generado {new Date(analysisAt).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
                </>
              ) : (
                <>
                  <p style={{ color: "var(--mute)", fontSize: 14, marginBottom: 12 }}>
                    Shadow puede proyectar tu semestre: materias en riesgo, qué necesitas para tu meta y un plan de exámenes por dificultad.
                  </p>
                  <button className="btn btn-primary btn-sm" onClick={generateAnalysis} disabled={loading || courses.length === 0}>
                    Generar proyección <ArrowRight size={13} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Trayectoria académica: promedio general, créditos, historial de semestres */}
        <Semesters courses={courses} closed={closedSemesters} activeSemester={activeSemester} />

        {courses.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={GraduationCap}
              title="Sin materias del semestre actual"
              hint="Agrega las materias de tu semestre en curso con su esquema de calificación, o registra tus semestres pasados arriba."
            >
              <AddCourse variant="primary" label="Agregar materia" />
            </EmptyState>
          </div>
        ) : (
          <>
            {/* Exámenes próximos */}
            {upcomingExams.length > 0 && (
              <div className="mb-6">
                <p className="eyebrow mb-3">Exámenes próximos</p>
                <div className="flex flex-col gap-2">
                  {upcomingExams.map(({ comp, course, d, st }) => {
                    const badge = STUDY_BADGE[st];
                    const studyIn = daysUntil(comp.study_start_date, todayDate);
                    return (
                      <div key={comp.id} className="ac-exam-row">
                        <div style={{ width: 4, height: 38, borderRadius: 2, background: course?.color ?? "var(--mute)", flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 14, color: "var(--bone)", fontWeight: 500 }}>{comp.name}</span>
                            {comp.difficulty && (
                              <span className="ac-diff" style={{ borderColor: DIFFICULTY_COLORS[comp.difficulty], color: DIFFICULTY_COLORS[comp.difficulty] }}>
                                {DIFFICULTY_LABELS[comp.difficulty]}
                              </span>
                            )}
                            {comp.weight > 0 && <span className="tick">{comp.weight}%</span>}
                          </div>
                          <p className="tick">{course?.name}{comp.topics ? ` · ${comp.topics}` : ""}</p>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <p style={{ fontFamily: "var(--f-mono)", fontSize: 13, color: d <= 2 ? "var(--red)" : "var(--bone-dim)" }}>
                            {d === 0 ? "Hoy" : d === 1 ? "Mañana" : `en ${d} días`}
                          </p>
                          {badge ? (
                            <span className="ac-diff" style={{ borderColor: badge.color, color: badge.color, marginTop: 3 }}>{badge.label}</span>
                          ) : studyIn !== null && studyIn > 0 ? (
                            <p className="tick">estudia en {studyIn}d</p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Horario semanal */}
            {schedule.length > 0 && <WeeklySchedule schedule={schedule} courses={courses} onDelete={deleteSchedule} busy={busy} />}

            {/* Entregas pendientes */}
            {assignments.length > 0 && (
              <div className="mb-6">
                <p className="eyebrow mb-3">Entregas pendientes</p>
                <div className="flex flex-col gap-1">
                  {assignments.map((a) => {
                    const course = a.academic_courses;
                    const overdue = a.due_date ? a.due_date < today : false;
                    return (
                      <div key={a.id} className="flex items-center gap-3 py-2 border-b border-[var(--glass-bd)] last:border-0">
                        {course && <div style={{ width: 4, height: 30, borderRadius: 2, background: course.color, flexShrink: 0 }} />}
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 14, color: "var(--bone-dim)" }}>{a.title}</p>
                          {course && <p className="tick">{course.name}</p>}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {a.due_date && <p className="tick" style={{ color: overdue ? "var(--red)" : "var(--mute)" }}>{new Date(a.due_date + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</p>}
                          {a.weight && <p className="tick">{a.weight}%</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Materias */}
            <p className="eyebrow mb-3">Materias del semestre</p>
            <div className="flex flex-col gap-3">
              {courseData.map(({ course, comps, grades, need, risk }) => (
                <CourseCard
                  key={course.id}
                  course={course} comps={comps} grades={grades} need={need} risk={risk}
                  schedule={schedule.filter((s) => s.course_id === course.id)}
                  expanded={expanded === course.id}
                  onToggle={() => setExpanded(expanded === course.id ? null : course.id)}
                  onGrade={gradeComponent} onDeleteComp={deleteComponent}
                  onAbsence={adjustAbsence} busy={busy}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, val, color }: { label: string; val: string; color?: string }) {
  return (
    <div className="kpi-cell">
      <p style={{ fontFamily: "var(--f-mono)", fontSize: 26, color: color ?? "var(--bone)" }}>{val}</p>
      <p className="metric-label">{label}</p>
    </div>
  );
}

function CourseCard({
  course, comps, grades, need, risk, schedule, expanded, onToggle, onGrade, onDeleteComp, onAbsence, busy,
}: {
  course: AcademicCourse;
  comps: GradeComponent[];
  grades: ReturnType<typeof computeCourseGrades>;
  need: number | null;
  risk: ReturnType<typeof absenceRisk>;
  schedule: ClassSchedule[];
  expanded: boolean;
  onToggle: () => void;
  onGrade: (c: GradeComponent, v: number | null) => void;
  onDeleteComp: (c: GradeComponent) => void;
  onAbsence: (c: AcademicCourse, d: number) => void;
  busy: string | null;
}) {
  const riskColor = risk === "danger" ? "var(--red)" : risk === "warn" ? "var(--gold)" : "var(--mute)";
  const gradeColor = grades.currentGrade === null ? "var(--mute)" : grades.currentGrade >= course.target_grade ? "var(--green)" : "var(--red)";
  const sorted = [...comps].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <button className="ac-course-head" onClick={onToggle}>
        <div style={{ width: 4, height: 44, borderRadius: 2, background: course.color, flexShrink: 0 }} />
        <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 500, color: "var(--bone)", fontSize: 15 }}>{course.name}</span>
            {course.code && <span className="tag" style={{ fontSize: 10 }}>{course.code}</span>}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 2, flexWrap: "wrap" }}>
            {course.professor && <span className="tick">{course.professor}</span>}
            {grades.projectedFinal !== null && <span className="tick">proyectada {grades.projectedFinal.toFixed(2)}</span>}
            <span className="tick">meta {course.target_grade}</span>
            {course.max_absences != null && (
              <span className="tick" style={{ color: risk === "danger" ? "var(--red)" : risk === "warn" ? "var(--gold)" : "var(--mute)" }}>
                faltas {course.absences}/{course.max_absences}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--f-mono)", fontSize: 22, color: gradeColor }}>
            {grades.currentGrade !== null ? grades.currentGrade.toFixed(2) : "—"}
          </span>
          <ChevronDown size={16} style={{ color: "var(--mute)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
        </div>
      </button>

      {expanded && (
        <div className="ac-course-body">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <EditCourse course={course} />
          </div>
          {/* meta línea: necesita / esquema */}
          <div className="ac-course-meta">
            {!grades.schemeComplete && (
              <span className="ac-meta-pill" style={{ color: "var(--gold)" }}>
                <AlertTriangle size={12} /> Esquema {grades.totalWeight}% (no suma 100)
              </span>
            )}
            {need !== null && grades.currentGrade !== null && (
              <span className="ac-meta-pill">
                {need > 10 ? <><AlertTriangle size={12} style={{ color: "var(--red)" }} /> Meta {course.target_grade} ya no alcanzable</>
                  : need <= 0 ? <>Meta {course.target_grade} asegurada ✓</>
                  : <>Necesitas <b style={{ color: need > course.target_grade ? "var(--red)" : "var(--bone)" }}>{need.toFixed(1)}</b> en el {grades.remainingWeight}% restante</>}
              </span>
            )}
          </div>

          {/* faltas */}
          <div className="ac-falta">
            <span className="tick">Faltas</span>
            <button className="ac-step" disabled={busy === course.id + "-abs"} onClick={() => onAbsence(course, -1)}><Minus size={13} /></button>
            <span style={{ fontFamily: "var(--f-mono)", fontSize: 16, color: riskColor, minWidth: 44, textAlign: "center" }}>
              {course.absences}{course.max_absences != null ? ` / ${course.max_absences}` : ""}
            </span>
            <button className="ac-step" disabled={busy === course.id + "-abs"} onClick={() => onAbsence(course, 1)}><Plus size={13} /></button>
            {risk === "danger" && <span className="ac-diff" style={{ borderColor: "var(--red)", color: "var(--red)" }}>Sin derecho a examen</span>}
            {risk === "warn" && <span className="ac-diff" style={{ borderColor: "var(--gold)", color: "var(--gold)" }}>Cerca del límite</span>}
          </div>

          {/* esquema de calificación */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "14px 0 8px" }}>
            <p className="eyebrow">Esquema de calificación · {grades.gradedWeight}/{grades.totalWeight}% calificado</p>
            <AddComponent courses={[{ id: course.id, name: course.name }]} defaultCourseId={course.id} label="Agregar" />
          </div>
          {sorted.length === 0 ? (
            <p className="tick" style={{ padding: "8px 0" }}>Sin componentes. Agrega parciales, tareas y proyectos con su peso del 100%.</p>
          ) : (
            <div className="flex flex-col">
              {sorted.map((c) => <ComponentRow key={c.id} comp={c} onGrade={onGrade} onDelete={onDeleteComp} busy={busy} />)}
            </div>
          )}

          {/* horario de la materia */}
          {schedule.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <p className="eyebrow mb-2">Horario</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {schedule.map((s) => (
                  <span key={s.id} className="ac-meta-pill">
                    <Clock size={12} /> {DAY_LABELS[s.day_of_week]} {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}{s.room ? ` · ${s.room}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ComponentRow({ comp, onGrade, onDelete, busy }: {
  comp: GradeComponent;
  onGrade: (c: GradeComponent, v: number | null) => void;
  onDelete: (c: GradeComponent) => void;
  busy: string | null;
}) {
  const [val, setVal] = useState(comp.grade !== null ? String(comp.grade) : "");
  const isExam = comp.kind === "examen";

  function commit() {
    const trimmed = val.trim();
    const parsed = trimmed === "" ? null : parseFloat(trimmed);
    const current = comp.grade;
    if (parsed === current) return;
    if (parsed !== null && (isNaN(parsed) || parsed < 0 || parsed > 10)) { setVal(current !== null ? String(current) : ""); return; }
    onGrade(comp, parsed);
  }

  return (
    <div className="ac-comp-row">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "var(--bone-dim)" }}>{comp.name}</span>
          <span className="ac-kind">{KIND_LABELS[comp.kind] ?? comp.kind}</span>
          {isExam && comp.difficulty && (
            <span className="ac-diff" style={{ borderColor: DIFFICULTY_COLORS[comp.difficulty], color: DIFFICULTY_COLORS[comp.difficulty] }}>
              {DIFFICULTY_LABELS[comp.difficulty]}
            </span>
          )}
        </div>
        {(comp.date || comp.study_start_date) && (
          <p className="tick">
            {comp.date && `${new Date(comp.date + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`}
            {isExam && comp.study_start_date && ` · estudiar desde ${new Date(comp.study_start_date + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`}
          </p>
        )}
      </div>
      <div className="ac-weight">
        <div className="ac-bar"><div style={{ width: `${Math.min(100, comp.weight)}%` }} /></div>
        <span className="tick" style={{ minWidth: 34, textAlign: "right" }}>{comp.weight}%</span>
      </div>
      <input
        className="ac-grade-input"
        value={val}
        placeholder="—"
        inputMode="decimal"
        disabled={busy === comp.id}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      />
      <button className="ac-del" onClick={() => onDelete(comp)} disabled={busy === comp.id} aria-label="Eliminar"><Trash2 size={13} /></button>
    </div>
  );
}

function WeeklySchedule({ schedule, courses, onDelete, busy }: {
  schedule: ClassSchedule[];
  courses: AcademicCourse[];
  onDelete: (id: string) => void;
  busy: string | null;
}) {
  const colorOf = (id: string) => courses.find((c) => c.id === id)?.color ?? "var(--mute)";
  const nameOf = (id: string) => courses.find((c) => c.id === id)?.name ?? "";
  const days = WEEK_ORDER.filter((d) => d !== 0 || schedule.some((s) => s.day_of_week === 0));

  return (
    <div className="mb-6">
      <p className="eyebrow mb-3">Horario semanal</p>
      <div className="ac-sched-grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((d) => {
          const items = schedule.filter((s) => s.day_of_week === d).sort((a, b) => a.start_time.localeCompare(b.start_time));
          return (
            <div key={d} className="ac-sched-col">
              <p className="ac-sched-day">{DAY_LABELS[d]}</p>
              {items.length === 0 ? <span className="ac-sched-empty">—</span> : items.map((s) => (
                <div key={s.id} className="ac-sched-block" style={{ borderLeftColor: colorOf(s.course_id) }}>
                  <button className="ac-sched-del" onClick={() => onDelete(s.id)} disabled={busy === s.id} aria-label="Eliminar"><Trash2 size={11} /></button>
                  <p className="ac-sched-time">{s.start_time.slice(0, 5)}</p>
                  <p className="ac-sched-name">{nameOf(s.course_id)}</p>
                  {s.room && <p className="ac-sched-room">{s.room}</p>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Render mínimo de markdown: **negritas**, líneas y viñetas. Sin dependencias.
function Markdownish({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="ac-md">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
        const bullet = /^\s*[-*]\s+/.test(line);
        const content = line.replace(/^\s*[-*]\s+/, "");
        return (
          <p key={i} style={{ paddingLeft: bullet ? 14 : 0, position: "relative" }}>
            {bullet && <span style={{ position: "absolute", left: 2, color: "var(--gold)" }}>·</span>}
            {renderInline(content)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i} style={{ color: "var(--bone)" }}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
}
