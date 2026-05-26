import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { todayISO } from "@/lib/utils";
import type { Database, FinancialCategory } from "@/lib/supabase/types";

const VALID_CATS: FinancialCategory[] = ["flouvia_ingreso", "gasto_personal", "gasto_flouvia", "ahorro", "inversion"];

function sb() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

export async function GET(req: Request) {
  // Vercel Cron manda Authorization: Bearer $CRON_SECRET
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const today = todayISO(); // YYYY-MM-DD en CDMX
  const [y, m, d] = today.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const firstOfMonth = `${y}-${pad(m)}-01`;
  const lastOfMonth = `${y}-${pad(m)}-${pad(lastDay)}`;

  const supabase = sb();
  const { data: charges } = await supabase
    .from("recurring_charges")
    .select("*")
    .eq("active", true);

  // Movimientos ya materializados este mes (dedupe por recurring_id)
  const { data: existing } = await supabase
    .from("financial_entries")
    .select("recurring_id")
    .gte("date", firstOfMonth)
    .lte("date", lastOfMonth)
    .not("recurring_id", "is", null);
  const done = new Set((existing ?? []).map((e) => e.recurring_id));

  const created: string[] = [];

  for (const c of charges ?? []) {
    if (done.has(c.id)) continue;
    const effectiveDay = Math.min(c.charge_day ?? 1, lastDay);
    // catch-up: corre si ya pasó (o es) el día de cargo y aún no se materializó este mes
    if (d < effectiveDay) continue;

    const category: FinancialCategory = VALID_CATS.includes(c.category as FinancialCategory)
      ? (c.category as FinancialCategory)
      : "gasto_personal";

    const { error } = await supabase.from("financial_entries").insert({
      category,
      amount: c.amount,
      description: c.name,
      subcategory: c.subcategory ?? null,
      date: `${y}-${pad(m)}-${pad(effectiveDay)}`,
      card_id: c.card_id ?? null,
      account_id: null,
      payment_method: null,
      recurring_id: c.id,
    });
    if (!error) created.push(c.name);
  }

  return NextResponse.json({ ok: true, date: today, created, count: created.length });
}
