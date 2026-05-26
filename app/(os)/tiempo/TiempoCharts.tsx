"use client";
import { useState } from "react";
import { fmtHours } from "@/lib/tiempo/categories";

export type CatSlice = { key: string; label: string; color: string; minutes: number };
export type WeekBar = { label: string; minutes: number };
export type ClientSlice = { name: string; color: string; minutes: number };

const TAU = Math.PI * 2;

// ── Heatmap de actividad (estilo GitHub, 13 semanas) ───────────────────────
export function ActivityHeatmap({ daily, maxDaily }: { daily: Record<string, number>; maxDaily: number }) {
  const WEEKS = 13;
  const today = new Date();
  // alinear al lunes de la semana actual
  const end = new Date(today);
  const dow = (end.getDay() + 6) % 7; // 0 = lunes
  const monday = new Date(end);
  monday.setDate(end.getDate() - dow);
  const start = new Date(monday);
  start.setDate(monday.getDate() - (WEEKS - 1) * 7);

  const todayKey = dayKey(today);
  const weeks: { key: string; mins: number; future: boolean; isToday: boolean }[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const col: { key: string; mins: number; future: boolean; isToday: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(start);
      cur.setDate(start.getDate() + w * 7 + d);
      const key = dayKey(cur);
      col.push({ key, mins: daily[key] ?? 0, future: key > todayKey, isToday: key === todayKey });
    }
    weeks.push(col);
  }

  function level(mins: number): number {
    if (mins <= 0) return 0;
    if (maxDaily <= 0) return 1;
    const r = mins / maxDaily;
    if (r > 0.75) return 4;
    if (r > 0.5) return 3;
    if (r > 0.25) return 2;
    return 1;
  }

  const monthLabel = (i: number) => {
    if (i === 0 || i === 4 || i === 8 || i === 12) {
      const d = new Date(start);
      d.setDate(start.getDate() + i * 7);
      return d.toLocaleDateString("es-MX", { month: "short" });
    }
    return "";
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <p className="eyebrow">Actividad · 13 semanas</p>
        <div className="tm-hm-key">
          <span className="tick">menos</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className="tm-hm-cell" data-lvl={l} />
          ))}
          <span className="tick">más</span>
        </div>
      </div>
      <div className="tm-hm-scroll">
        <div className="tm-hm-grid">
          {weeks.map((col, i) => (
            <div key={i} className="tm-hm-col">
              <span className="tm-hm-month">{monthLabel(i)}</span>
              {col.map((cell) => (
                <span
                  key={cell.key}
                  className={`tm-hm-cell${cell.future ? " future" : ""}${cell.isToday ? " today" : ""}`}
                  data-lvl={cell.future ? -1 : level(cell.mins)}
                  title={`${cell.key} · ${fmtHours(cell.mins)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Gráfica semanal de horas ────────────────────────────────────────────────
export function WeeklyHours({ weeks }: { weeks: WeekBar[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.minutes));
  return (
    <div className="card">
      <p className="eyebrow mb-4">Horas por semana</p>
      <div className="tm-week-bars">
        {weeks.map((w, i) => {
          const last = i === weeks.length - 1;
          return (
            <div key={w.label} className="tm-week-col">
              <span className="tm-week-val">{w.minutes > 0 ? fmtHours(w.minutes) : ""}</span>
              <div className="tm-week-track">
                <div
                  className={`tm-week-fill${last ? " current" : ""}`}
                  style={{ height: `${(w.minutes / max) * 100}%` }}
                />
              </div>
              <span className="tm-week-label">{w.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Donut por categoría ───────────────────────────────────────────────────
export function CategoryDonut({ slices }: { slices: CatSlice[] }) {
  const total = slices.reduce((a, s) => a + s.minutes, 0);
  const [active, setActive] = useState<string | null>(null);
  const r = 52, stroke = 18, cx = 70, cy = 70, C = TAU * r;

  let offset = 0;
  const segments = slices.map((s) => {
    const frac = total > 0 ? s.minutes / total : 0;
    const seg = { ...s, dash: frac * C, gap: C - frac * C, rot: (offset / (total || 1)) * 360 - 90 };
    offset += s.minutes;
    return seg;
  });

  const focused = active ? slices.find((s) => s.key === active) : null;
  const centerVal = focused ? focused.minutes : total;

  return (
    <div className="card">
      <p className="eyebrow mb-4">Distribución por categoría</p>
      {total === 0 ? (
        <p style={{ color: "var(--mute)", fontSize: 13, padding: "24px 0", textAlign: "center" }}>
          Sin sesiones registradas
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
                transform={`rotate(${s.rot} ${cx} ${cy})`}
                opacity={active && active !== s.key ? 0.35 : 1}
                style={{ transition: "stroke-width .15s, opacity .15s, stroke-dasharray .4s" }}
                onMouseEnter={() => setActive(s.key)}
                onMouseLeave={() => setActive(null)}
              />
            ))}
            <text x={cx} y={cy - 2} textAnchor="middle" className="fin-donut-val">{fmtHours(centerVal)}</text>
            <text x={cx} y={cy + 14} textAnchor="middle" className="fin-donut-lbl">
              {focused ? `${Math.round((focused.minutes / total) * 100)}%` : "total"}
            </text>
          </svg>
          <div className="fin-legend">
            {slices.map((s) => (
              <div
                key={s.key}
                className={`fin-legend-row${active === s.key ? " on" : ""}`}
                onMouseEnter={() => setActive(s.key)}
                onMouseLeave={() => setActive(null)}
              >
                <span className="fin-dot" style={{ background: s.color }} />
                <span className="fin-legend-label">{s.label}</span>
                <span className="fin-legend-pct">{Math.round((s.minutes / total) * 100)}%</span>
                <span className="fin-legend-amt">{fmtHours(s.minutes)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tiempo por cliente de Flouvia ───────────────────────────────────────────
export function ClientHours({ clients }: { clients: ClientSlice[] }) {
  const max = Math.max(1, ...clients.map((c) => c.minutes));
  return (
    <div className="card">
      <p className="eyebrow mb-4">Tiempo por cliente · Flouvia</p>
      {clients.length === 0 ? (
        <p style={{ color: "var(--mute)", fontSize: 13, padding: "24px 0", textAlign: "center" }}>
          Aún no hay sesiones ligadas a un cliente
        </p>
      ) : (
        <div className="tm-client-bars">
          {clients.map((c) => (
            <div key={c.name} className="tm-client-row">
              <span className="tm-client-label">{c.name}</span>
              <div className="tm-client-track">
                <div className="tm-client-fill" style={{ width: `${(c.minutes / max) * 100}%`, background: c.color }} />
              </div>
              <span className="tm-client-val">{fmtHours(c.minutes)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Ritmo del día (minutos por hora, últimos 30d) ──────────────────────────
export function DayRhythm({ hourly }: { hourly: number[] }) {
  const max = Math.max(1, ...hourly);
  const peak = hourly.indexOf(Math.max(...hourly));
  const total = hourly.reduce((a, b) => a + b, 0);
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <p className="eyebrow">Ritmo del día</p>
        {total > 0 && <span className="tick">pico ~{String(peak).padStart(2, "0")}:00</span>}
      </div>
      {total === 0 ? (
        <p style={{ color: "var(--mute)", fontSize: 13, padding: "24px 0", textAlign: "center" }}>
          Sin datos de horario
        </p>
      ) : (
        <div className="tm-rhythm">
          {hourly.map((m, h) => (
            <div
              key={h}
              className={`tm-rhythm-bar${h === peak ? " peak" : ""}`}
              style={{ height: `${Math.max(m > 0 ? 6 : 0, (m / max) * 100)}%` }}
              title={`${String(h).padStart(2, "0")}:00 · ${fmtHours(m)}`}
            />
          ))}
        </div>
      )}
      <div className="tm-rhythm-axis">
        <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
      </div>
    </div>
  );
}

function dayKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}
