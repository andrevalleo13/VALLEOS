import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/types";
import { buildBriefRadar } from "@/lib/brief/today";
import { buildDayPlan } from "@/lib/brief/plan";
import { buildCrossInsights } from "@/lib/brief/insights";

function sb() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const truncate = (s: string, n = 90) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

// Shadow proactivo: corre el radar + insights del día y crea notificaciones
// para lo urgente. El cron /api/cron/notify las empuja al dispositivo después.
// Dedupe por título contra las notis creadas en las últimas ~18h.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const supabase = sb();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });

  const [radar, plan] = await Promise.all([buildBriefRadar(supabase, today), buildDayPlan(supabase, today)]);
  const insights = await buildCrossInsights(supabase, today, plan.items);

  type Cand = { title: string; body: string | null; severity: string; module: string | null; href: string };
  const cands: Cand[] = [];

  // Radar: solo lo marcado urgente.
  for (const r of radar.items) {
    if (!r.urgent) continue;
    const isError = /vence hoy|estudia ya|atrasado|vencido/.test(r.detail);
    cands.push({
      title: truncate(`${r.label}: ${r.detail}`),
      body: null,
      severity: isError ? "error" : "warning",
      module: r.href.replace("/", "") || null,
      href: r.href,
    });
  }

  // Insights cruzados en tono rojo (las tensiones más fuertes).
  for (const ins of insights) {
    if (ins.tone !== "var(--red)") continue;
    cands.push({
      title: truncate(`Shadow: ${ins.text}`),
      body: null,
      severity: "warning",
      module: ins.href.replace("/", "") || null,
      href: ins.href,
    });
  }

  if (cands.length === 0) return NextResponse.json({ ok: true, created: 0 });

  // Dedupe: no recrear notis con el mismo título recientes.
  const since = new Date(Date.now() - 18 * 3600000).toISOString();
  const { data: recent } = await supabase
    .from("notifications")
    .select("title")
    .gte("created_at", since);
  const seen = new Set((recent ?? []).map((n) => n.title));

  const fresh = cands.filter((c) => !seen.has(c.title));
  if (fresh.length === 0) return NextResponse.json({ ok: true, created: 0 });

  const { error } = await supabase.from("notifications").insert(
    fresh.map((c) => ({
      title: c.title,
      body: c.body,
      severity: c.severity,
      module: c.module,
      href: c.href,
      read: false,
      dismissed: false,
    }))
  );
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, created: fresh.length });
}
