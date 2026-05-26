export const GOAL_CATS = [
  { v: "career", l: "Carrera", c: "var(--gold)" },
  { v: "finance", l: "Finanzas", c: "var(--green)" },
  { v: "health", l: "Salud", c: "var(--red)" },
  { v: "learning", l: "Aprendizaje", c: "var(--violet)" },
  { v: "relationships", l: "Relaciones", c: "var(--blue)" },
  { v: "experience", l: "Experiencias", c: "var(--gold-2)" },
  { v: "creative", l: "Creativo", c: "var(--violet)" },
  { v: "other", l: "Otro", c: "var(--mute)" },
] as const;

export function catColor(v: string): string {
  return GOAL_CATS.find((c) => c.v === v)?.c ?? "var(--mute)";
}

export function catLabel(v: string): string {
  return GOAL_CATS.find((c) => c.v === v)?.l ?? v;
}
