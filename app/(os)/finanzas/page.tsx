import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { Plus, TrendingUp, TrendingDown, CreditCard, Landmark } from "lucide-react";
import type { FinancialEntry } from "@/lib/supabase/types";

export const revalidate = 0;

const CAT_LABELS: Record<string, string> = {
  flouvia_ingreso: "Flouvia",
  gasto_personal: "Personal",
  gasto_flouvia: "Flouvia ops",
  ahorro: "Ahorro",
  inversion: "Inversión",
};

const CAT_COLORS: Record<string, string> = {
  flouvia_ingreso: "var(--green)",
  gasto_personal: "var(--red)",
  gasto_flouvia: "var(--blue)",
  ahorro: "var(--gold)",
  inversion: "var(--violet)",
};

export default async function FinanzasPage() {
  const supabase = await createClient();
  const monthStart = new Date().toISOString().slice(0, 7) + "-01";

  const [
    { data: banks },
    { data: cards },
    { data: entries },
    { data: capitalGoals },
    { data: investments },
  ] = await Promise.all([
    supabase.from("bank_accounts").select("*").eq("active", true).order("sort_order"),
    supabase.from("credit_cards").select("*").eq("active", true).order("sort_order"),
    supabase.from("financial_entries").select("*").gte("date", monthStart).order("date", { ascending: false }),
    supabase.from("capital_goals").select("*"),
    supabase.from("investments").select("*").eq("active", true),
  ]);

  const totalBanks = (banks ?? []).reduce((a, b) => a + b.current_balance, 0);
  const totalCards = (cards ?? []).reduce((a, c) => a + c.current_balance, 0);
  const totalInvested = (investments ?? []).reduce((a, i) => a + i.current_value, 0);
  const netWorth = totalBanks + totalInvested - totalCards;

  const monthIncome = (entries ?? [])
    .filter((e) => e.category === "flouvia_ingreso")
    .reduce((a, e) => a + e.amount, 0);
  const monthExpenses = (entries ?? [])
    .filter((e) => e.category === "gasto_personal" || e.category === "gasto_flouvia")
    .reduce((a, e) => a + e.amount, 0);

  const byCategory = (entries ?? []).reduce((acc: Record<string, number>, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow mb-2">03 · DINERO</p>
            <h1 className="page-title">Finanzas.</h1>
          </div>
          <div style={{ textAlign: "right", marginTop: 4 }}>
            <p className="tick" style={{ textTransform: "capitalize" }}>
              {new Date().toLocaleDateString("es-MX", { month: "long", year: "numeric" })}
            </p>
            <button className="btn btn-ghost btn-sm mt-2">
              <Plus size={13} /> Registrar
            </button>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Net worth strip */}
        <div className="card mb-6" style={{ borderColor: "var(--gold)", background: "var(--gold-glow)" }}>
          <p className="eyebrow-gold mb-1">Patrimonio neto</p>
          <p style={{ fontFamily: "var(--f-mono)", fontSize: 36, color: "var(--bone)", lineHeight: 1 }}>
            {formatCurrency(netWorth)}
          </p>
          <div className="flex gap-6 mt-3">
            <div>
              <p className="tick">Activos</p>
              <p style={{ color: "var(--green)", fontFamily: "var(--f-mono)", fontSize: 14 }}>
                +{formatCurrency(totalBanks + totalInvested)}
              </p>
            </div>
            <div>
              <p className="tick">Deudas</p>
              <p style={{ color: "var(--red)", fontFamily: "var(--f-mono)", fontSize: 14 }}>
                -{formatCurrency(totalCards)}
              </p>
            </div>
            <div>
              <p className="tick">Inversiones</p>
              <p style={{ color: "var(--violet)", fontFamily: "var(--f-mono)", fontSize: 14 }}>
                {formatCurrency(totalInvested)}
              </p>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 mb-6 md:grid-cols-4">
          {[
            { label: "Saldo en cuentas", val: formatCurrency(totalBanks), color: "var(--bone)" },
            { label: "Ingresos del mes", val: monthIncome > 0 ? formatCurrency(monthIncome) : "—", color: "var(--green)" },
            { label: "Gastos del mes", val: monthExpenses > 0 ? formatCurrency(monthExpenses) : "—", color: "var(--red)" },
            { label: "Deuda en tarjetas", val: totalCards > 0 ? formatCurrency(totalCards) : "$0", color: totalCards > 0 ? "var(--red)" : "var(--green)" },
          ].map((k) => (
            <div key={k.label} className="card">
              <p className="metric-label mb-1">{k.label}</p>
              <p style={{ fontFamily: "var(--f-mono)", fontSize: 20, color: k.color }}>{k.val}</p>
            </div>
          ))}
        </div>

        {/* Bank accounts */}
        {(banks ?? []).length > 0 && (
          <div className="card mb-6">
            <p className="eyebrow mb-4">Cuentas bancarias</p>
            <div className="flex flex-col gap-2">
              {(banks ?? []).map((b) => (
                <div key={b.id} className="tx-row">
                  <div className="tx-icon"><Landmark size={14} style={{ color: "var(--gold)" }} /></div>
                  <div className="flex-1">
                    <p className="tx-desc">{b.name}</p>
                    <p className="tx-date">{b.bank} · {b.type} · {b.currency}</p>
                  </div>
                  <span style={{ fontFamily: "var(--f-mono)", fontSize: 15, color: "var(--bone)" }}>
                    {formatCurrency(b.current_balance)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Credit cards */}
        {(cards ?? []).length > 0 && (
          <div className="card mb-6">
            <p className="eyebrow mb-4">Tarjetas de crédito</p>
            <div className="flex flex-col gap-3">
              {(cards ?? []).map((c) => {
                const used = c.credit_limit ? Math.round((c.current_balance / c.credit_limit) * 100) : 0;
                return (
                  <div key={c.id}>
                    <div className="flex items-center gap-3 mb-1">
                      <div className="tx-icon"><CreditCard size={14} style={{ color: "var(--blue)" }} /></div>
                      <div className="flex-1">
                        <p className="tx-desc">{c.name} {c.last_four && `····${c.last_four}`}</p>
                        <p className="tx-date">{c.bank}</p>
                      </div>
                      <div className="text-right">
                        <p style={{ fontFamily: "var(--f-mono)", fontSize: 14, color: "var(--red)" }}>
                          {formatCurrency(c.current_balance)}
                        </p>
                        {c.credit_limit && (
                          <p className="tick">de {formatCurrency(c.credit_limit)}</p>
                        )}
                      </div>
                    </div>
                    {c.credit_limit && (
                      <div className="progress" style={{ marginLeft: 48 }}>
                        <div
                          className="progress-fill"
                          style={{
                            width: `${used}%`,
                            background: used > 80 ? "var(--red)" : used > 50 ? "var(--gold)" : "var(--green)",
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Capital goals */}
        {(capitalGoals ?? []).length > 0 && (
          <div className="card mb-6">
            <p className="eyebrow mb-4">Metas de capital</p>
            {(capitalGoals ?? []).map((g) => {
              const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));
              return (
                <div key={g.id} className="mb-4">
                  <div className="flex justify-between mb-1">
                    <span style={{ fontSize: 14, color: "var(--bone-dim)", fontWeight: 500 }}>{g.name}</span>
                    <span className="tick" style={{ color: "var(--gold)" }}>{pct}%</span>
                  </div>
                  <div className="progress progress-lg mb-1">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between">
                    <span className="tick">{formatCurrency(g.current_amount)} ahorrado</span>
                    <span className="tick">meta: {formatCurrency(g.target_amount)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Transactions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="eyebrow">Movimientos del mes</p>
            {(entries ?? []).length > 0 && (
              <span className="tick">{(entries ?? []).length} registros</span>
            )}
          </div>
          {(entries ?? []).length === 0 ? (
            <div className="card text-center py-8">
              <p style={{ color: "var(--mute)", fontSize: 14 }}>Sin movimientos este mes</p>
              <button className="btn btn-primary btn-sm mt-4">
                <Plus size={13} /> Registrar primero
              </button>
            </div>
          ) : (
            <div className="tx-list">
              {(entries ?? []).slice(0, 20).map((tx) => {
                const isIncome = tx.category === "flouvia_ingreso";
                return (
                  <div key={tx.id} className="tx-row">
                    <div className="tx-icon">
                      {isIncome
                        ? <TrendingUp size={14} style={{ color: "var(--green)" }} />
                        : <TrendingDown size={14} style={{ color: "var(--red)" }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="tx-desc">{tx.description ?? "Sin descripción"}</p>
                      <p className="tx-date">
                        {CAT_LABELS[tx.category]}
                        {tx.subcategory && ` · ${tx.subcategory}`}
                      </p>
                    </div>
                    <span className="tx-date">{tx.date}</span>
                    <span className={`tx-amount ${isIncome ? "income" : "expense"}`}>
                      {isIncome ? "+" : "-"}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
