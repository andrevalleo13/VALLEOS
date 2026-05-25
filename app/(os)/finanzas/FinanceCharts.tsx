"use client";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

export type DistSlice = { key: string; label: string; color: string; amount: number };
export type TrendBar = { label: string; income: number; expense: number };

const TAU = Math.PI * 2;

export function FinanceCharts({ distribution, trend }: { distribution: DistSlice[]; trend: TrendBar[] }) {
  const total = distribution.reduce((a, d) => a + d.amount, 0);
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className="fin-charts">
      <DonutCard distribution={distribution} total={total} active={active} setActive={setActive} />
      <TrendCard trend={trend} />
    </div>
  );
}

function DonutCard({
  distribution, total, active, setActive,
}: {
  distribution: DistSlice[]; total: number;
  active: string | null; setActive: (k: string | null) => void;
}) {
  const r = 52;
  const stroke = 18;
  const cx = 70, cy = 70;
  const C = TAU * r;

  let offset = 0;
  const segments = distribution.map((d) => {
    const frac = total > 0 ? d.amount / total : 0;
    const seg = {
      ...d,
      frac,
      dash: frac * C,
      gap: C - frac * C,
      rot: (offset / (total || 1)) * 360 - 90,
    };
    offset += d.amount;
    return seg;
  });

  const focused = active ? distribution.find((d) => d.key === active) : null;
  const centerVal = focused ? focused.amount : total;
  const centerLbl = focused ? focused.label : "Gasto del mes";

  return (
    <div className="card fin-donut-card">
      <p className="eyebrow mb-4">Distribución del gasto</p>
      {total === 0 ? (
        <p style={{ color: "var(--mute)", fontSize: 13, padding: "24px 0", textAlign: "center" }}>
          Sin gastos registrados este mes
        </p>
      ) : (
        <div className="fin-donut-wrap">
          <svg width="140" height="140" viewBox="0 0 140 140" className="fin-donut">
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} opacity={0.4} />
            {segments.map((s) => (
              <circle
                key={s.key}
                cx={cx} cy={cy} r={r} fill="none"
                stroke={s.color}
                strokeWidth={active && active !== s.key ? stroke - 6 : stroke}
                strokeDasharray={`${s.dash} ${s.gap}`}
                strokeDashoffset={0}
                transform={`rotate(${s.rot} ${cx} ${cy})`}
                opacity={active && active !== s.key ? 0.35 : 1}
                style={{ transition: "stroke-width .15s, opacity .15s, stroke-dasharray .4s" }}
                onMouseEnter={() => setActive(s.key)}
                onMouseLeave={() => setActive(null)}
              />
            ))}
            <text x={cx} y={cy - 4} textAnchor="middle" className="fin-donut-val">
              {formatCurrency(centerVal)}
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" className="fin-donut-lbl">
              {focused ? `${Math.round((focused.amount / total) * 100)}%` : "total"}
            </text>
          </svg>
          <div className="fin-legend">
            {distribution.map((d) => (
              <div
                key={d.key}
                className={`fin-legend-row${active === d.key ? " on" : ""}`}
                onMouseEnter={() => setActive(d.key)}
                onMouseLeave={() => setActive(null)}
              >
                <span className="fin-dot" style={{ background: d.color }} />
                <span className="fin-legend-label">{d.label}</span>
                <span className="fin-legend-pct">{Math.round((d.amount / total) * 100)}%</span>
                <span className="fin-legend-amt">{formatCurrency(d.amount)}</span>
              </div>
            ))}
          </div>
          <p className="fin-donut-center-lbl">{centerLbl}</p>
        </div>
      )}
    </div>
  );
}

function TrendCard({ trend }: { trend: TrendBar[] }) {
  const max = Math.max(1, ...trend.map((t) => Math.max(t.income, t.expense)));
  return (
    <div className="card fin-trend-card">
      <div className="flex items-center justify-between mb-4">
        <p className="eyebrow">Ingresos vs gastos</p>
        <div className="fin-trend-legend">
          <span><span className="fin-dot" style={{ background: "var(--green)" }} /> ingreso</span>
          <span><span className="fin-dot" style={{ background: "var(--red)" }} /> gasto</span>
        </div>
      </div>
      <div className="fin-bars">
        {trend.map((t) => (
          <div key={t.label} className="fin-bar-col">
            <div className="fin-bar-stack" title={`Ingreso ${formatCurrency(t.income)} · Gasto ${formatCurrency(t.expense)}`}>
              <div className="fin-bar fin-bar-income" style={{ height: `${(t.income / max) * 100}%` }} />
              <div className="fin-bar fin-bar-expense" style={{ height: `${(t.expense / max) * 100}%` }} />
            </div>
            <span className="fin-bar-label">{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
