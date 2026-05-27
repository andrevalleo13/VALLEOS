import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { CreditCard, Repeat, CalendarClock } from "lucide-react";
import { AddEntry } from "./AddEntry";
import { AddAccount } from "./AddAccount";
import { AddCard } from "./AddCard";
import { FinanceCharts, type DistSlice, type TrendBar } from "./FinanceCharts";
import { Analysis } from "./Analysis";
import { CreditCardsList } from "./CreditCardsList";
import { AccountsList } from "./AccountsList";
import { Transactions } from "./Transactions";
import { Budgets } from "./Budgets";
import { BUCKETS, bucketLabel, bucketColor, entryBucket } from "@/lib/finance/categories";
import { buildUpcomingPayments } from "@/lib/finance/payments";

export const revalidate = 0;

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export default async function FinanzasPage() {
  const supabase = await createClient();
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const monthStart = month + "-01";
  const sixAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10);

  const [
    { data: banks },
    { data: cards },
    { data: entries6 },
    { data: capitalGoals },
    { data: investments },
    { data: recurring },
    { data: budgets },
    { data: cache },
  ] = await Promise.all([
    supabase.from("bank_accounts").select("*").eq("active", true).order("sort_order"),
    supabase.from("credit_cards").select("*").eq("active", true).order("sort_order"),
    supabase.from("financial_entries").select("*").gte("date", sixAgo).order("date", { ascending: false }),
    supabase.from("capital_goals").select("*"),
    supabase.from("investments").select("*").eq("active", true),
    supabase.from("recurring_charges").select("*").eq("active", true),
    supabase.from("budgets").select("*").eq("active", true),
    supabase.from("shadow_cache").select("content, generated_at").eq("key", `finanzas:${month}`).single(),
  ]);

  const all = entries6 ?? [];
  const entries = all.filter((e) => e.date >= monthStart);

  const totalBanks = (banks ?? []).reduce((a, b) => a + b.current_balance, 0);
  const totalCards = (cards ?? []).reduce((a, c) => a + c.current_balance, 0);
  const totalInvested = (investments ?? []).reduce((a, i) => a + i.current_value, 0);
  const netWorth = totalBanks + totalInvested - totalCards;

  const monthIncome = entries.filter((e) => e.category === "flouvia_ingreso").reduce((a, e) => a + e.amount, 0);
  const monthExpenses = entries
    .filter((e) => e.category === "gasto_personal" || e.category === "gasto_flouvia")
    .reduce((a, e) => a + e.amount, 0);

  // Distribución del gasto (mes actual) por bucket
  const distMap = new Map<string, number>();
  for (const e of entries) {
    if (e.category === "flouvia_ingreso" || e.category === "pago_tarjeta") continue;
    const b = entryBucket(e.category, e.subcategory);
    distMap.set(b, (distMap.get(b) ?? 0) + e.amount);
  }
  const distOrder: string[] = BUCKETS.map((b) => b.key);
  const distribution: DistSlice[] = [...distMap.entries()]
    .map(([key, amount]) => ({ key, label: bucketLabel(key), color: bucketColor(key), amount }))
    .sort((a, b) => distOrder.indexOf(a.key) - distOrder.indexOf(b.key))
    .sort((a, b) => b.amount - a.amount);

  // Tendencia 6 meses
  const trend: TrendBar[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    const mEntries = all.filter((e) => e.date.slice(0, 7) === key);
    trend.push({
      label: MONTHS_ES[d.getMonth()],
      income: mEntries.filter((e) => e.category === "flouvia_ingreso").reduce((a, e) => a + e.amount, 0),
      expense: mEntries.filter((e) => e.category === "gasto_personal" || e.category === "gasto_flouvia").reduce((a, e) => a + e.amount, 0),
    });
  }

  const payments = buildUpcomingPayments(cards ?? [], recurring ?? [], now).slice(0, 6);
  const accountOpts = (banks ?? []).map((b) => ({ id: b.id, name: b.name, balance: b.current_balance }));
  const cardOpts = (cards ?? []).map((c) => ({
    id: c.id,
    name: c.name + (c.last_four ? ` ····${c.last_four}` : ""),
    currentBalance: c.current_balance,
    statementBalance: c.statement_balance,
  }));

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow mb-2">03 · DINERO</p>
            <h1 className="page-title">Finanzas.</h1>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
            <AddAccount sortOrder={(banks ?? []).length} />
            <AddCard sortOrder={(cards ?? []).length} />
            <AddEntry variant="primary" accounts={accountOpts} cards={cardOpts} />
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
            { label: "Balance del mes", val: formatCurrency(monthIncome - monthExpenses), color: monthIncome - monthExpenses >= 0 ? "var(--green)" : "var(--red)" },
          ].map((k) => (
            <div key={k.label} className="card">
              <p className="metric-label mb-1">{k.label}</p>
              <p style={{ fontFamily: "var(--f-mono)", fontSize: 20, color: k.color }}>{k.val}</p>
            </div>
          ))}
        </div>

        {/* Análisis de Shadow */}
        <Analysis initial={cache?.content ?? null} generatedAt={cache?.generated_at ?? null} />

        {/* Gráficas */}
        <FinanceCharts distribution={distribution} trend={trend} />

        {/* Próximos pagos */}
        {payments.length > 0 && (
          <div className="card mb-6">
            <p className="eyebrow mb-4" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <CalendarClock size={12} style={{ color: "var(--gold)" }} /> Próximos pagos
            </p>
            <div className="flex flex-col gap-2">
              {payments.map((p) => {
                const urgent = p.daysUntil <= 3;
                return (
                  <div key={`${p.kind}-${p.id}`} className="fin-pay-row">
                    <div className="tx-icon">
                      {p.kind === "card"
                        ? <CreditCard size={14} style={{ color: "var(--blue)" }} />
                        : <Repeat size={14} style={{ color: "var(--violet)" }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="tx-desc">{p.name}</p>
                      <p className="tx-date">{p.detail ?? (p.kind === "card" ? "tarjeta" : "cargo recurrente")}</p>
                    </div>
                    <span className={`fin-pay-when${urgent ? " urgent" : ""}`}>
                      {p.daysUntil === 0 ? "hoy" : p.daysUntil === 1 ? "mañana" : `en ${p.daysUntil}d`}
                      <span className="tick" style={{ display: "block" }}>{p.dueDate.slice(5)}</span>
                    </span>
                    <span style={{ fontFamily: "var(--f-mono)", fontSize: 14, color: "var(--bone)", minWidth: 90, textAlign: "right" }}>
                      {p.amount ? formatCurrency(p.amount) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Presupuestos */}
        <Budgets budgets={budgets ?? []} spent={Object.fromEntries(distMap)} />

        {/* Bank accounts */}
        {(banks ?? []).length > 0 && <AccountsList accounts={banks ?? []} />}

        {/* Credit cards */}
        {(cards ?? []).length > 0 && <CreditCardsList cards={cards ?? []} />}

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
        <Transactions entries={all} accounts={accountOpts} cards={cardOpts} />
      </div>
    </div>
  );
}
