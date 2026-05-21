import { createClient } from "@/lib/supabase/server";
import { Plus, BookOpen, Clock, AlertCircle } from "lucide-react";
import type { AcademicCourse, Assignment } from "@/lib/supabase/types";

export const revalidate = 0;

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  doing: "En proceso",
  done: "Entregado",
  late: "Tarde",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "var(--mute)",
  doing: "var(--gold)",
  done: "var(--green)",
  late: "var(--red)",
};

type CourseWithAssignments = AcademicCourse & { assignments: Assignment[] };

export default async function PanamericanaPage() {
  const supabase = await createClient();

  const [{ data: courses }, { data: assignments }, { data: semesters }] = await Promise.all([
    supabase.from("academic_courses").select("*").eq("active", true).order("name"),
    supabase.from("assignments").select("*, academic_courses(name, color)")
      .neq("status", "done")
      .order("due_date")
      .limit(20),
    supabase.from("semesters").select("*").order("created_at", { ascending: false }).limit(1),
  ]);

  const today = new Date().toISOString();
  const upcoming = (assignments ?? []).filter((a) => a.due_date && a.due_date >= today);
  const overdue = (assignments ?? []).filter((a) => a.due_date && a.due_date < today && a.status !== "done");

  const totalCredits = (courses ?? []).reduce((a, c) => a + (c.credits ?? 0), 0);
  const completedGrades = (courses ?? []).filter((c) => c.grade !== null);
  const gpa = completedGrades.length > 0
    ? completedGrades.reduce((a, c) => a + (c.grade ?? 0), 0) / completedGrades.length
    : null;

  return (
    <div>
      <div className="page-header">
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow mb-2">
              {semesters?.[0]?.label ?? "Academia"}
            </p>
            <h1 className="page-title">Panamericana</h1>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm"><Plus size={13} /> Materia</button>
            <button className="btn btn-primary btn-sm"><Plus size={13} /> Entrega</button>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Materias activas", val: String(courses?.length ?? 0) },
            {
              label: "GPA actual",
              val: gpa !== null ? gpa.toFixed(2) : "—",
              color: gpa !== null && gpa >= 9 ? "var(--green)" : "var(--gold)",
            },
            { label: "Créditos del semestre", val: String(totalCredits) },
          ].map((k) => (
            <div key={k.label} className="card text-center">
              <p style={{ fontFamily: "var(--f-mono)", fontSize: 32, color: k.color ?? "var(--bone)" }}>{k.val}</p>
              <p className="metric-label">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Entregas urgentes */}
        {overdue.length > 0 && (
          <div className="card mb-4" style={{ borderColor: "var(--red)" }}>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle size={16} style={{ color: "var(--red)" }} />
              <p className="eyebrow" style={{ color: "var(--red)" }}>Entregas vencidas</p>
            </div>
            {overdue.map((a) => {
              const course = a.academic_courses as unknown as { name: string; color: string } | null;
              return (
                <div key={a.id} className="flex items-center gap-3 py-2 border-b border-[var(--glass-bd)] last:border-0">
                  {course && (
                    <div style={{ width: 4, height: 32, borderRadius: 2, background: course.color, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, color: "var(--bone-dim)", fontWeight: 500 }}>{a.title}</p>
                    {course && <p className="tick">{course.name}</p>}
                  </div>
                  <span className="tick" style={{ color: "var(--red)" }}>{a.due_date?.split("T")[0]}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Upcoming assignments */}
        {upcoming.length > 0 && (
          <div className="card mb-8">
            <p className="eyebrow mb-3">Próximas entregas</p>
            <div className="flex flex-col gap-1">
              {upcoming.map((a) => {
                const course = a.academic_courses as unknown as { name: string; color: string } | null;
                const color = STATUS_COLORS[a.status] ?? "var(--mute)";
                return (
                  <div key={a.id} className="flex items-center gap-3 py-2 border-b border-[var(--glass-bd)] last:border-0">
                    {course && (
                      <div style={{ width: 4, height: 32, borderRadius: 2, background: course.color, flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div className="flex items-center gap-2">
                        <p style={{ fontSize: 14, color: "var(--bone-dim)" }}>{a.title}</p>
                        <span className="tag" style={{ borderColor: color, color, fontSize: 10 }}>
                          {STATUS_LABELS[a.status]}
                        </span>
                      </div>
                      {course && <p className="tick">{course.name}</p>}
                    </div>
                    <div className="text-right">
                      {a.due_date && (
                        <p className="tick">{new Date(a.due_date).toLocaleDateString("es-MX", { month: "short", day: "numeric" })}</p>
                      )}
                      {a.weight && <p className="tick">{a.weight}% de la calificación</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Courses */}
        {(courses ?? []).length === 0 ? (
          <div className="card text-center py-12">
            <BookOpen size={32} style={{ color: "var(--mute-2)", margin: "0 auto 12px" }} />
            <p style={{ color: "var(--mute)", fontSize: 14 }}>Sin materias registradas</p>
            <button className="btn btn-primary btn-sm mt-4"><Plus size={13} /> Agregar materia</button>
          </div>
        ) : (
          <div>
            <p className="eyebrow mb-4">Materias del semestre</p>
            <div className="flex flex-col gap-3">
              {(courses ?? []).map((c) => (
                <div key={c.id} className="card">
                  <div className="flex items-center gap-4">
                    <div
                      style={{
                        width: 4, height: 48, borderRadius: 2,
                        background: c.color, flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div className="flex items-center gap-3 mb-1">
                        <p style={{ fontWeight: 500, color: "var(--bone)", fontSize: 15 }}>{c.name}</p>
                        {c.code && <span className="tag" style={{ fontSize: 10 }}>{c.code}</span>}
                        {c.grade !== null && (
                          <span
                            className="tag ml-auto"
                            style={{
                              borderColor: c.grade >= c.target_grade ? "var(--green)" : "var(--red)",
                              color: c.grade >= c.target_grade ? "var(--green)" : "var(--red)",
                              fontSize: 13, fontFamily: "var(--f-mono)",
                            }}
                          >
                            {c.grade.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-4">
                        {c.professor && <span className="tick">{c.professor}</span>}
                        {c.credits && <span className="tick">{c.credits} créditos</span>}
                        {c.target_grade && <span className="tick">Meta: {c.target_grade}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
