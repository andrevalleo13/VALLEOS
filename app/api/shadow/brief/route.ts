import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

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
  ]);

  const doneIds = new Set((completions ?? []).map((c) => c.habit_id));
  const habitsTotal = (habits ?? []).length;
  const habitsDone = (habits ?? []).filter((h) => doneIds.has(h.id)).length;
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

  const context = `
Fecha: ${dateStr}
Intención del día: ${dailyNote?.focus || "(sin definir)"}
Visión: ${prefs?.vision_primary || "(sin definir)"}
Prioridades de hoy:
${(priorities ?? []).map((p) => `- [${p.completed ? "x" : " "}] ${p.text}`).join("\n") || "- (ninguna)"}
Hábitos: ${habitsDone}/${habitsTotal} completados hoy
Finanzas del mes: saldo ${formatCurrency(totalBalance)}, ingresos ${formatCurrency(monthIncome)}, gastos ${formatCurrency(monthExpenses)}
Memoria relevante:
${(memories ?? []).map((m) => `- ${m.fact}`).join("\n") || "- (sin memoria)"}
`.trim();

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: `Eres Shadow, el Jarvis personal de ${prefs?.display_name ?? "André"}. Escribe el BRIEF DEL DÍA: un resumen estratégico, cálido pero directo, en español. Máximo 4 frases cortas. Empieza por lo más importante. Si hay prioridades sin terminar o hábitos pendientes, menciónalo con tacto. Termina con un foco claro para hoy. Sin saludos genéricos, sin "¡Claro!", sin relleno.`,
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
