// Historial de semestres y promedio general de la carrera.
// En la UP los créditos solo indican el "costo" de la materia: TODAS las materias
// pesan igual en el promedio. Por eso el promedio general es el promedio simple de
// todas las materias cursadas — ponderado por el número de materias de cada semestre
// (un semestre con 7 materias aporta más que uno con 5), no por créditos.

import type { Semester } from "@/lib/supabase/types";

export type SemesterGpaInput = { grade: number | null };

// Promedio simple de las materias calificadas de un semestre (escala 0-10).
export function semesterGpa(courses: SemesterGpaInput[]): number | null {
  const graded = courses.filter((c) => c.grade !== null && c.grade !== undefined);
  if (graded.length === 0) return null;
  return graded.reduce((a, c) => a + (c.grade as number), 0) / graded.length;
}

export type ActiveCourse = { grade: number | null; credits: number | null };

export type CumulativeResult = {
  gpa: number | null;        // promedio general (todas las materias pesan igual)
  materias: number;          // total de materias contadas
  creditsTaken: number;      // créditos acumulados (cerrados + activo)
};

// Promedio general de la carrera: combina los semestres cerrados (cada uno aporta
// su gpa × nº de materias) con las materias calificadas del semestre activo.
export function cumulativeGpa(closed: Semester[], active: ActiveCourse[]): CumulativeResult {
  let points = 0;
  let materias = 0;
  let creditsTaken = 0;

  for (const s of closed) {
    const count = s.course_count ?? 0;
    if (s.gpa !== null && count > 0) {
      points += s.gpa * count;
      materias += count;
    }
    creditsTaken += s.credits_passed ?? s.credits_taken ?? 0;
  }

  for (const c of active) {
    if (c.grade !== null && c.grade !== undefined) {
      points += c.grade;
      materias += 1;
    }
    creditsTaken += c.credits ?? 0;
  }

  return {
    gpa: materias > 0 ? points / materias : null,
    materias,
    creditsTaken,
  };
}

// Puntos de la trayectoria: cada semestre cerrado + el activo en curso (si tiene gpa).
export type TrajectoryPoint = { term: number; label: string; gpa: number; current: boolean };

export function buildTrajectory(
  closed: Semester[],
  activeTerm: number | null,
  activeGpa: number | null,
  activeLabel: string
): TrajectoryPoint[] {
  const pts: TrajectoryPoint[] = [];
  for (const s of closed) {
    if (s.gpa === null) continue;
    pts.push({ term: s.term_number ?? 0, label: s.label, gpa: s.gpa, current: false });
  }
  pts.sort((a, b) => a.term - b.term);
  if (activeGpa !== null) {
    pts.push({ term: activeTerm ?? (pts.at(-1)?.term ?? 0) + 1, label: activeLabel, gpa: activeGpa, current: true });
  }
  return pts;
}

// Número de semestre sugerido para el siguiente cierre / semestre nuevo.
export function nextTermNumber(closed: Semester[]): number {
  const max = closed.reduce((m, s) => Math.max(m, s.term_number ?? 0), 0);
  return max + 1;
}

export function gpaColor(gpa: number | null, target: number): string {
  if (gpa === null) return "var(--mute)";
  if (gpa >= target) return "var(--green)";
  if (gpa >= target - 0.5) return "var(--gold)";
  return "var(--red)";
}
