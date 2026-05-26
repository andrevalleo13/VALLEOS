import { createClient } from "@/lib/supabase/server";
import { catColor, clientColor, fmtHours } from "@/lib/tiempo/categories";
import { ActivityHeatmap, WeeklyHours, CategoryDonut, ClientHours, DayRhythm } from "./TiempoCharts";
import type { CatSlice, WeekBar, ClientSlice } from "./TiempoCharts";
import { LogTime } from "./LogTime";
import { Patrones, type Pattern } from "./Patrones";
import { EmptyState } from "@/components/EmptyState";
import { Clock } from "lucide-react";

export const revalidate = 0;

const TZ = "America/Mexico_City";
function dayKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}
function mxHour(iso: string): number {
  return parseInt(new Date(iso).toLocaleString("en-US", { timeZone: TZ, hour: "2-digit", hour12: false })) % 24;
}
function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().split("T")[0];
}

export default async function TiempoPage() {
  const supabase = await createClient();
  const now = new Date();
  const todayKey = dayKey(now);

  const since = new Date(now);
  since.setDate(since.getDate() - 100);

  const patronKey = `patrones:${mondayOf(todayKey)}`;
  const [{ data: blocks }, { data: logs }, { data: clients }, { data: patronCache }] = await Promise.all([
    supabase.from("time_blocks").select("*").eq("active", true).order("sort_order"),
    supabase.from("time_logs").select("*").gte("started_at", since.toISOString()).order("started_at", { ascending: false }),
    supabase.from("flouvia_clients").select("id, name"),
    supabase.from("shadow_cache").select("content, generated_at").eq("key", patronKey).maybeSingle(),
  ]);

  let patrones: Pattern[] = [];
  try {
    if (patronCache?.content) patrones = JSON.parse(patronCache.content) as Pattern[];
  } catch {
    patrones = [];
  }

  const allLogs = logs ?? [];
  const clientName = new Map((clients ?? []).map((c) => [c.id, c.name]));

  // ── Mapas base por día ──────────────────────────────────────────────────
  const daily: Record<string, number> = {};
  for (const l of allLogs) {
    const k = dayKey(new Date(l.started_at));
    daily[k] = (daily[k] ?? 0) + (l.duration_minutes ?? 0);
  }
  const maxDaily = Math.max(0, ...Object.values(daily));

  // ── Ventanas ───────────────────────────────────────────────────────────
  const key30 = (() => { const d = new Date(now); d.setDate(d.getDate() - 29); return dayKey(d); })();
  const logs30 = allLogs.filter((l) => dayKey(new Date(l.started_at)) >= key30);

  // ── Semanas (últimas 10) ─────────────────────────────────────────────────
  const thisMonday = mondayOf(todayKey);
  const weekMons: string[] = [];
  {
    const base = new Date(thisMonday + "T12:00:00Z");
    for (let i = 9; i >= 0; i--) {
      const d = new Date(base);
      d.setUTCDate(base.getUTCDate() - i * 7);
      weekMons.push(d.toISOString().split("T")[0]);
    }
  }
  const weekMinutes: Record<string, number> = Object.fromEntries(weekMons.map((m) => [m, 0]));
  for (const l of allLogs) {
    const mk = mondayOf(dayKey(new Date(l.started_at)));
    if (mk in weekMinutes) weekMinutes[mk] += l.duration_minutes ?? 0;
  }
  const weeks: WeekBar[] = weekMons.map((m) => {
    const [, mm, dd] = m.split("-");
    return { label: `${Number(dd)}/${Number(mm)}`, minutes: weekMinutes[m] };
  });

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const todayMinutes = daily[todayKey] ?? 0;
  const thisWeekMin = weekMinutes[thisMonday] ?? 0;
  const prevMonday = weekMons[weekMons.length - 2];
  const prevWeekMin = prevMonday ? weekMinutes[prevMonday] : 0;
  const weekDelta = prevWeekMin > 0 ? Math.round(((thisWeekMin - prevWeekMin) / prevWeekMin) * 100) : null;

  const total30 = logs30.reduce((a, l) => a + (l.duration_minutes ?? 0), 0);
  const avgDaily = total30 / 30;

  let streak = 0;
  {
    const cur = new Date(now);
    if (!(daily[dayKey(cur)] > 0)) cur.setDate(cur.getDate() - 1);
    while (daily[dayKey(cur)] > 0) { streak++; cur.setDate(cur.getDate() - 1); }
  }

  // ── Distribución por categoría (30d) ──────────────────────────────────────
  const catMin: Record<string, number> = {};
  for (const l of logs30) {
    const c = l.category ?? "Otros";
    catMin[c] = (catMin[c] ?? 0) + (l.duration_minutes ?? 0);
  }
  const catSlices: CatSlice[] = Object.entries(catMin)
    .sort((a, b) => b[1] - a[1])
    .map(([key, minutes]) => ({ key, label: key, color: catColor(key), minutes }));

  // ── Tiempo por cliente Flouvia (30d) ──────────────────────────────────────
  const cliMin: Record<string, number> = {};
  for (const l of logs30) {
    if (l.client_id) cliMin[l.client_id] = (cliMin[l.client_id] ?? 0) + (l.duration_minutes ?? 0);
  }
  const clientSlices: ClientSlice[] = Object.entries(cliMin)
    .sort((a, b) => b[1] - a[1])
    .map(([id, minutes], i) => ({ name: clientName.get(id) ?? "Cliente", color: clientColor(i), minutes }));

  // ── Ritmo del día (30d) ───────────────────────────────────────────────────
  const hourly = new Array(24).fill(0);
  for (const l of logs30) hourly[mxHour(l.started_at)] += l.duration_minutes ?? 0;

  const kpis = [
    { label: "Hoy", val: fmtHours(todayMinutes) },
    { label: "Esta semana", val: fmtHours(thisWeekMin), color: "var(--gold)" },
    {
      label: "vs semana previa",
      val: weekDelta === null ? "—" : `${weekDelta >= 0 ? "+" : ""}${weekDelta}%`,
      color: weekDelta === null ? undefined : weekDelta >= 0 ? "var(--green)" : "var(--red)",
    },
    { label: "Promedio/día (30d)", val: fmtHours(avgDaily) },
    { label: "Racha activa", val: streak > 0 ? `${streak}d` : "—" },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow mb-2">13 · TIEMPO</p>
            <h1 className="page-title">Tiempo.</h1>
          </div>
          <LogTime clients={clients ?? []} />
        </div>
      </div>

      <div className="page-body">
        <div className="tm-kpis mb-8">
          {kpis.map((k) => (
            <div key={k.label} className="card text-center">
              <p style={{ fontFamily: "var(--f-mono)", fontSize: 28, color: k.color ?? "var(--bone)" }}>{k.val}</p>
              <p className="metric-label">{k.label}</p>
            </div>
          ))}
        </div>

        <Patrones initial={patrones} generatedAt={patronCache?.generated_at ?? null} />

        <div className="mb-6">
          <ActivityHeatmap daily={daily} maxDaily={maxDaily} />
        </div>

        <div className="tm-grid-2 mb-6">
          <WeeklyHours weeks={weeks} />
          <CategoryDonut slices={catSlices} />
        </div>

        <div className="tm-grid-2 mb-6">
          <ClientHours clients={clientSlices} />
          <DayRhythm hourly={hourly} />
        </div>

        {(blocks ?? []).length > 0 && (
          <div className="card mb-6">
            <p className="eyebrow mb-4">Plantilla del día</p>
            <div className="flex flex-col gap-2">
              {(blocks ?? []).map((b) => (
                <div key={b.id} className="flex items-center gap-4">
                  <span style={{ fontFamily: "var(--f-mono)", fontSize: 12, color: "var(--mute)", width: 44, flexShrink: 0 }}>
                    {b.start_time.slice(0, 5)}
                  </span>
                  <div className="cal-event flex-1" style={{ borderLeftColor: "var(--gold)" }}>
                    <span className="cal-event-title">{b.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <p className="eyebrow mb-4">Sesiones recientes</p>
          {allLogs.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Sin logs registrados"
              hint="Registra una sesión para empezar a ver tus patrones de tiempo."
            >
              <LogTime clients={clients ?? []} label="Registrar sesión" />
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-1">
              {allLogs.slice(0, 20).map((l) => (
                <div key={l.id} className="tx-row">
                  <div className="tx-icon"><span className="tm-dot" style={{ background: catColor(l.category) }} /></div>
                  <div className="flex-1">
                    <p className="tx-desc">{l.label}</p>
                    <p className="tx-date">
                      {l.category}
                      {l.client_id && clientName.get(l.client_id) ? ` · ${clientName.get(l.client_id)}` : ""}
                    </p>
                  </div>
                  <span className="tx-date">{new Date(l.started_at).toLocaleDateString("es-MX", { month: "short", day: "numeric" })}</span>
                  <span style={{ fontFamily: "var(--f-mono)", fontSize: 13, color: "var(--bone-dim)" }}>
                    {l.duration_minutes ? fmtHours(l.duration_minutes) : "En curso"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
