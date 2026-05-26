export type TimeCategory =
  | "Flouvia"
  | "Panamericana"
  | "Estudio"
  | "Deep work"
  | "Salud"
  | "Personal"
  | "Descanso";

type CatDef = { key: TimeCategory; color: string; icon: string };

export const TIME_CATEGORIES: CatDef[] = [
  { key: "Flouvia", color: "#C9A35F", icon: "Briefcase" },
  { key: "Panamericana", color: "#6BA8E5", icon: "GraduationCap" },
  { key: "Estudio", color: "#9B7DE5", icon: "BookOpen" },
  { key: "Deep work", color: "#5FB97A", icon: "Brain" },
  { key: "Salud", color: "#E56B8A", icon: "HeartPulse" },
  { key: "Personal", color: "#6BD0E5", icon: "User" },
  { key: "Descanso", color: "#8A8A9A", icon: "Moon" },
];

export const CATEGORY_LIST = TIME_CATEGORIES.map((c) => c.key);

const BY_KEY = new Map(TIME_CATEGORIES.map((c) => [c.key, c]));
const FALLBACK = "#8A8A9A";

export function catColor(cat: string | null | undefined): string {
  if (!cat) return FALLBACK;
  return BY_KEY.get(cat as TimeCategory)?.color ?? FALLBACK;
}

export function catIcon(cat: string | null | undefined): string {
  if (!cat) return "Circle";
  return BY_KEY.get(cat as TimeCategory)?.icon ?? "Circle";
}

// Paleta para clientes de Flouvia (cicla por índice estable)
const CLIENT_PALETTE = [
  "#C9A35F", "#6BA8E5", "#9B7DE5", "#5FB97A", "#E56B8A",
  "#6BD0E5", "#E5A86B", "#C77DE5", "#8AE56B", "#E5786B",
];

export function clientColor(index: number): string {
  return CLIENT_PALETTE[index % CLIENT_PALETTE.length];
}

// minutos → "1.5h" / "45m" / "—"
export function fmtHours(mins: number): string {
  if (!mins || mins <= 0) return "—";
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = mins / 60;
  return `${Math.round(h * 10) / 10}h`;
}
