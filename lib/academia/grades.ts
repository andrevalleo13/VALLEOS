// Cálculo de calificaciones ponderadas (escala 0-10, UP) y planeación de estudio.
// Compartido entre la UI de Panamericana, las tools de Shadow y el análisis.

export type Componentish = { weight: number | null; grade: number | null };

export type CourseGrades = {
  totalWeight: number;        // suma de pesos definidos (idealmente 100)
  gradedWeight: number;       // peso ya calificado
  remainingWeight: number;    // peso definido aún sin calificar
  earnedPoints: number;       // puntos asegurados sobre escala 0-10 (con totalWeight=100)
  currentGrade: number | null;// promedio sobre lo ya calificado (0-10)
  projectedFinal: number | null; // final proyectado si mantiene el ritmo actual
  schemeComplete: boolean;    // los pesos suman ~100
};

export function computeCourseGrades(components: Componentish[]): CourseGrades {
  const defined = components.filter((c) => (c.weight ?? 0) > 0);
  const graded = defined.filter((c) => c.grade !== null && c.grade !== undefined);

  const totalWeight = defined.reduce((a, c) => a + (c.weight ?? 0), 0);
  const gradedWeight = graded.reduce((a, c) => a + (c.weight ?? 0), 0);
  const remainingWeight = Math.max(0, totalWeight - gradedWeight);

  // earnedPoints en escala 0-10 asumiendo el 100% del esquema
  const earnedPoints = graded.reduce((a, c) => a + (c.grade as number) * ((c.weight ?? 0) / 100), 0);
  const currentGrade = gradedWeight > 0 ? earnedPoints / (gradedWeight / 100) : null;
  // proyección: lo asegurado + el resto al ritmo actual
  const projectedFinal =
    currentGrade !== null ? earnedPoints + currentGrade * (remainingWeight / 100) : null;

  return {
    totalWeight,
    gradedWeight,
    remainingWeight,
    earnedPoints,
    currentGrade,
    projectedFinal,
    schemeComplete: Math.abs(totalWeight - 100) < 0.01,
  };
}

// Qué promedio necesitas en lo que falta para llegar a `target` (escala 0-10).
// null = no hay peso restante. <0 → ya asegurado. >10 → ya no alcanza.
export function neededForTarget(g: CourseGrades, target: number): number | null {
  if (g.remainingWeight <= 0) return null;
  return (target - g.earnedPoints) / (g.remainingWeight / 100);
}

// ── Exámenes: dificultad → plan de estudio ──────────────────────────────────
export const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Muy fácil",
  2: "Fácil",
  3: "Media",
  4: "Difícil",
  5: "Muy difícil",
};

export const DIFFICULTY_COLORS: Record<number, string> = {
  1: "var(--green)",
  2: "var(--green)",
  3: "var(--gold)",
  4: "var(--red)",
  5: "var(--red)",
};

// Días de anticipación recomendados para empezar a estudiar según dificultad.
export const STUDY_LEAD_DAYS: Record<number, number> = { 1: 2, 2: 3, 3: 7, 4: 12, 5: 18 };

export function suggestStudyStart(examDate: string, difficulty: number | null): string | null {
  if (!examDate) return null;
  const lead = STUDY_LEAD_DAYS[difficulty ?? 3] ?? 7;
  const d = new Date(examDate + "T00:00:00");
  d.setDate(d.getDate() - lead);
  return d.toISOString().split("T")[0];
}

export function daysUntil(dateStr: string | null, today = new Date()): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const t = new Date(today.toISOString().split("T")[0] + "T00:00:00");
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

// Estado de estudio de un examen relativo a hoy.
export type StudyState = "done" | "urgent" | "study-now" | "soon" | "later" | "past";

export function studyState(
  examDate: string | null,
  studyStart: string | null,
  status: string,
  today = new Date()
): StudyState {
  if (status === "done") return "done";
  const toExam = daysUntil(examDate, today);
  if (toExam === null) return "later";
  if (toExam < 0) return "past";
  const toStart = daysUntil(studyStart, today);
  if (toExam <= 2) return "urgent";
  if (toStart !== null && toStart <= 0) return "study-now";
  if (toStart !== null && toStart <= 3) return "soon";
  return "later";
}

// Riesgo de faltas: razón sobre el límite permitido.
export function absenceRisk(absences: number, max: number | null): "safe" | "warn" | "danger" | null {
  if (!max || max <= 0) return null;
  const ratio = absences / max;
  if (absences >= max) return "danger";
  if (ratio >= 0.66) return "warn";
  return "safe";
}

export const KIND_LABELS: Record<string, string> = {
  examen: "Examen",
  tarea: "Tarea",
  proyecto: "Proyecto",
  participacion: "Participación",
  otro: "Otro",
};
