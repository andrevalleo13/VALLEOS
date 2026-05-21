import { createClient } from "@/lib/supabase/server";
import { Plus } from "lucide-react";
import type { HealthEntry } from "@/lib/supabase/types";

export const revalidate = 0;

function avg(vals: (number | null)[]): number | null {
  const v = vals.filter((x) => x !== null) as number[];
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
}

export default async function SaludPage() {
  const supabase = await createClient();

  const { data: entries } = await supabase
    .from("health_entries")
    .select("*")
    .order("date", { ascending: false })
    .limit(14);

  const latest = entries?.[0] ?? null;
  const last7 = (entries ?? []).slice(0, 7);

  const avgSleep = avg(last7.map((e) => e.sleep_hours));
  const avgMood = avg(last7.map((e) => e.mood));
  const avgEnergy = avg(last7.map((e) => e.energy));

  const WEEK = ["D", "L", "M", "M", "J", "V", "S"];
  const maxSleep = Math.max(...last7.map((e) => e.sleep_hours ?? 0), 8);

  return (
    <div>
      <div className="page-header">
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow mb-2">Bienestar</p>
            <h1 className="page-title">Salud</h1>
          </div>
          <button className="btn btn-primary btn-sm"><Plus size={14} /> Registrar hoy</button>
        </div>
      </div>

      <div className="page-body">
        {/* Today snapshot */}
        {latest && (
          <div className="card mb-6" style={{ borderColor: "var(--glass-bd-2)" }}>
            <p className="eyebrow mb-3">Último registro · {latest.date}</p>
            <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
              {[
                { label: "Sueño", val: latest.sleep_hours ? `${latest.sleep_hours}h` : "—", color: "var(--violet)" },
                { label: "Calidad", val: latest.sleep_quality ? `${latest.sleep_quality}/5` : "—", color: "var(--blue)" },
                { label: "Peso", val: latest.weight_kg ? `${latest.weight_kg}kg` : "—", color: "var(--bone)" },
                { label: "Mood", val: latest.mood ? `${latest.mood}/5` : "—", color: "var(--gold)" },
                { label: "Energía", val: latest.energy ? `${latest.energy}/5` : "—", color: "var(--green)" },
                { label: "Ejercicio", val: latest.workout_minutes ? `${latest.workout_minutes}min` : "—", color: "var(--red)" },
              ].map((m) => (
                <div key={m.label} className="card-sm text-center">
                  <p style={{ fontFamily: "var(--f-mono)", fontSize: 20, color: m.color }}>{m.val}</p>
                  <p className="tick">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7-day averages */}
        {last7.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="card text-center">
              <p style={{ fontFamily: "var(--f-mono)", fontSize: 28, color: "var(--violet)" }}>
                {avgSleep ?? "—"}h
              </p>
              <p className="metric-label">Sueño promedio (7d)</p>
            </div>
            <div className="card text-center">
              <p style={{ fontFamily: "var(--f-mono)", fontSize: 28, color: "var(--gold)" }}>
                {avgMood ?? "—"}/5
              </p>
              <p className="metric-label">Mood promedio (7d)</p>
            </div>
            <div className="card text-center">
              <p style={{ fontFamily: "var(--f-mono)", fontSize: 28, color: "var(--green)" }}>
                {avgEnergy ?? "—"}/5
              </p>
              <p className="metric-label">Energía promedio (7d)</p>
            </div>
          </div>
        )}

        {/* Sleep chart */}
        {last7.length > 0 && (
          <div className="card mb-6">
            <p className="eyebrow mb-4">Sueño — últimos 7 días</p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 120 }}>
              {[...last7].reverse().map((e, i) => {
                const h = e.sleep_hours ?? 0;
                const pct = maxSleep > 0 ? (h / maxSleep) * 100 : 0;
                return (
                  <div key={e.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <span className="tick" style={{ fontSize: 10 }}>{h ? `${h}h` : "—"}</span>
                    <div
                      style={{
                        width: "100%",
                        height: `${Math.max(pct, 5)}px`,
                        background: h >= 7.5 ? "var(--green)" : h >= 6 ? "var(--gold)" : "var(--red)",
                        borderRadius: "4px 4px 0 0",
                        minHeight: 8,
                      }}
                    />
                    <span className="tick" style={{ fontSize: 9 }}>
                      {WEEK[new Date(e.date + "T12:00:00").getDay()]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* History */}
        {(entries ?? []).length === 0 ? (
          <div className="card text-center py-12">
            <p style={{ color: "var(--mute)", fontSize: 14 }}>Sin registros de salud</p>
            <p className="tick mt-1">Registra tu sueño, peso y energía diariamente</p>
            <button className="btn btn-primary btn-sm mt-4"><Plus size={13} /> Primer registro</button>
          </div>
        ) : (
          <div className="card">
            <p className="eyebrow mb-4">Historial</p>
            <div className="flex flex-col gap-1">
              {(entries ?? []).map((e) => (
                <div key={e.id} className="tx-row">
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, color: "var(--bone-dim)" }}>{e.date}</p>
                  </div>
                  {e.sleep_hours && (
                    <span className="tag" style={{ fontSize: 10 }}>😴 {e.sleep_hours}h</span>
                  )}
                  {e.weight_kg && (
                    <span className="tag" style={{ fontSize: 10 }}>⚖️ {e.weight_kg}kg</span>
                  )}
                  {e.mood && (
                    <span className="tag" style={{ fontSize: 10 }}>🧠 mood {e.mood}/5</span>
                  )}
                  {e.workout_minutes && (
                    <span className="tag" style={{ fontSize: 10, borderColor: "var(--green)", color: "var(--green)" }}>
                      💪 {e.workout_minutes}min
                    </span>
                  )}
                  {e.workout_type && (
                    <span className="tick" style={{ fontSize: 11 }}>{e.workout_type}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
