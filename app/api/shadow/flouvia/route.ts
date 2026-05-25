import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const month = today.slice(0, 7);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().slice(0, 10);

  const [
    { data: prefs },
    { data: clients },
    { data: projects },
    { data: invoices },
    { data: followups },
  ] = await Promise.all([
    supabase.from("user_preferences").select("display_name").single(),
    supabase.from("flouvia_clients").select("name, status, project_value, monthly_value, description"),
    supabase.from("flouvia_projects")
      .select("name, status, total_value, deadline, actual_hours, estimated_hours")
      .neq("status", "cancelled"),
    supabase.from("flouvia_invoices")
      .select("total, status, issued_date, paid_date")
      .gte("issued_date", sixMonthsAgoStr)
      .neq("status", "cancelled"),
    supabase.from("flouvia_followups")
      .select("title, due_date")
      .eq("done", false)
      .order("due_date")
      .limit(10),
  ]);

  const propuestas = (clients ?? []).filter((c) => c.status === "propuesta");
  const activos = (clients ?? []).filter((c) => c.status === "activo");
  const pausados = (clients ?? []).filter((c) => c.status === "pausado");

  const pipelineTotal = [...propuestas, ...activos].reduce((a, c) => a + (c.project_value ?? 0), 0);
  const mrr = activos.reduce((a, c) => a + (c.monthly_value ?? 0), 0);

  const monthlyRevenue: Record<string, { paid: number; pending: number }> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyRevenue[key] = { paid: 0, pending: 0 };
  }
  for (const inv of invoices ?? []) {
    const key = inv.status === "paid" && inv.paid_date
      ? inv.paid_date.slice(0, 7)
      : inv.issued_date?.slice(0, 7);
    if (!key || !monthlyRevenue[key]) continue;
    if (inv.status === "paid") monthlyRevenue[key].paid += inv.total;
    else monthlyRevenue[key].pending += inv.total;
  }

  const revenueLines = Object.entries(monthlyRevenue)
    .map(([k, v]) => {
      const [y, m] = k.split("-");
      const label = new Date(Number(y), Number(m) - 1).toLocaleString("es-MX", { month: "short", year: "2-digit" });
      const parts = [];
      if (v.paid > 0) parts.push(`cobrado ${formatCurrency(v.paid)}`);
      if (v.pending > 0) parts.push(`pendiente ${formatCurrency(v.pending)}`);
      return `${label}: ${parts.join(", ") || "sin movimientos"}`;
    })
    .join(" | ");

  const paidThisMonth = (invoices ?? [])
    .filter((i) => i.status === "paid" && (i.paid_date ?? i.issued_date)?.startsWith(month))
    .reduce((a, i) => a + i.total, 0);
  const pendingTotal = (invoices ?? [])
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((a, i) => a + i.total, 0);

  const clientLines = [
    propuestas.length > 0
      ? `Propuestas (${propuestas.length}): ${propuestas.map((c) => `${c.name}${c.project_value ? ` $${formatCurrency(c.project_value)}` : ""}`).join(", ")}`
      : null,
    activos.length > 0
      ? `Activos (${activos.length}, MRR ${formatCurrency(mrr)}): ${activos.map((c) => `${c.name}${c.monthly_value ? ` ${formatCurrency(c.monthly_value)}/mes` : ""}`).join(", ")}`
      : null,
    pausados.length > 0
      ? `Pausados (${pausados.length}): ${pausados.map((c) => c.name).join(", ")}`
      : null,
  ].filter(Boolean).join("\n");

  const projectLines = (projects ?? [])
    .map((p) => {
      const parts = [`${p.name} [${p.status}]`];
      if (p.total_value) parts.push(formatCurrency(p.total_value));
      if (p.deadline) parts.push(`deadline ${p.deadline}`);
      if (p.estimated_hours) parts.push(`${p.actual_hours ?? 0}/${p.estimated_hours}h`);
      return `- ${parts.join(" · ")}`;
    })
    .join("\n") || "- Sin proyectos activos";

  const followupLines = (followups ?? [])
    .map((f) => `- ${f.title}${f.due_date ? ` (${f.due_date})` : ""}`)
    .join("\n") || "- Sin follow-ups";

  const context = `
Mes: ${month} | Fecha: ${today}
Pipeline total: ${formatCurrency(pipelineTotal)} | MRR actual: ${formatCurrency(mrr)}
Cobrado este mes: ${formatCurrency(paidThisMonth)} | Por cobrar: ${formatCurrency(pendingTotal)}

Clientes:
${clientLines || "Sin clientes"}

Proyectos activos:
${projectLines}

Ingresos últimos 6 meses:
${revenueLines}

Follow-ups pendientes:
${followupLines}
`.trim();

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 700,
    system: `Eres Shadow, el asesor de negocio de ${prefs?.display_name ?? "André"} para su agencia Flouvia. Escribe un ANÁLISIS DE NEGOCIO en español: directo, estratégico, sin relleno. Estructura en 3 bloques cortos con estos encabezados exactos en negrita: **Lectura** (1-2 frases: estado del pipeline, MRR, conversión propuesta→activo, si los ingresos suben o bajan), **Oportunidades** (2-3 frases: qué propuestas deben avanzar, dónde hay upsell en clientes activos, posibles sinergias de cowork entre proyectos o clientes), **Movimientos** (2-3 acciones concretas esta semana: a quién contactar, qué cobrar, qué priorizar). Usa cifras reales. Nada de saludos.`,
    messages: [{ role: "user", content: `Estos son los datos de Flouvia:\n\n${context}` }],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  await supabase
    .from("shadow_cache")
    .upsert(
      { key: `flouvia:${month}`, content: text, metadata: null, generated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  return NextResponse.json({ content: text });
}
