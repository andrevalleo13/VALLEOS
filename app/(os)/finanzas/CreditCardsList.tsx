"use client";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import type { CreditCard } from "@/lib/supabase/types";
import { EditCard } from "./EditCard";

function hueFromName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function CreditCardsList({ cards }: { cards: CreditCard[] }) {
  const [editing, setEditing] = useState<CreditCard | null>(null);

  return (
    <div className="card mb-6">
      <p className="eyebrow mb-4">Tarjetas de crédito</p>
      <div className="cc-grid">
        {cards.map((c) => {
          const limit = c.credit_limit ?? 0;
          const credit = c.current_balance < 0 ? -c.current_balance : 0;
          const usedPct = limit > 0 ? (c.current_balance / limit) * 100 : 0;
          const barPct = Math.min(100, Math.max(0, usedPct));
          const over = limit > 0 && c.current_balance > limit ? c.current_balance - limit : 0;
          const barColor = over > 0 || usedPct > 90 ? "var(--red)" : usedPct > 70 ? "var(--gold)" : "var(--green)";
          const h = hueFromName(c.name);
          const grad = `linear-gradient(135deg, hsl(${h} 32% 22%), hsl(${(h + 40) % 360} 38% 11%))`;
          return (
            <button key={c.id} className="cc-card" style={{ background: grad }} onClick={() => setEditing(c)}>
              <div className="cc-top">
                <span className="cc-name">{c.name}</span>
                <span className="cc-chip" />
              </div>
              <div className="cc-number">
                ···· ···· ···· {c.last_four ?? "••••"}
              </div>
              <div className="cc-foot">
                <div>
                  <span className="cc-label">{credit > 0 ? "Saldo a favor" : over > 0 ? "Usado (sobre límite)" : "Usado"}</span>
                  <span className="cc-bal" style={credit > 0 ? { color: "#7FE0A0" } : undefined}>
                    {credit > 0 ? `+${formatCurrency(credit)}` : formatCurrency(c.current_balance)}
                  </span>
                  {limit > 0 && credit === 0 && <span className="cc-limit">de {formatCurrency(limit)}</span>}
                </div>
                <div className="cc-foot-right">
                  {limit > 0 && credit === 0 && <span className="cc-pct" style={{ color: barColor }}>{Math.round(usedPct)}%</span>}
                  {(c.statement_day || c.due_day) && (
                    <span className="cc-dates">
                      {c.statement_day ? `corte ${c.statement_day}` : ""}
                      {c.statement_day && c.due_day ? " · " : ""}
                      {c.due_day ? `paga ${c.due_day}` : ""}
                    </span>
                  )}
                </div>
              </div>
              {limit > 0 && credit === 0 && (
                <div className="cc-bar">
                  <div className="cc-bar-fill" style={{ width: `${barPct}%`, background: barColor }} />
                </div>
              )}
              {over > 0 && <span className="cc-over">Sobrepasado por {formatCurrency(over)}</span>}
              {credit > 0 && <span className="cc-over" style={{ color: "#7FE0A0" }}>Excedente a tu favor · se descuenta de tu próxima compra</span>}
            </button>
          );
        })}
      </div>
      {editing && <EditCard card={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
