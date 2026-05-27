import { createClient } from "@/lib/supabase/server";
import { greeting, todayISO } from "@/lib/utils";
import { buildBriefRadar } from "@/lib/brief/today";
import { buildDayPlan } from "@/lib/brief/plan";
import { buildCrossInsights } from "@/lib/brief/insights";
import { BriefClient } from "./BriefClient";

export const revalidate = 0;

export default async function BriefPage() {
  const supabase = await createClient();
  const today = todayISO();

  const [
    { data: prefs },
    { data: priorities },
    { data: dailyNote },
    { data: habits },
    { data: completions },
    { data: entries },
    { data: banks },
    { data: briefCache },
    radar,
    plan,
  ] = await Promise.all([
    supabase.from("user_preferences").select("*").single(),
    supabase.from("priorities").select("id, text, completed").eq("date", today).order("created_at"),
    supabase.from("daily_notes").select("focus").eq("date", today).single(),
    supabase.from("habits").select("id, name").eq("active", true).order("sort_order"),
    supabase.from("habit_completions").select("habit_id").eq("date", today),
    supabase.from("financial_entries").select("category, amount").gte("date", today.slice(0, 7) + "-01"),
    supabase.from("bank_accounts").select("current_balance, currency").eq("active", true),
    supabase.from("shadow_cache").select("content").eq("key", `brief:${today}`).single(),
    buildBriefRadar(supabase, today),
    buildDayPlan(supabase, today),
  ]);

  const insights = await buildCrossInsights(supabase, today, plan.items);

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

  return (
    <BriefClient
      today={today}
      greetingText={greeting()}
      dateStr={dateStr}
      displayName={prefs?.display_name ?? "André"}
      visionPrimary={prefs?.vision_primary ?? null}
      visionSecondary={prefs?.vision_secondary ?? null}
      initialBrief={briefCache?.content ?? null}
      initialFocus={dailyNote?.focus ?? null}
      initialPriorities={priorities ?? []}
      habits={habits ?? []}
      initialDoneHabitIds={(completions ?? []).map((c) => c.habit_id)}
      totalBalance={totalBalance}
      monthIncome={monthIncome}
      monthExpenses={monthExpenses}
      radar={radar.items}
      tiempoHoy={radar.tiempoHoy}
      libro={radar.libro}
      plan={plan.items}
      insights={insights}
    />
  );
}
