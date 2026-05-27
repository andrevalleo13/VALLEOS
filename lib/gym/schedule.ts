// Horario semanal + helpers de cardio para el módulo Gym.
// weekday usa convención JS (0=Domingo … 6=Sábado), igual que en Tiempo.

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// Ordenado Lun→Dom para la UI (las semanas empiezan el lunes en Valle OS).
export const WEEK_ORDER: { idx: Weekday; label: string; short: string }[] = [
  { idx: 1, label: "Lunes", short: "Lun" },
  { idx: 2, label: "Martes", short: "Mar" },
  { idx: 3, label: "Miércoles", short: "Mié" },
  { idx: 4, label: "Jueves", short: "Jue" },
  { idx: 5, label: "Viernes", short: "Vie" },
  { idx: 6, label: "Sábado", short: "Sáb" },
  { idx: 0, label: "Domingo", short: "Dom" },
];

export const todayWeekday = (): Weekday => new Date().getDay() as Weekday;

// ── Cardio ──
export const CARDIO_ACTIVITIES: { key: string; label: string; emoji: string }[] = [
  { key: "run", label: "Correr", emoji: "🏃" },
  { key: "walk", label: "Caminar", emoji: "🚶" },
  { key: "bike", label: "Bici", emoji: "🚴" },
  { key: "swim", label: "Nadar", emoji: "🏊" },
  { key: "row", label: "Remo", emoji: "🚣" },
  { key: "other", label: "Otro", emoji: "💨" },
];

export function activityLabel(key: string | null | undefined): string {
  return CARDIO_ACTIVITIES.find((a) => a.key === key)?.label ?? "Cardio";
}
export function activityEmoji(key: string | null | undefined): string {
  return CARDIO_ACTIVITIES.find((a) => a.key === key)?.emoji ?? "💨";
}

// Ritmo en min/km a partir de minutos y distancia → "5:30".
export function pace(durationMin: number | null, distanceKm: number | null): string | null {
  if (!durationMin || !distanceKm || distanceKm <= 0) return null;
  const perKm = durationMin / distanceKm;
  const m = Math.floor(perKm);
  const s = Math.round((perKm - m) * 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function fmtKm(km: number): string {
  return Number.isInteger(km) ? `${km}` : km.toFixed(1);
}
