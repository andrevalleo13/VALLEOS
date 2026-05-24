// Catálogo canónico de grupos musculares para Valle OS · Gym.
// Las keys son las que se guardan en workout_days.muscle_groups,
// workout_exercises.muscle_group y workout_sets.muscle_group.

export type MuscleKey =
  | "pecho"
  | "espalda"
  | "trapecio"
  | "hombros"
  | "biceps"
  | "triceps"
  | "antebrazo"
  | "abdomen"
  | "cuadriceps"
  | "isquios"
  | "gluteos"
  | "pantorrillas"
  | "lumbar";

export const MUSCLES: { key: MuscleKey; label: string; view: "front" | "back" | "both" }[] = [
  { key: "pecho", label: "Pecho", view: "front" },
  { key: "hombros", label: "Hombros", view: "both" },
  { key: "biceps", label: "Bíceps", view: "front" },
  { key: "antebrazo", label: "Antebrazo", view: "both" },
  { key: "abdomen", label: "Abdomen", view: "front" },
  { key: "cuadriceps", label: "Cuádriceps", view: "front" },
  { key: "espalda", label: "Espalda", view: "back" },
  { key: "trapecio", label: "Trapecio", view: "back" },
  { key: "triceps", label: "Tríceps", view: "back" },
  { key: "lumbar", label: "Lumbar", view: "back" },
  { key: "gluteos", label: "Glúteos", view: "back" },
  { key: "isquios", label: "Isquios", view: "back" },
  { key: "pantorrillas", label: "Pantorrillas", view: "both" },
];

export const MUSCLE_KEYS = MUSCLES.map((m) => m.key);

const LABEL: Record<string, string> = Object.fromEntries(MUSCLES.map((m) => [m.key, m.label]));

export function muscleLabel(key: string | null | undefined): string {
  if (!key) return "—";
  return LABEL[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export function normalizeMuscle(raw: string | null | undefined): MuscleKey | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (MUSCLE_KEYS.includes(s as MuscleKey)) return s as MuscleKey;
  // sinónimos comunes
  const map: Record<string, MuscleKey> = {
    pectoral: "pecho", chest: "pecho", pecs: "pecho",
    dorsal: "espalda", dorsales: "espalda", back: "espalda", lats: "espalda",
    trapecios: "trapecio", traps: "trapecio",
    hombro: "hombros", deltoides: "hombros", shoulders: "hombros", delts: "hombros",
    bicep: "biceps", biceps: "biceps",
    tricep: "triceps", triceps: "triceps",
    antebrazos: "antebrazo", forearms: "antebrazo",
    abdominales: "abdomen", abs: "abdomen", core: "abdomen",
    cuadriceps: "cuadriceps", cuads: "cuadriceps", quads: "cuadriceps", pierna: "cuadriceps", piernas: "cuadriceps",
    femoral: "isquios", femorales: "isquios", isquiotibiales: "isquios", hamstrings: "isquios",
    gluteo: "gluteos", gluteos: "gluteos", glutes: "gluteos",
    pantorrilla: "pantorrillas", gemelos: "pantorrillas", calves: "pantorrillas",
    espalda_baja: "lumbar", lower_back: "lumbar",
  };
  return map[s] ?? null;
}
