"use client";
import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, CreditCard, Search, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { bucketLabel, bucketColor, entryBucket } from "@/lib/finance/categories";
import type { FinancialEntry } from "@/lib/supabase/types";
import { AddEntry } from "./AddEntry";
import { EditEntry } from "./EditEntry";

type AccountOpt = { id: string; name: string; balance: number };
type CardOpt = { id: string; name: string; currentBalance: number; statementBalance: number | null };
type Tipo = "todos" | "ingreso" | "gasto" | "pago" | "ahorro_inv";

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const TIPO_OPTS: { v: Tipo; l: string }[] = [
  { v: "todos", l: "Todos" },
  { v: "ingreso", l: "Ingresos" },
  { v: "gasto", l: "Gastos" },
  { v: "pago", l: "Pagos de tarjeta" },
  { v: "ahorro_inv", l: "Ahorro e inversión" },
];

function matchesTipo(cat: FinancialEntry["category"], tipo: Tipo) {
  if (tipo === "todos") return true;
  if (tipo === "ingreso") return cat === "flouvia_ingreso";
  if (tipo === "gasto") return cat === "gasto_personal" || cat === "gasto_flouvia";
  if (tipo === "pago") return cat === "pago_tarjeta";
  if (tipo === "ahorro_inv") return cat === "ahorro" || cat === "inversion";
  return true;
}

export function Transactions({
  entries,
  accounts,
  cards,
}: {
  entries: FinancialEntry[];
  accounts: AccountOpt[];
  cards: CardOpt[];
}) {
  const [editing, setEditing] = useState<FinancialEntry | null>(null);
  const [query, setQuery] = useState("");
  const [tipo, setTipo] = useState<Tipo>("todos");
  const nowMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(nowMonth);

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) set.add(e.date.slice(0, 7));
    set.add(nowMonth);
    return [...set].sort().reverse();
  }, [entries, nowMonth]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (month !== "all" && e.date.slice(0, 7) !== month) return false;
      if (!matchesTipo(e.category, tipo)) return false;
      if (q) {
        const hay = `${e.description ?? ""} ${bucketLabel(entryBucket(e.category, e.subcategory))} ${e.payment_method ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, query, tipo, month]);

  const monthLabel = (m: string) => {
    if (m === "all") return "Todo";
    const [y, mo] = m.split("-");
    return `${MONTHS_ES[parseInt(mo, 10) - 1]} ${y}`;
  };

  const total = filtered.reduce((a, e) => {
    if (e.category === "flouvia_ingreso") return a + e.amount;
    return a - e.amount;
  }, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="eyebrow">Movimientos</p>
        {filtered.length > 0 && (
          <span className="tick" style={{ color: total >= 0 ? "var(--green)" : "var(--red)" }}>
            {filtered.length} · {total >= 0 ? "+" : "−"}{formatCurrency(Math.abs(total))}
          </span>
        )}
      </div>

      <div className="fin-filters">
        <div className="fin-search">
          <Search size={13} style={{ color: "var(--mute)", flexShrink: 0 }} />
          <input
            className="fin-search-input"
            placeholder="Buscar movimiento…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select className="input fin-filter-sel" value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
          {TIPO_OPTS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
        <select className="input fin-filter-sel" value={month} onChange={(e) => setMonth(e.target.value)}>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          <option value="all">Todo</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Receipt}
            title={query || tipo !== "todos" ? "Sin resultados" : "Sin movimientos"}
            hint={query || tipo !== "todos" ? "Prueba con otro filtro o búsqueda." : "Registra tu primer ingreso o gasto."}
          >
            {!query && tipo === "todos" && <AddEntry variant="primary" label="Registrar primero" accounts={accounts} cards={cards} />}
          </EmptyState>
        </div>
      ) : (
        <div className="tx-list">
          {filtered.slice(0, 60).map((tx) => {
            const isIncome = tx.category === "flouvia_ingreso";
            const isPago = tx.category === "pago_tarjeta";
            const bucket = entryBucket(tx.category, tx.subcategory);
            return (
              <button key={tx.id} className="tx-row" style={{ width: "100%", textAlign: "left", cursor: "pointer" }} onClick={() => setEditing(tx)}>
                <div className="tx-icon">
                  {isIncome
                    ? <TrendingUp size={14} style={{ color: "var(--green)" }} />
                    : isPago
                      ? <CreditCard size={14} style={{ color: bucketColor("pago") }} />
                      : <TrendingDown size={14} style={{ color: bucketColor(bucket) }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="tx-desc">{tx.description ?? "Sin descripción"}</p>
                  <p className="tx-date">
                    {bucketLabel(bucket)}
                    {tx.payment_method && ` · ${tx.payment_method}`}
                  </p>
                </div>
                <span className="tx-date">{tx.date.slice(5)}</span>
                <span className={`tx-amount ${isIncome ? "income" : "expense"}`}>
                  {isIncome ? "+" : "-"}{formatCurrency(tx.amount)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {editing && <EditEntry entry={editing} accounts={accounts} cards={cards} onClose={() => setEditing(null)} />}
    </div>
  );
}
