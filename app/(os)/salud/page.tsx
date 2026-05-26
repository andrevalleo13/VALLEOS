import { createClient } from "@/lib/supabase/server";
import type { HealthEntry, WeightLog } from "@/lib/supabase/types";
import { LogHealth } from "./LogHealth";
import { LogWeight } from "./LogWeight";
import { SaludCharts } from "./SaludCharts";
import { Analysis } from "./Analysis";
import {
  avg, weightStats, sleepDebt, compareWindows, correlate, corrLabel, sleepColor, SLEEP_TARGET,
} from "@/lib/salud/health";

export const revalidate = 0;

function deltaTag(delta: number | null, unit: string, goodUp = true) {
  if (delta == null || delta === 0) return null;
  const up = delta > 0;
  const good = goodUp ? up : !up;
  return (
    <span className="sl-delta" style={{ color: good ? "var(--green)" : "var(--red)" }}>
      {up ? "▲" : "▼"} {Math.abs(delta)}{unit}
    </span>
  );
}

export default async function SaludPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const month = today.slice(0, 7);
  const since30 = new Date(Date.now() - 29 * 86400000).toISOString().split("T")[0];
  const since180 = new Date(Date.now() - 179 * 86400000).toISOString().split("T")[0];

  const [{ data: entriesRaw }, { data: weightsRaw }, { data: cache }] = await Promise.all([
    supabase.from("health_entries").select("*").gte("date", since30).order("date", { ascending: false }),
    supabase.from("weight_logs").select("*").gte("date", since180).order("date", { ascending: true }),
    supabase.from("shadow_cache").select("content, generated_at").eq("key", `salud:${month}`).single(),
  ]);

  const entries = (entriesRaw ?? []) as HealthEntry[];
  const weights = (weightsRaw ?? []) as WeightLog[];
  const latest = entries[0] ?? null;
  const last7 = entries.slice(0, 7);

  const w = weightStats(weights);
  const avgSleep = avg(last7.map((e) => e.sleep_hours));
  const avgMood = avg(last7.map((e) => e.mood));
  const avgEnergy = avg(last7.map((e) => e.energy));
  const avgSteps = avg(last7.map((e) => e.steps));
  const debt = sleepDebt(last7);

  const sleepCmp = compareWindows(entries, "sleep_hours");
  const moodCmp = compareWindows(entries, "mood");
  const energyCmp = compareWindows(entries, "energy");
  const stepsCmp = compareWindows(entries, "steps");

  const corrSleepMood = correlate(entries, "sleep_hours", "mood");
  const corrSleepEnergy = correlate(entries, "sleep_hours", "energy");

  const chronological = [...entries].reverse();
  const days = chronological.slice(-14).map((e) => ({
    date: e.date,
    sleep: e.sleep_hours,
    mood: e.mood,
    energy: e.energy,
    steps: e.steps,
  }));
  const weightPoints = weights.map((l) => ({ date: l.date, weight: l.weight_kg }));

  // Heatmap de sueño: últimos 30 días
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const heatDays: { date: string; sleep: number | null }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
    heatDays.push({ date: d, sleep: byDate.get(d)?.sleep_hours ?? null });
  }

  const empty = entries.length === 0 && weights.length === 0;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow mb-2">10 · BIENESTAR</p>
            <h1 className="page-title">Salud.</h1>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <LogWeight />
            <LogHealth />
          </div>
        </div>
      </div>

      <div className="page-body">
        {empty ? (
          <div className="card text-center py-12">
            <p style={{ color: "var(--mute)", fontSize: 14 }}>Sin datos de salud todavía</p>
            <p className="tick mt-1 mb-4">Registra tu peso y tu día — sueño, ánimo, energía y actividad</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <LogWeight variant="primary" label="Registrar peso" />
              <LogHealth label="Registrar día" />
            </div>
          </div>
        ) : (
          <>
            {/* Peso actual + KPIs */}
            <div className="sl-top">
              <div className="card sl-weight-card">
                <p className="eyebrow mb-2">Peso actual</p>
                {w ? (
                  <>
                    <div className="sl-weight-main">
                      <span className="sl-weight-val">{w.current}</span>
                      <span className="sl-weight-unit">kg</span>
                      {deltaTag(w.delta, "kg", false)}
                    </div>
                    <p className="tick mb-3">
                      {new Date(w.currentDate + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "long" })}
                      {w.count > 1 && w.perWeek !== 0 ? ` · ${w.perWeek > 0 ? "+" : ""}${w.perWeek} kg/sem` : ""}
                    </p>
                    <div className="sl-weight-sub">
                      <div><span className="sl-sub-val">{w.bodyFat ?? "—"}{w.bodyFat ? "%" : ""}</span><span className="tick">grasa</span></div>
                      <div><span className="sl-sub-val">{w.muscle ?? "—"}{w.muscle ? "kg" : ""}</span><span className="tick">músculo</span></div>
                      <div><span className="sl-sub-val">{w.min}–{w.max}</span><span className="tick">rango</span></div>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: "12px 0" }}>
                    <p style={{ color: "var(--mute)", fontSize: 13 }} className="mb-3">Aún no registras tu peso.</p>
                    <LogWeight variant="primary" label="Registrar peso" />
                  </div>
                )}
              </div>

              <div className="sl-kpis">
                <div className="card sl-kpi">
                  <p className="sl-kpi-val" style={{ color: "var(--violet)" }}>{avgSleep ?? "—"}<span>h</span></p>
                  <p className="metric-label">Sueño (7d) {deltaTag(sleepCmp.delta, "h")}</p>
                </div>
                <div className="card sl-kpi">
                  <p className="sl-kpi-val" style={{ color: "var(--gold)" }}>{avgMood ?? "—"}<span>/5</span></p>
                  <p className="metric-label">Ánimo (7d) {deltaTag(moodCmp.delta, "")}</p>
                </div>
                <div className="card sl-kpi">
                  <p className="sl-kpi-val" style={{ color: "var(--green)" }}>{avgEnergy ?? "—"}<span>/5</span></p>
                  <p className="metric-label">Energía (7d) {deltaTag(energyCmp.delta, "")}</p>
                </div>
                <div className="card sl-kpi">
                  <p className="sl-kpi-val" style={{ color: "var(--blue)" }}>{avgSteps ? Math.round(avgSteps).toLocaleString("es-MX") : "—"}</p>
                  <p className="metric-label">Pasos (7d) {deltaTag(stepsCmp.delta, "")}</p>
                </div>
              </div>
            </div>

            <Analysis initial={cache?.content ?? null} generatedAt={cache?.generated_at ?? null} />

            <SaludCharts weight={weightPoints} days={days} />

            {/* Patrones / correlaciones */}
            <div className="card sl-patterns mb-6">
              <p className="eyebrow mb-3">Tus patrones</p>
              <div className="sl-pattern-grid">
                <div>
                  <p className="sl-pattern-lbl">Sueño → ánimo</p>
                  <p className="sl-pattern-val">{corrLabel(corrSleepMood)}</p>
                </div>
                <div>
                  <p className="sl-pattern-lbl">Sueño → energía</p>
                  <p className="sl-pattern-val">{corrLabel(corrSleepEnergy)}</p>
                </div>
                <div>
                  <p className="sl-pattern-lbl">Deuda de sueño (7d)</p>
                  <p className="sl-pattern-val" style={{ color: debt > 3 ? "var(--red)" : debt > 0 ? "var(--gold)" : "var(--green)" }}>
                    {debt > 0 ? `−${debt}h vs objetivo` : debt < 0 ? `+${Math.abs(debt)}h sobre objetivo` : "al día"}
                  </p>
                </div>
              </div>
            </div>

            {/* Heatmap de sueño 30d */}
            <div className="card mb-6">
              <p className="eyebrow mb-3">Sueño — últimos 30 días</p>
              <div className="sl-heat">
                {heatDays.map((d) => (
                  <div
                    key={d.date}
                    className="sl-heat-cell"
                    style={{ background: d.sleep != null ? sleepColor(d.sleep) : "var(--bg-raised)", opacity: d.sleep != null ? 1 : 0.4 }}
                    title={d.sleep != null ? `${d.sleep}h · ${d.date}` : `sin dato · ${d.date}`}
                  />
                ))}
              </div>
              <p className="tick mt-2">Objetivo: {SLEEP_TARGET}h por noche</p>
            </div>

            {/* Historial */}
            {entries.length > 0 && (
              <div className="card">
                <p className="eyebrow mb-4">Historial</p>
                <div className="flex flex-col gap-1">
                  {entries.map((e) => (
                    <div key={e.id} className="tx-row">
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, color: "var(--bone-dim)" }}>
                          {new Date(e.date + "T12:00:00").toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })}
                        </p>
                      </div>
                      {e.sleep_hours != null && <span className="tag" style={{ fontSize: 10, color: sleepColor(e.sleep_hours), borderColor: sleepColor(e.sleep_hours) }}>😴 {e.sleep_hours}h</span>}
                      {e.mood != null && <span className="tag" style={{ fontSize: 10 }}>🙂 {e.mood}/5</span>}
                      {e.energy != null && <span className="tag" style={{ fontSize: 10 }}>⚡ {e.energy}/5</span>}
                      {e.steps != null && <span className="tag" style={{ fontSize: 10 }}>👟 {e.steps.toLocaleString("es-MX")}</span>}
                      {e.workout_minutes != null && <span className="tag" style={{ fontSize: 10, borderColor: "var(--green)", color: "var(--green)" }}>💪 {e.workout_minutes}min</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
