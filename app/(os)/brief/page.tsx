import { createClient } from "@/lib/supabase/server";
import { greeting, formatCurrency } from "@/lib/utils";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

export const revalidate = 0;

export default async function BriefPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const [
    { data: prefs },
    { data: priorities },
    { data: dailyNote },
    { data: habits },
    { data: completions },
    { data: entries },
    { data: capitalGoals },
    { data: banks },
    { data: briefCache },
  ] = await Promise.all([
    supabase.from("user_preferences").select("*").single(),
    supabase.from("priorities").select("*").eq("date", today).order("created_at"),
    supabase.from("daily_notes").select("focus, reflection").eq("date", today).single(),
    supabase.from("habits").select("id, name, color, icon").eq("active", true).order("sort_order"),
    supabase.from("habit_completions").select("habit_id").eq("date", today),
    supabase.from("financial_entries").select("category, amount").gte("date", today.slice(0, 7) + "-01"),
    supabase.from("capital_goals").select("*"),
    supabase.from("bank_accounts").select("current_balance, currency").eq("active", true),
    supabase.from("shadow_cache").select("content").eq("key", `brief:${today}`).single(),
  ]);

  const displayName = prefs?.display_name ?? "André";
  const doneIds = new Set((completions ?? []).map((c) => c.habit_id));

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
    <div className="page-body">
      {/* Header */}
      <div className="mb-8">
        <p className="eyebrow mb-2" style={{ textTransform: "capitalize" }}>{dateStr}</p>
        <h1 className="serif" style={{ fontSize: 40, color: "var(--bone)", lineHeight: 1.1 }}>
          {greeting()}, {displayName}.
        </h1>
        {prefs?.vision_primary && (
          <p style={{ color: "var(--gold)", marginTop: 8, fontSize: 14, fontFamily: "var(--f-mono)", letterSpacing: "0.05em" }}>
            {prefs.vision_primary}
          </p>
        )}
        {prefs?.vision_metadata && (
          <p style={{ color: "var(--mute-2)", marginTop: 4, fontSize: 11, fontFamily: "var(--f-mono)", letterSpacing: "0.1em" }}>
            {prefs.vision_metadata}
          </p>
        )}
      </div>

      {/* Shadow brief */}
      <div className="card mb-6" style={{ borderColor: "var(--gold)", background: "var(--gold-glow)" }}>
        <div className="flex items-start gap-4">
          <div className="orb-sm flex-shrink-0 mt-1" />
          <div className="flex-1">
            <p className="eyebrow-gold mb-2">Shadow · Brief del día</p>
            <p style={{ color: "var(--bone-dim)", fontSize: 14, lineHeight: 1.7 }}>
              {briefCache?.content ?? "Shadow está preparando tu resumen del día. Escríbele para activar el análisis."}
            </p>
            <Link href="/shadow" className="btn btn-ghost btn-sm mt-3 inline-flex">
              Hablar con Shadow <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>

      {/* Focus del día */}
      {dailyNote?.focus && (
        <div className="card mb-6">
          <p className="eyebrow mb-2">Intención del día</p>
          <p style={{ fontFamily: "var(--f-serif)", fontSize: 20, color: "var(--bone)" }}>
            {dailyNote.focus}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Prioridades */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="eyebrow">Prioridades de hoy</p>
            <Link href="/brain" className="tick hover:text-[var(--gold)] transition-colors">
              + agregar
            </Link>
          </div>
          {(priorities ?? []).length === 0 ? (
            <p className="tick">Sin prioridades definidas</p>
          ) : (
            <div className="flex flex-col gap-2">
              {(priorities ?? []).map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <div
                    className={`habit-check ${p.completed ? "done" : ""}`}
                    style={{ flexShrink: 0 }}
                  >
                    {p.completed && <Check size={12} style={{ color: "white" }} />}
                  </div>
                  <span
                    style={{
                      fontSize: 14,
                      color: p.completed ? "var(--mute)" : "var(--bone-dim)",
                      textDecoration: p.completed ? "line-through" : "none",
                    }}
                  >
                    {p.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hábitos */}
        <Link href="/habitos" className="card hover:no-underline group">
          <div className="flex items-center justify-between mb-4">
            <p className="eyebrow">Hábitos</p>
            <ArrowRight size={13} style={{ color: "var(--mute-2)" }} className="group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="metric mb-3">
            <span className="metric-value">
              {doneIds.size}
              <span style={{ fontSize: 16, color: "var(--mute)" }}>/{(habits ?? []).length}</span>
            </span>
            <span className="metric-label">Completados hoy</span>
          </div>
          <div className="progress mb-3">
            <div
              className="progress-fill green"
              style={{
                width: habits?.length
                  ? `${(doneIds.size / habits.length) * 100}%`
                  : "0%",
              }}
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {(habits ?? []).slice(0, 6).map((h) => (
              <span
                key={h.id}
                className="tag"
                style={
                  doneIds.has(h.id)
                    ? { borderColor: "var(--green)", color: "var(--green)", background: "rgba(127,169,140,0.15)" }
                    : {}
                }
              >
                {h.name}
              </span>
            ))}
          </div>
        </Link>

        {/* Finanzas */}
        <Link href="/finanzas" className="card hover:no-underline group">
          <div className="flex items-center justify-between mb-4">
            <p className="eyebrow">Finanzas · {new Date().toLocaleDateString("es-MX", { month: "long" })}</p>
            <ArrowRight size={13} style={{ color: "var(--mute-2)" }} className="group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="metric mb-3">
            <span className="metric-value" style={{ fontSize: 22 }}>
              {totalBalance > 0 ? formatCurrency(totalBalance) : "—"}
            </span>
            <span className="metric-label">Saldo total (cuentas)</span>
          </div>
          <div className="flex gap-4">
            <div>
              <p className="tick">Ingresos</p>
              <p style={{ color: "var(--green)", fontFamily: "var(--f-mono)", fontSize: 14 }}>
                {monthIncome > 0 ? `+${formatCurrency(monthIncome)}` : "—"}
              </p>
            </div>
            <div>
              <p className="tick">Gastos</p>
              <p style={{ color: "var(--red)", fontFamily: "var(--f-mono)", fontSize: 14 }}>
                {monthExpenses > 0 ? `-${formatCurrency(monthExpenses)}` : "—"}
              </p>
            </div>
          </div>
        </Link>

        {/* Capital goals */}
        {(capitalGoals ?? []).length > 0 && (
          <div className="card">
            <p className="eyebrow mb-4">Metas de capital</p>
            <div className="flex flex-col gap-4">
              {(capitalGoals ?? []).map((g) => {
                const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));
                return (
                  <div key={g.id}>
                    <div className="flex justify-between mb-1">
                      <span style={{ fontSize: 13, color: "var(--bone-dim)" }}>{g.name}</span>
                      <span className="tick" style={{ color: "var(--gold)" }}>{pct}%</span>
                    </div>
                    <div className="progress">
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="tick">{formatCurrency(g.current_amount)}</span>
                      <span className="tick">meta: {formatCurrency(g.target_amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Vision */}
        {prefs?.vision_secondary && (
          <div className="card" style={{ borderColor: "var(--glass-bd-2)" }}>
            <p className="eyebrow-gold mb-3">Visión</p>
            <p className="serif" style={{ fontSize: 18, color: "var(--bone)", lineHeight: 1.4 }}>
              {prefs.vision_primary}
            </p>
            <p style={{ color: "var(--mute)", marginTop: 8, fontSize: 13 }}>{prefs.vision_secondary}</p>
          </div>
        )}
      </div>
    </div>
  );
}
