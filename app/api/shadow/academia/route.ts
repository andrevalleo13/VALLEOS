import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  computeCourseGrades,
  neededForTarget,
  daysUntil,
  DIFFICULTY_LABELS,
} from "@/lib/academia/grades";
import type { GradeComponent } from "@/lib/supabase/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const [{ data: courses }, { data: comps }, { data: assignments }, { data: prefs }] = await Promise.all([
    supabase.from("academic_courses").select("id, name, target_grade, absences, max_absences, credits").eq("active", true).order("name"),
    supabase.from("grade_components").select("*"),
    supabase.from("assignments").select("title, due_date, weight, status, course_id").neq("status", "done").gte("due_date", today).order("due_date").limit(15),
    supabase.from("user_preferences").select("display_name").single(),
  ]);

  if (!courses || courses.length === 0) {
    return NextResponse.json({ content: "Aún no tienes materias activas registradas. Agrega tus materias y su esquema de calificación para que pueda proyectar tu semestre." });
  }

  const byCourse = new Map<string, GradeComponent[]>();
  for (const c of (comps ?? []) as GradeComponent[]) {
    if (!byCourse.has(c.course_id)) byCourse.set(c.course_id, []);
    byCourse.get(c.course_id)!.push(c);
  }
  const courseName = new Map(courses.map((c) => [c.id, c.name]));

  const courseBlocks = courses.map((course) => {
    const cc = byCourse.get(course.id) ?? [];
    const g = computeCourseGrades(cc);
    const need = neededForTarget(g, course.target_grade);
    const examBits = cc
      .filter((c) => c.kind === "examen" && c.status !== "done" && c.date)
      .map((c) => {
        const d = daysUntil(c.date, new Date(today + "T00:00:00"));
        const diff = c.difficulty ? DIFFICULTY_LABELS[c.difficulty] : "sin clasificar";
        return `    · ${c.name}: en ${d} día(s), dificultad ${diff}, peso ${c.weight}%${c.study_start_date ? `, estudiar desde ${c.study_start_date}` : ""}${c.topics ? `, temas: ${c.topics}` : ""}`;
      });
    const pendingComps = cc.filter((c) => c.grade === null && c.weight > 0).map((c) => `${c.name} (${c.weight}%)`);
    return [
      `· ${course.name} (meta ${course.target_grade}, ${course.credits ?? "?"} créditos):`,
      `    calificación actual: ${g.currentGrade !== null ? g.currentGrade.toFixed(2) : "sin calificaciones"}, proyectada: ${g.projectedFinal !== null ? g.projectedFinal.toFixed(2) : "—"}`,
      `    esquema: ${g.totalWeight}% definido${g.schemeComplete ? "" : " (incompleto)"}, ${g.gradedWeight}% calificado, ${g.remainingWeight}% por calificar`,
      need !== null && g.currentGrade !== null ? `    para la meta necesita ${need > 10 ? "más de 10 (en riesgo)" : need <= 0 ? "ya está asegurada" : need.toFixed(1) + " promedio en lo que falta"}` : "",
      course.max_absences ? `    faltas: ${course.absences}/${course.max_absences}${course.absences >= course.max_absences ? " — LÍMITE ALCANZADO" : ""}` : course.absences ? `    faltas: ${course.absences}` : "",
      pendingComps.length ? `    pendientes de calificar: ${pendingComps.join(", ")}` : "",
      examBits.length ? `    exámenes próximos:\n${examBits.join("\n")}` : "",
    ].filter(Boolean).join("\n");
  });

  const assignLines = (assignments ?? []).map((a) => `· ${a.title} — ${courseName.get(a.course_id) ?? "?"} (entrega ${a.due_date}${a.weight ? `, ${a.weight}%` : ""})`);

  const context = `
Fecha: ${today}
MATERIAS:
${courseBlocks.join("\n\n")}

ENTREGAS PENDIENTES:
${assignLines.join("\n") || "(ninguna)"}
`.trim();

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1100,
    system: `Eres Shadow, el Jarvis personal de ${prefs?.display_name ?? "André"}, analizando su semestre en la Universidad Panamericana. Escala de calificación 0-10. Escribe un ANÁLISIS Y PROYECCIÓN ACADÉMICA en español, directo y accionable, con esta estructura en markdown:

**Panorama** — una o dos frases sobre cómo viene el semestre (GPA proyectado, qué tan en línea va con sus metas).
**En riesgo** — materias donde la meta está difícil o las faltas son peligrosas, con el número exacto que necesita. Si nada está en riesgo, dilo.
**Plan de exámenes** — prioriza los exámenes próximos por cercanía y dificultad; di cuál atacar primero y desde cuándo estudiar cada uno. Si un examen difícil ya entró en su ventana de estudio, márcalo como urgente.
**Foco de la semana** — 2-3 acciones concretas para esta semana.

Sé conciso, usa los números reales del contexto, no inventes datos. Sin saludos ni relleno.`,
    messages: [{ role: "user", content: `Analiza mi situación académica y dame mi proyección:\n\n${context}` }],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  await supabase
    .from("shadow_cache")
    .upsert(
      { key: `academia:${today}`, content: text, metadata: null, generated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  return NextResponse.json({ content: text });
}
