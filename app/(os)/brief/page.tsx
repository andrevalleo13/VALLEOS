import { createClient } from "@/lib/supabase/server";
import { greeting, formatCurrency } from "@/lib/utils";
import { ArrowRight, Check, Sparkles } from "lucide-react";
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
    { data: banks },
    { data: briefCache },
  ] = await Promise.all([
    supabase.from("user_preferences").select("*").single(),
    supabase.from("priorities").select("*").eq("date", today).order("created_at"),
    supabase.from("daily_notes").select("focus, reflection").eq("date", today).single(),
    supabase.from("habits").select("id, name, color, icon").eq("active", true).order("sort_order"),
    supabase.from("habit_completions").select("habit_id").eq("date", today),
    supabase.from("financial_entries").select("category, amount").gte("date", today.slice(0, 7) + "-01"),
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

  const habitsDone = doneIds.size;
  const habitsTotal = (habits ?? []).length;
  const habitsPct = habitsTotal > 0 ? Math.round((habitsDone / habitsTotal) * 100) : 0;

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow mb-2">00 · BRIEF</p>
            <h1 style={{ fontFamily: "var(--f-serif)", fontSize: 38, color: "var(--bone)", lineHeight: 1.05 }}>
              {greeting()},{" "}
              <em style={{ color: "var(--gold)", fontStyle: "italic" }}>{displayName}</em>.
            </h1>
          </div>
          <div style={{ textAlign: "right", marginTop: 4 }}>
            <p className="tick" style={{ textTransform: "capitalize" }}>{dateStr}</p>
            {prefs?.vision_primary && (
              <p style={{ color: "var(--mute)", fontFamily: "var(--f-mono)", fontSize: 11, marginTop: 4, maxWidth: 260 }}>
                {prefs.vision_primary}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Two-column body */}
      <div
        className="page-body"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}
      >
        {/* ── Left column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Shadow brief */}
          <div
            className="card"
            style={{ borderColor: "var(--gold)", background: "rgba(201,163,95,0.06)" }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "var(--gold-glow)", border: "1px solid var(--gold)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, marginTop: 2,
                }}
              >
                <Sparkles size={13} style={{ color: "var(--gold)" }} />
              </div>
              <div style={{ flex: 1 }}>
                <p className="eyebrow-gold mb-2">Shadow · Brief del día</p>
                <p style={{ color: "var(--bone-dim)", fontSize: 14, lineHeight: 1.7 }}>
                  {briefCache?.content ??
                    "Shadow está preparando tu resumen del día. Escríbele para activar el análisis."}
                </p>
                <Link href="/shadow" className="btn btn-ghost btn-sm mt-3 inline-flex">
                  Hablar con Shadow <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>

          {/* Intención del día */}
          {dailyNote?.focus && (
            <div className="card">
              <p className="eyebrow mb-2">Intención del día</p>
              <p style={{ fontFamily: "var(--f-serif)", fontSize: 20, color: "var(--bone)", lineHeight: 1.4 }}>
                "{dailyNote.focus}"
              </p>
            </div>
          )}

          {/* Prioridades */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p className="eyebrow">Prioridades</p>
              <span className="tick">{(priorities ?? []).filter((p) => p.completed).length}/{(priorities ?? []).length}</span>
            </div>
            {(priorities ?? []).length === 0 ? (
              <p className="tick">Sin prioridades para hoy</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(priorities ?? []).map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      className={`habit-check ${p.completed ? "done" : ""}`}
                      style={{ flexShrink: 0 }}
                    >
                      {p.completed && <Check size={12} style={{ color: "white" }} />}
                    </div>
                    <span
                      style={{
                        fontSize: 13,
                        color: p.completed ? "var(--mute)" : "var(--bone-dim)",
                        textDecoration: p.completed ? "line-through" : "none",
                        flex: 1,
                      }}
                    >
                      {p.text}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Hábitos */}
          <Link href="/habitos" className="card" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p className="eyebrow">Hábitos · hoy</p>
              <span style={{ fontFamily: "var(--f-mono)", fontSize: 12, color: habitsTotal > 0 && habitsDone === habitsTotal ? "var(--green)" : "var(--mute)" }}>
                {habitsDone}/{habitsTotal}
              </span>
            </div>
            <div className="progress progress-lg mb-3">
              <div
                className="progress-fill green"
                style={{ width: `${habitsPct}%` }}
              />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(habits ?? []).slice(0, 8).map((h) => (
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
          <Link href="/finanzas" className="card" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p className="eyebrow">
                Finanzas · {new Date().toLocaleDateString("es-MX", { month: "long" })}
              </p>
              <ArrowRight size={13} style={{ color: "var(--mute-2)" }} />
            </div>
            <p style={{ fontFamily: "var(--f-mono)", fontSize: 24, color: "var(--bone)", lineHeight: 1 }}>
              {totalBalance > 0 ? formatCurrency(totalBalance) : "—"}
            </p>
            <p className="metric-label mt-1">Saldo total</p>
            <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
              <div>
                <p className="tick">Ingresos</p>
                <p style={{ color: "var(--green)", fontFamily: "var(--f-mono)", fontSize: 13 }}>
                  {monthIncome > 0 ? `+${formatCurrency(monthIncome)}` : "—"}
                </p>
              </div>
              <div>
                <p className="tick">Gastos</p>
                <p style={{ color: "var(--red)", fontFamily: "var(--f-mono)", fontSize: 13 }}>
                  {monthExpenses > 0 ? `-${formatCurrency(monthExpenses)}` : "—"}
                </p>
              </div>
            </div>
          </Link>

          {/* Vision */}
          {prefs?.vision_secondary && (
            <div className="card" style={{ borderColor: "var(--glass-bd-2)" }}>
              <p className="eyebrow-gold mb-3">Visión</p>
              <p
                className="serif"
                style={{ fontSize: 17, color: "var(--bone)", lineHeight: 1.5 }}
              >
                {prefs.vision_primary}
              </p>
              <p style={{ color: "var(--mute)", marginTop: 8, fontSize: 13, fontFamily: "var(--f-sans)" }}>
                {prefs.vision_secondary}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
