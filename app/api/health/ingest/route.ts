import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Ingesta de Apple Salud / Apple Fitness vía un Atajo (Shortcut) en el iPhone.
// La PWA no puede leer HealthKit directamente; un Atajo lee los datos y hace
// POST aquí con un token. Header: Authorization: Bearer <HEALTH_INGEST_SECRET>.
//
// Body JSON (todos opcionales salvo que quieras registrar algo):
// {
//   "date": "2026-05-25",          // opcional, default hoy (America/Mexico_City)
//   "sleep_hours": 7.2, "sleep_quality": 4,
//   "steps": 8400, "resting_hr": 58, "active_calories": 540,
//   "bedtime": "23:40", "wake_time": "06:55", "water_l": 2.5,
//   "workout_minutes": 45, "workout_type": "Fuerza",
//   "weight_kg": 72.3, "body_fat_pct": 15.2, "muscle_kg": 34.1
// }

function todayMx(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

const numOr = (v: unknown): number | null => (typeof v === "number" && isFinite(v) ? v : null);
const intOr = (v: unknown): number | null => {
  const n = numOr(v);
  return n == null ? null : Math.round(n);
};
const strOr = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export async function POST(req: NextRequest) {
  const secret = process.env.HEALTH_INGEST_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "HEALTH_INGEST_SECRET no configurado en el servidor." }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim() || req.headers.get("x-health-token")?.trim() || "";
  if (token !== secret) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const date = strOr(body.date) ?? todayMx();
  const supabase = await createClient();
  const written: string[] = [];

  // Métricas del día → health_entries (upsert parcial: solo campos presentes)
  const dayFields: Record<string, unknown> = {};
  const map: Record<string, (v: unknown) => number | string | null> = {
    sleep_hours: numOr, sleep_quality: intOr, steps: intOr, resting_hr: intOr,
    active_calories: intOr, water_l: numOr, workout_minutes: intOr,
    bedtime: strOr, wake_time: strOr, workout_type: strOr, mood: intOr, energy: intOr,
  };
  for (const [key, fn] of Object.entries(map)) {
    if (key in body) {
      const val = fn(body[key]);
      if (val != null) dayFields[key] = val;
    }
  }
  if (Object.keys(dayFields).length > 0) {
    const { error } = await supabase
      .from("health_entries")
      .upsert({ date, source: "apple_health", ...dayFields }, { onConflict: "date" });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    written.push(`día (${Object.keys(dayFields).join(", ")})`);
  }

  // Peso → weight_logs
  const weight = numOr(body.weight_kg);
  if (weight != null) {
    const { error } = await supabase.from("weight_logs").upsert(
      {
        date,
        weight_kg: weight,
        body_fat_pct: numOr(body.body_fat_pct),
        muscle_kg: numOr(body.muscle_kg),
        notes: null,
        source: "apple_health",
      },
      { onConflict: "date" }
    );
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    written.push(`peso ${weight}kg`);
  }

  if (written.length === 0) {
    return NextResponse.json({ ok: false, error: "No envié ningún dato reconocible." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, date, written });
}
