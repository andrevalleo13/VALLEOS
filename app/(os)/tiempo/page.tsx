import { createClient } from "@/lib/supabase/server";
import { Plus, Timer } from "lucide-react";

export const revalidate = 0;

export default async function TiempoPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);

  const [{ data: blocks }, { data: logs }] = await Promise.all([
    supabase.from("time_blocks").select("*").eq("active", true).order("sort_order"),
    supabase.from("time_logs").select("*")
      .gte("started_at", weekStart.toISOString())
      .order("started_at", { ascending: false }),
  ]);

  const todayLogs = (logs ?? []).filter((l) => l.started_at.startsWith(today));
  const todayMinutes = todayLogs.reduce((a, l) => a + (l.duration_minutes ?? 0), 0);
  const weekMinutes = (logs ?? []).reduce((a, l) => a + (l.duration_minutes ?? 0), 0);

  const byCategory = (logs ?? []).reduce((acc: Record<string, number>, l) => {
    if (l.category) acc[l.category] = (acc[l.category] ?? 0) + (l.duration_minutes ?? 0);
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow mb-2">12 · TIEMPO</p>
            <h1 className="page-title">Tiempo.</h1>
          </div>
          <button className="btn btn-primary btn-sm"><Plus size={14} /> Log</button>
        </div>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Hoy", val: todayMinutes > 0 ? `${Math.round(todayMinutes / 60 * 10) / 10}h` : "—" },
            { label: "Esta semana", val: weekMinutes > 0 ? `${Math.round(weekMinutes / 60)}h` : "—", color: "var(--gold)" },
            { label: "Sesiones (7d)", val: String((logs ?? []).length) },
          ].map((k) => (
            <div key={k.label} className="card text-center">
              <p style={{ fontFamily: "var(--f-mono)", fontSize: 32, color: k.color ?? "var(--bone)" }}>{k.val}</p>
              <p className="metric-label">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Time blocks (plantilla del día) */}
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

        {/* By category */}
        {Object.keys(byCategory).length > 0 && (
          <div className="card mb-6">
            <p className="eyebrow mb-4">Por categoría (7d)</p>
            <div className="flex flex-col gap-3">
              {Object.entries(byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, mins]) => {
                  const totalMins = Object.values(byCategory).reduce((a, b) => a + b, 0);
                  const pct = Math.round((mins / totalMins) * 100);
                  return (
                    <div key={cat}>
                      <div className="flex justify-between mb-1">
                        <span style={{ fontSize: 13, color: "var(--bone-dim)" }}>{cat}</span>
                        <span className="tick">{Math.round(mins / 60 * 10) / 10}h · {pct}%</span>
                      </div>
                      <div className="progress">
                        <div className="progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Logs */}
        <div className="card">
          <p className="eyebrow mb-4">Sesiones recientes</p>
          {(logs ?? []).length === 0 ? (
            <p className="tick text-center py-6">Sin logs registrados</p>
          ) : (
            <div className="flex flex-col gap-1">
              {(logs ?? []).slice(0, 20).map((l) => (
                <div key={l.id} className="tx-row">
                  <div className="tx-icon"><Timer size={14} style={{ color: "var(--gold)" }} /></div>
                  <div className="flex-1">
                    <p className="tx-desc">{l.label}</p>
                    {l.category && <p className="tx-date">{l.category}</p>}
                  </div>
                  <span className="tx-date">{new Date(l.started_at).toLocaleDateString("es-MX", { month: "short", day: "numeric" })}</span>
                  <span style={{ fontFamily: "var(--f-mono)", fontSize: 13, color: "var(--bone-dim)" }}>
                    {l.duration_minutes ? `${Math.round(l.duration_minutes / 60 * 10) / 10}h` : "En curso"}
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
