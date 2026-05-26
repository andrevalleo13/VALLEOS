import type { HealthEntry, WeightLog } from "@/lib/supabase/types";

export const SLEEP_TARGET = 7.5;

export function avg(vals: (number | null | undefined)[]): number | null {
  const v = vals.filter((x): x is number => typeof x === "number" && isFinite(x));
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
}

export function round(n: number, d = 1): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

// Peso actual = último registro. Delta = vs. la medición más antigua dentro del período.
export function weightStats(logs: WeightLog[]) {
  if (logs.length === 0) return null;
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const current = sorted[sorted.length - 1];
  const first = sorted[0];
  const delta = round(current.weight_kg - first.weight_kg, 1);
  // tendencia simple: pendiente entre primer y último, normalizada por días
  const days = Math.max(1, daysBetween(first.date, current.date));
  const perWeek = round((delta / days) * 7, 2);
  return {
    current: current.weight_kg,
    currentDate: current.date,
    bodyFat: current.body_fat_pct,
    muscle: current.muscle_kg,
    delta,
    perWeek,
    min: Math.min(...sorted.map((l) => l.weight_kg)),
    max: Math.max(...sorted.map((l) => l.weight_kg)),
    count: sorted.length,
    series: sorted,
  };
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T12:00:00").getTime();
  const db = new Date(b + "T12:00:00").getTime();
  return Math.round(Math.abs(db - da) / 86400000);
}

// Deuda de sueño acumulada vs objetivo en los últimos N días con dato
export function sleepDebt(entries: HealthEntry[]): number {
  const withSleep = entries.filter((e) => typeof e.sleep_hours === "number");
  if (withSleep.length === 0) return 0;
  const debt = withSleep.reduce((a, e) => a + (SLEEP_TARGET - (e.sleep_hours ?? 0)), 0);
  return round(debt, 1);
}

export function sleepLabel(h: number | null): string {
  if (h == null) return "—";
  if (h >= SLEEP_TARGET) return "óptimo";
  if (h >= 6) return "aceptable";
  return "insuficiente";
}

export function sleepColor(h: number | null | undefined): string {
  if (h == null) return "var(--line-2)";
  if (h >= SLEEP_TARGET) return "var(--green)";
  if (h >= 6) return "var(--gold)";
  return "var(--red)";
}

// Correlación de Pearson entre sueño de la noche y mood/energía del mismo día.
// Devuelve null si no hay suficientes pares.
export function correlate(
  entries: HealthEntry[],
  xKey: "sleep_hours" | "steps",
  yKey: "mood" | "energy",
): number | null {
  const pairs = entries
    .map((e) => [e[xKey], e[yKey]] as const)
    .filter((p): p is [number, number] => typeof p[0] === "number" && typeof p[1] === "number");
  if (pairs.length < 4) return null;
  const n = pairs.length;
  const sx = pairs.reduce((a, p) => a + p[0], 0);
  const sy = pairs.reduce((a, p) => a + p[1], 0);
  const sxx = pairs.reduce((a, p) => a + p[0] * p[0], 0);
  const syy = pairs.reduce((a, p) => a + p[1] * p[1], 0);
  const sxy = pairs.reduce((a, p) => a + p[0] * p[1], 0);
  const num = n * sxy - sx * sy;
  const den = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
  if (den === 0) return null;
  return round(num / den, 2);
}

export function corrLabel(r: number | null): string {
  if (r == null) return "datos insuficientes";
  const a = Math.abs(r);
  const strength = a >= 0.6 ? "fuerte" : a >= 0.3 ? "moderada" : "débil";
  const dir = r > 0 ? "positiva" : "negativa";
  return `${strength} ${dir} (r=${r})`;
}

// Promedios de dos ventanas para detectar cambios (ej. últimos 7 vs 7 previos)
export function compareWindows(
  entries: HealthEntry[],
  key: "sleep_hours" | "mood" | "energy" | "steps",
  size = 7,
) {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const recent = avg(sorted.slice(0, size).map((e) => e[key]));
  const prev = avg(sorted.slice(size, size * 2).map((e) => e[key]));
  const delta = recent != null && prev != null ? round(recent - prev, 1) : null;
  return { recent, prev, delta };
}
