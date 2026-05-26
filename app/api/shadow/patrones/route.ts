import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const TZ = "America/Mexico_City";
const WD_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function mxParts(iso: string): { wd: number; hour: number } {
  const d = new Date(iso);
  const wdName = d.toLocaleString("en-US", { timeZone: TZ, weekday: "short" });
  const hour = parseInt(d.toLocaleString("en-US", { timeZone: TZ, hour: "2-digit", hour12: false })) % 24;
  return { wd: WD_EN.indexOf(wdName), hour };
}

function mondayKey(): string {
  const now = new Date();
  const dayStr = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const [y, m, d] = dayStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().split("T")[0];
}

export async function POST() {
  const supabase = await createClient();
  const since = new Date(Date.now() - 90 * 86400000).toISOString();

  const [{ data: prefs }, { data: logsRaw }] = await Promise.all([
    supabase.from("user_preferences").select("display_name").single(),
    supabase.from("time_logs").select("category, started_at, duration_minutes, client_id").gte("started_at", since),
  ]);

  const logs = (logsRaw ?? []) as { category: string | null; started_at: string; duration_minutes: number | null }[];

  if (logs.length < 8) {
    const patterns: unknown[] = [];
    return NextResponse.json({ patterns, generatedAt: new Date().toISOString(), thin: true });
  }

  // minutos por (weekday, categoría) y hora modal por celda
  const cellMin: Record<string, number> = {};
  const cellHourMin: Record<string, Record<number, number>> = {};
  for (const l of logs) {
    const dur = l.duration_minutes ?? 0;
    if (dur <= 0) continue;
    const { wd, hour } = mxParts(l.started_at);
    if (wd < 0) continue;
    const cat = l.category ?? "Otros";
    const key = `${wd}|${cat}`;
    cellMin[key] = (cellMin[key] ?? 0) + dur;
    (cellHourMin[key] ??= {})[hour] = (cellHourMin[key]?.[hour] ?? 0) + dur;
  }

  const weeks = Math.max(1, Math.round((Date.now() - new Date(since).getTime()) / (7 * 86400000)));

  // resumen por día: top categorías con su hora típica
  const byDay: Record<number, string[]> = {};
  for (const [key, min] of Object.entries(cellMin)) {
    const [wdStr, cat] = key.split("|");
    const wd = Number(wdStr);
    const hours = cellHourMin[key] ?? {};
    const peakHour = Object.entries(hours).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "?";
    const hrs = (min / 60).toFixed(1);
    const perWeek = (min / weeks / 60).toFixed(1);
    (byDay[wd] ??= []).push(`${cat}: ${hrs}h total (~${perWeek}h/sem), hora típica ${peakHour}:00`);
  }

  const summary = Object.entries(byDay)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([wd, items]) => `${WD_NAMES[Number(wd)]}:\n  ${items.sort().join("\n  ")}`)
    .join("\n");

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 900,
    system: `Eres Shadow, el sistema predictivo de ${prefs?.display_name ?? "André"}. Analizas su historial de tiempo (últimas ${weeks} semanas) y detectas PATRONES recurrentes reales por día de la semana y hora — no obviedades. Para cada patrón fuerte, propón un bloqueo de calendario que proteja ese hábito.

Responde ÚNICAMENTE con JSON válido, sin texto extra:
{"patterns": [{"insight": "string", "suggestion": "string", "block": {"title": "string", "weekday": 0-6, "start": "HH:MM", "end": "HH:MM"}}]}

Reglas:
- weekday usa 0=Domingo, 1=Lunes … 6=Sábado.
- "insight": el patrón concreto con día y hora (ej. "Los miércoles ~14:00 concentras tu trabajo profundo: 6.2h en 4 semanas"). Usa cifras reales.
- "suggestion": qué hacer al respecto, una frase accionable.
- "block": opcional. Inclúyelo solo si tiene sentido bloquear ese horario en el calendario; el rango debe reflejar la hora típica y duración real. Si no aplica, omite "block".
- Máximo 3 patrones, los más fuertes. Si no hay patrones claros, devuelve {"patterns": []}.
- Español, directo, sin relleno.`,
    messages: [{ role: "user", content: `Mi tiempo por día de la semana (últimas ${weeks} semanas):\n\n${summary}` }],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  let patterns: unknown[] = [];
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : text);
    if (Array.isArray(parsed.patterns)) patterns = parsed.patterns.slice(0, 3);
  } catch {
    /* vacío si no entregó JSON */
  }

  const generatedAt = new Date().toISOString();
  await supabase
    .from("shadow_cache")
    .upsert(
      { key: `patrones:${mondayKey()}`, content: JSON.stringify(patterns), metadata: null, generated_at: generatedAt },
      { onConflict: "key" }
    );

  return NextResponse.json({ patterns, generatedAt });
}
