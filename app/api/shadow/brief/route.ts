import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { buildDayPlan } from "@/lib/brief/plan";
import { buildBriefRadar } from "@/lib/brief/today";
import { buildCrossInsights } from "@/lib/brief/insights";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.slice(0, 7) + "-01";

  const [
    { data: prefs },
    { data: priorities },
    { data: dailyNote },
    { data: habits },
    { data: completions },
    { data: entries },
    { data: banks },
    { data: memories },
    plan,
    radar,
  ] = await Promise.all([
    supabase.from("user_preferences").select("display_name, vision_primary").single(),
    supabase.from("priorities").select("text, completed").eq("date", today),
    supabase.from("daily_notes").select("focus").eq("date", today).single(),
    supabase.from("habits").select("id, name").eq("active", true),
    supabase.from("habit_completions").select("habit_id").eq("date", today),
    supabase.from("financial_entries").select("category, amount").gte("date", monthStart),
    supabase.from("bank_accounts").select("current_balance, currency").eq("active", true),
    supabase
      .from("shadow_memory")
      .select("fact")
      .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
      .order("importance", { ascending: false })
      .limit(15),
    buildDayPlan(supabase, today),
    buildBriefRadar(supabase, today),
  ]);

  const insights = await buildCrossInsights(supabase, today, plan.items);

  const doneIds = new Set((completions ?? []).map((c) => c.habit_id));
  const habitsTotal = (habits ?? []).length;
  const habitsDone = (habits ?? []).filter((h) => doneIds.has(h.id)).length;
  const pendingHabits = (habits ?? []).filter((h) => !doneIds.has(h.id)).map((h) => h.name);
  const totalBalance = (banks ?? [])
    .filter((b) => b.currency === "MXN")
    .reduce((a, b) => a + b.current_balance, 0);
  const monthIncome = (entries ?? [])
    .filter((e) => e.category === "flouvia_ingreso")
    .reduce((a, e) => a + e.amount, 0);
  const monthExpenses = (entries ?? [])
    .filter((e) => e.category === "gasto_personal" || e.category === "gasto_flouvia")
    .reduce((a, e) => a + e.amount, 0);

  const dateStr = new Date().toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long",
  });

  const radarLines = radar.items.length
    ? radar.items.map((r) => `- ${r.urgent ? "⚠ " : ""}${r.label}: ${r.detail}`).join("\n")
    : "- (nada urgente)";
  const insightLines = insights.length
    ? insights.map((i) => `- ${i.text}`).join("\n")
    : "- (sin tensiones detectadas)";

  const context = `
Fecha: ${dateStr}
Intención del día: ${dailyNote?.focus || "(sin definir)"}
Visión: ${prefs?.vision_primary || "(sin definir)"}
Prioridades de hoy:
${(priorities ?? []).map((p) => `- [${p.completed ? "x" : " "}] ${p.text}`).join("\n") || "- (ninguna)"}

Plan cronológico de hoy (clases, gym, estudio, entregas y eventos fusionados):
${plan.text}

Lo que necesita atención (radar, cruzando deadlines):
${radarLines}

Tensiones entre módulos (insights):
${insightLines}

Hábitos: ${habitsDone}/${habitsTotal} completados hoy${pendingHabits.length ? ` (pendientes: ${pendingHabits.join(", ")})` : ""}
Finanzas del mes: saldo ${formatCurrency(totalBalance)}, ingresos ${formatCurrency(monthIncome)}, gastos ${formatCurrency(monthExpenses)}
Memoria relevante:
${(memories ?? []).map((m) => `- ${m.fact}`).join("\n") || "- (sin memoria)"}
`.trim();

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 700,
    system: `Eres Shadow, el Jarvis personal de ${prefs?.display_name ?? "André"}. Escribe el BRIEF DEL DÍA: un análisis estratégico, cálido pero directo, en español, basado en sus datos REALES de hoy.

Reglas:
- Máximo 5 frases cortas. Nada de saludos genéricos, "¡Claro!", relleno ni disclaimers.
- Empieza por lo más importante del día CONCRETO (un examen cercano, un pago, un choque de horarios, un evento que requiere salir/prepararse). Nómbralo con su dato (cuándo, cuánto, qué materia).
- Si hay tensiones entre módulos (insights), conéctalas: di cómo una cosa afecta a otra (p. ej. "tienes examen difícil el viernes y gym pesado el jueves").
- Termina SIEMPRE con una línea que empiece con "Primero:" proponiendo la PRIMERA acción concreta a tomar hoy (la más alta palanca).
- Habla en segunda persona, con autoridad calmada. Dinero en MXN.`,
    messages: [{ role: "user", content: `Estos son mis datos de hoy. Dame mi brief:\n\n${context}` }],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  await supabase
    .from("shadow_cache")
    .upsert(
      { key: `brief:${today}`, content: text, metadata: null, generated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  return NextResponse.json({ content: text });
}
