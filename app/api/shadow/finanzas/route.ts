import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { bucketLabel, entryBucket } from "@/lib/finance/categories";
import { buildUpcomingPayments } from "@/lib/finance/payments";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const month = today.slice(0, 7);
  const monthStart = month + "-01";
  const prevMonthStart = new Date(new Date(monthStart).setMonth(new Date(monthStart).getMonth() - 1))
    .toISOString().slice(0, 10);

  const [
    { data: prefs },
    { data: banks },
    { data: cards },
    { data: investments },
    { data: entries },
    { data: prevEntries },
    { data: recurring },
    { data: capitalGoals },
  ] = await Promise.all([
    supabase.from("user_preferences").select("display_name, vision_primary").single(),
    supabase.from("bank_accounts").select("*").eq("active", true),
    supabase.from("credit_cards").select("*").eq("active", true),
    supabase.from("investments").select("name, current_value, amount_invested").eq("active", true),
    supabase.from("financial_entries").select("category, amount, subcategory, description, date").gte("date", monthStart),
    supabase.from("financial_entries").select("category, amount").gte("date", prevMonthStart).lt("date", monthStart),
    supabase.from("recurring_charges").select("*").eq("active", true),
    supabase.from("capital_goals").select("name, target_amount, current_amount"),
  ]);

  const totalBanks = (banks ?? []).reduce((a, b) => a + b.current_balance, 0);
  const totalCards = (cards ?? []).reduce((a, c) => a + c.current_balance, 0);
  const totalInvested = (investments ?? []).reduce((a, i) => a + i.current_value, 0);
  const netWorth = totalBanks + totalInvested - totalCards;

  const income = (entries ?? []).filter((e) => e.category === "flouvia_ingreso").reduce((a, e) => a + e.amount, 0);
  const expenses = (entries ?? []).filter((e) => e.category === "gasto_personal" || e.category === "gasto_flouvia").reduce((a, e) => a + e.amount, 0);
  const prevExpenses = (prevEntries ?? []).filter((e) => e.category === "gasto_personal" || e.category === "gasto_flouvia").reduce((a, e) => a + e.amount, 0);

  const byBucket = new Map<string, number>();
  for (const e of entries ?? []) {
    if (e.category === "flouvia_ingreso") continue;
    const b = entryBucket(e.category, e.subcategory);
    byBucket.set(b, (byBucket.get(b) ?? 0) + e.amount);
  }
  const dist = [...byBucket.entries()].sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${bucketLabel(k)}: ${formatCurrency(v)} (${expenses > 0 ? Math.round((v / expenses) * 100) : 0}%)`).join("; ");

  const payments = buildUpcomingPayments(cards ?? [], recurring ?? []).slice(0, 8);
  const payLines = payments.map((p) => `- ${p.name}: ${p.amount ? formatCurrency(p.amount) : "monto s/d"} en ${p.daysUntil}d (${p.dueDate})`).join("\n") || "- (sin pagos próximos)";
  const goalLines = (capitalGoals ?? []).map((g) => `- ${g.name}: ${formatCurrency(g.current_amount)}/${formatCurrency(g.target_amount)} (${Math.round((g.current_amount / g.target_amount) * 100)}%)`).join("\n") || "- (sin metas)";

  const context = `
Mes: ${month}
Patrimonio neto: ${formatCurrency(netWorth)} — cuentas ${formatCurrency(totalBanks)}, inversiones ${formatCurrency(totalInvested)}, deuda en tarjetas ${formatCurrency(totalCards)}
Este mes: ingresos ${formatCurrency(income)}, gastos ${formatCurrency(expenses)}, balance ${formatCurrency(income - expenses)}
Gasto mes anterior: ${formatCurrency(prevExpenses)} (cambio ${prevExpenses > 0 ? (((expenses - prevExpenses) / prevExpenses) * 100).toFixed(0) + "%" : "n/d"})
Distribución del gasto: ${dist || "(sin gastos)"}
Próximos pagos:
${payLines}
Metas de capital:
${goalLines}
Visión: ${prefs?.vision_primary || "(sin definir)"}
`.trim();

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 700,
    system: `Eres Shadow, el asesor financiero personal de ${prefs?.display_name ?? "André"}. Escribe un ANÁLISIS FINANCIERO del mes en español: directo, estratégico, sin relleno. Estructura en 3 bloques muy cortos con estos encabezados exactos en negrita markdown: **Lectura** (1-2 frases: cómo va el mes, balance, tendencia vs mes pasado), **En qué se va el dinero** (1-2 frases sobre la categoría que más pesa y si hay algo que vigilar), **Movimientos** (2-3 acciones concretas: pagos por venir, dónde recortar, cuánto puede destinar a metas/inversión). Usa cifras reales. Nada de saludos ni "¡Claro!".`,
    messages: [{ role: "user", content: `Estos son mis datos financieros. Dame mi análisis:\n\n${context}` }],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  await supabase
    .from("shadow_cache")
    .upsert(
      { key: `finanzas:${month}`, content: text, metadata: null, generated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  return NextResponse.json({ content: text });
}
