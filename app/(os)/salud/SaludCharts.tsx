"use client";
import { useState } from "react";
import { sleepColor, SLEEP_TARGET } from "@/lib/salud/health";

export type WeightPoint = { date: string; weight: number };
export type DayPoint = { date: string; sleep: number | null; mood: number | null; energy: number | null; steps: number | null };

const WEEK = ["D", "L", "M", "M", "J", "V", "S"];
const dow = (d: string) => WEEK[new Date(d + "T12:00:00").getDay()];
const dm = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });

export function SaludCharts({ weight, days }: { weight: WeightPoint[]; days: DayPoint[] }) {
  return (
    <div className="sl-charts">
      <WeightChart points={weight} />
      <SleepChart days={days} />
      <WellbeingChart days={days} />
    </div>
  );
}

function WeightChart({ points }: { points: WeightPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 320, H = 150, padX = 12, padY = 18;
  if (points.length < 2) {
    return (
      <div className="card sl-chart-card">
        <p className="eyebrow mb-3">Tendencia de peso</p>
        <p className="sl-empty">Registra tu peso al menos dos veces para ver la tendencia.</p>
      </div>
    );
  }
  const ws = points.map((p) => p.weight);
  const min = Math.min(...ws), max = Math.max(...ws);
  const range = max - min || 1;
  const t0 = new Date(points[0].date + "T12:00:00").getTime();
  const t1 = new Date(points[points.length - 1].date + "T12:00:00").getTime();
  const span = t1 - t0 || 1;
  const x = (d: string) => padX + ((new Date(d + "T12:00:00").getTime() - t0) / span) * (W - padX * 2);
  const y = (w: number) => padY + (1 - (w - min) / range) * (H - padY * 2);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.date).toFixed(1)} ${y(p.weight).toFixed(1)}`).join(" ");
  const area = `${path} L ${x(points[points.length - 1].date).toFixed(1)} ${H - padY} L ${x(points[0].date).toFixed(1)} ${H - padY} Z`;

  return (
    <div className="card sl-chart-card">
      <p className="eyebrow mb-3">Tendencia de peso</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="sl-svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#wfill)" />
        <path d={path} fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={p.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <circle cx={x(p.date)} cy={y(p.weight)} r={hover === i ? 4.5 : 3} fill="var(--gold)" stroke="var(--bg)" strokeWidth="1.5" />
            {hover === i && (
              <text x={Math.min(Math.max(x(p.date), 26), W - 26)} y={Math.max(y(p.weight) - 10, 10)} textAnchor="middle" className="sl-svg-tip">
                {p.weight}kg · {dm(p.date)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="sl-axis">
        <span>{min}kg</span>
        <span>{dm(points[0].date)} → {dm(points[points.length - 1].date)}</span>
        <span>{max}kg</span>
      </div>
    </div>
  );
}

function SleepChart({ days }: { days: DayPoint[] }) {
  const data = days.filter((d) => d.sleep != null);
  const maxSleep = Math.max(SLEEP_TARGET + 1, ...data.map((d) => d.sleep ?? 0));
  return (
    <div className="card sl-chart-card">
      <p className="eyebrow mb-3">Sueño — últimos {days.length} días</p>
      {data.length === 0 ? (
        <p className="sl-empty">Sin datos de sueño.</p>
      ) : (
        <>
          <div className="sl-bars">
            {days.map((d) => {
              const h = d.sleep ?? 0;
              const pct = (h / maxSleep) * 100;
              return (
                <div key={d.date} className="sl-bar-col" title={d.sleep != null ? `${d.sleep}h · ${dm(d.date)}` : `sin dato · ${dm(d.date)}`}>
                  <div className="sl-bar" style={{ height: `${Math.max(pct, 3)}%`, background: sleepColor(d.sleep) }} />
                  <span className="sl-bar-lbl">{dow(d.date)}</span>
                </div>
              );
            })}
          </div>
          <div className="sl-legend">
            <span><i style={{ background: "var(--green)" }} /> ≥{SLEEP_TARGET}h</span>
            <span><i style={{ background: "var(--gold)" }} /> 6–{SLEEP_TARGET}h</span>
            <span><i style={{ background: "var(--red)" }} /> &lt;6h</span>
          </div>
        </>
      )}
    </div>
  );
}

function WellbeingChart({ days }: { days: DayPoint[] }) {
  const W = 320, H = 150, padX = 12, padY = 16;
  const hasData = days.some((d) => d.mood != null || d.energy != null);
  const n = days.length;
  const x = (i: number) => padX + (n <= 1 ? 0 : (i / (n - 1)) * (W - padX * 2));
  const y = (v: number) => padY + (1 - (v - 1) / 4) * (H - padY * 2);

  function line(key: "mood" | "energy") {
    const pts = days.map((d, i) => ({ i, v: d[key] })).filter((p): p is { i: number; v: number } => typeof p.v === "number");
    if (pts.length === 0) return null;
    return pts.map((p, j) => `${j === 0 ? "M" : "L"} ${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  }
  const moodPath = line("mood");
  const energyPath = line("energy");

  return (
    <div className="card sl-chart-card">
      <div className="flex items-center justify-between mb-3">
        <p className="eyebrow">Ánimo y energía</p>
        <div className="sl-legend">
          <span><i style={{ background: "var(--gold)" }} /> ánimo</span>
          <span><i style={{ background: "var(--green)" }} /> energía</span>
        </div>
      </div>
      {!hasData ? (
        <p className="sl-empty">Sin datos de ánimo/energía.</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="sl-svg" preserveAspectRatio="none">
          {[1, 2, 3, 4, 5].map((g) => (
            <line key={g} x1={padX} x2={W - padX} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeWidth="1" opacity={0.4} />
          ))}
          {moodPath && <path d={moodPath} fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
          {energyPath && <path d={energyPath} fill="none" stroke="var(--green)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
          {days.map((d, i) => (
            <g key={d.date}>
              {typeof d.mood === "number" && <circle cx={x(i)} cy={y(d.mood)} r="2.5" fill="var(--gold)" />}
              {typeof d.energy === "number" && <circle cx={x(i)} cy={y(d.energy)} r="2.5" fill="var(--green)" />}
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}
