import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { HealthEntry, WeightLog } from "@/lib/supabase/types";
import {
  avg, weightStats, sleepDebt, compareWindows, correlate, corrLabel,
} from "@/lib/salud/health";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const month = today.slice(0, 7);
  const since30 = new Date(Date.now() - 29 * 86400000).toISOString().split("T")[0];
  const since180 = new Date(Date.now() - 179 * 86400000).toISOString().split("T")[0];

  const [{ data: prefs }, { data: entriesRaw }, { data: weightsRaw }] = await Promise.all([
    supabase.from("user_preferences").select("display_name").single(),
    supabase.from("health_entries").select("*").gte("date", since30).order("date", { ascending: false }),
    supabase.from("weight_logs").select("*").gte("date", since180).order("date", { ascending: true }),
  ]);

  const entries = (entriesRaw ?? []) as HealthEntry[];
  const weights = (weightsRaw ?? []) as WeightLog[];
  const last7 = entries.slice(0, 7);

  const w = weightStats(weights);
  const avgSleep = avg(last7.map((e) => e.sleep_hours));
  const avgMood = avg(last7.map((e) => e.mood));
  const avgEnergy = avg(last7.map((e) => e.energy));
  const avgSteps = avg(last7.map((e) => e.steps));
  const avgHr = avg(last7.map((e) => e.resting_hr));
  const debt = sleepDebt(last7);

  const sleepCmp = compareWindows(entries, "sleep_hours");
  const moodCmp = compareWindows(entries, "mood");
  const energyCmp = compareWindows(entries, "energy");
  const corrSleepMood = correlate(entries, "sleep_hours", "mood");
  const corrSleepEnergy = correlate(entries, "sleep_hours", "energy");

  const workouts = last7.filter((e) => (e.workout_minutes ?? 0) > 0).length;

  const fmtDelta = (d: number | null, u = "") => (d == null ? "s/d" : `${d > 0 ? "+" : ""}${d}${u} vs 7d previos`);

  const weightLine = w
    ? `Peso actual ${w.current}kg (${w.currentDate})${w.count > 1 ? `, cambio ${w.delta > 0 ? "+" : ""}${w.delta}kg en el período (${w.perWeek > 0 ? "+" : ""}${w.perWeek}kg/sem), rango ${w.min}–${w.max}kg` : ", primera medición"}${w.bodyFat ? `, grasa ${w.bodyFat}%` : ""}`
    : "Sin registros de peso.";

  const context = `
Período: últimos 30 días (mes ${month}).
Registros con datos: ${entries.length} días, ${weights.length} mediciones de peso.

PESO: ${weightLine}

SUEÑO (7d): promedio ${avgSleep ?? "s/d"}h (${fmtDelta(sleepCmp.delta, "h")}). Deuda acumulada vs objetivo 7.5h: ${debt > 0 ? `−${debt}h` : debt < 0 ? `+${Math.abs(debt)}h` : "0"}.
ÁNIMO (7d): ${avgMood ?? "s/d"}/5 (${fmtDelta(moodCmp.delta)}). ENERGÍA (7d): ${avgEnergy ?? "s/d"}/5 (${fmtDelta(energyCmp.delta)}).
ACTIVIDAD (7d): pasos prom ${avgSteps ? Math.round(avgSteps) : "s/d"}, FC reposo ${avgHr ?? "s/d"} lpm, ${workouts} día(s) con ejercicio.

CORRELACIONES (30d): sueño↔ánimo ${corrLabel(corrSleepMood)}; sueño↔energía ${corrLabel(corrSleepEnergy)}.
`.trim();

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 700,
    system: `Eres Shadow, el coach de salud personal de ${prefs?.display_name ?? "André"}. Escribe un ANÁLISIS DE SALUD en español: directo, concreto, sin relleno ni disclaimers médicos genéricos. Estructura en 3 bloques cortos con estos encabezados exactos en negrita markdown: **Lectura** (1-2 frases: cómo está de sueño, peso, ánimo/energía y qué cambió vs. la semana previa), **Patrones** (1-2 frases sobre las correlaciones reales — ej. cómo el sueño afecta su ánimo/energía — y la deuda de sueño), **Movimientos** (2-3 acciones concretas y específicas para esta semana). Usa las cifras reales que te doy. No empieces con saludos. Si faltan datos en algún rubro, dilo en una frase y sugiere registrarlo, sin inventar.`,
    messages: [{ role: "user", content: `Estos son mis datos de salud. Dame mi análisis:\n\n${context}` }],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  await supabase
    .from("shadow_cache")
    .upsert(
      { key: `salud:${month}`, content: text, metadata: null, generated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  return NextResponse.json({ content: text });
}
