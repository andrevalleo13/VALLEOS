"use client";
import { useState } from "react";
import { Sparkles, RefreshCw, CalendarPlus, Check } from "lucide-react";

type Block = { title: string; weekday: number; start: string; end: string };
export type Pattern = { insight: string; suggestion: string; block?: Block };

const WD_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// CDMX es UTC-6 (sin horario de verano) — offset fijo para que el evento caiga a la hora correcta
function blockISO(weekday: number, hhmm: string): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let add = (weekday - d.getDay() + 7) % 7;
  if (add === 0) add = 7;
  d.setDate(d.getDate() + add);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${date}T${hhmm}:00-06:00`;
}

export function Patrones({ initial, generatedAt }: { initial: Pattern[]; generatedAt: string | null }) {
  const [patterns, setPatterns] = useState<Pattern[]>(initial);
  const [loading, setLoading] = useState(false);
  const [when, setWhen] = useState(generatedAt);
  const [blocked, setBlocked] = useState<Record<number, "idle" | "loading" | "ok" | "err">>({});
  const [ran, setRan] = useState(initial.length > 0 || !!generatedAt);

  async function detect() {
    setLoading(true);
    try {
      const res = await fetch("/api/shadow/patrones", { method: "POST" });
      const data = await res.json();
      setPatterns(Array.isArray(data.patterns) ? data.patterns : []);
      setWhen(data.generatedAt ?? new Date().toISOString());
      setRan(true);
    } finally {
      setLoading(false);
    }
  }

  async function block(i: number, b: Block) {
    setBlocked((s) => ({ ...s, [i]: "loading" }));
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: b.title,
          start: blockISO(b.weekday, b.start),
          end: blockISO(b.weekday, b.end),
          description: "Bloqueo sugerido por Shadow a partir de tus patrones de tiempo.",
          color: "9",
        }),
      });
      setBlocked((s) => ({ ...s, [i]: res.ok ? "ok" : "err" }));
    } catch {
      setBlocked((s) => ({ ...s, [i]: "err" }));
    }
  }

  return (
    <div className="card pt-card mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="eyebrow-gold" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={12} /> Patrones predictivos
        </p>
        <button className="btn btn-ghost btn-sm" onClick={detect} disabled={loading}>
          <RefreshCw size={12} className={loading ? "spin" : undefined} />
          {loading ? "Detectando…" : ran ? "Actualizar" : "Detectar patrones"}
        </button>
      </div>

      {patterns.length > 0 ? (
        <>
          <div className="pt-list">
            {patterns.map((p, i) => (
              <div key={i} className="pt-item">
                <p className="pt-insight">{p.insight}</p>
                <p className="pt-suggestion">{p.suggestion}</p>
                {p.block && (
                  <div className="pt-block">
                    <span className="pt-slot">
                      {WD_SHORT[p.block.weekday] ?? "?"} · {p.block.start}–{p.block.end}
                    </span>
                    <button
                      className={`btn btn-sm ${blocked[i] === "ok" ? "btn-ghost" : "btn-primary"}`}
                      onClick={() => p.block && block(i, p.block)}
                      disabled={blocked[i] === "loading" || blocked[i] === "ok"}
                      style={{ gap: 6 }}
                    >
                      {blocked[i] === "ok" ? (
                        <><Check size={12} /> Bloqueado</>
                      ) : blocked[i] === "loading" ? (
                        "Agendando…"
                      ) : blocked[i] === "err" ? (
                        "Reintentar"
                      ) : (
                        <><CalendarPlus size={12} /> Bloquear en calendario</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {when && (
            <p className="tick" style={{ marginTop: 10 }}>
              {new Date(when).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </>
      ) : (
        <p style={{ color: "var(--mute)", fontSize: 13 }}>
          {ran
            ? "Shadow aún no detecta patrones claros — registra más sesiones de tiempo y vuelve a intentar."
            : "Shadow analiza tu historial de tiempo para encontrar patrones por día y hora, y te sugiere bloqueos de calendario para protegerlos."}
        </p>
      )}
    </div>
  );
}
