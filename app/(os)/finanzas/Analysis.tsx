"use client";
import { useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";

function renderLine(line: string, i: number) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <p key={i} className="fin-analysis-line">
      {parts.map((p, j) =>
        p.startsWith("**") && p.endsWith("**")
          ? <strong key={j} className="fin-analysis-head">{p.slice(2, -2)}</strong>
          : <span key={j}>{p}</span>
      )}
    </p>
  );
}

export function Analysis({ initial, generatedAt }: { initial: string | null; generatedAt: string | null }) {
  const [text, setText] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [when, setWhen] = useState(generatedAt);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch("/api/shadow/finanzas", { method: "POST" });
      const data = await res.json();
      if (data.content) {
        setText(data.content);
        setWhen(new Date().toISOString());
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card fin-analysis-card mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="eyebrow-gold" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={12} /> Análisis de Shadow
        </p>
        <button className="btn btn-ghost btn-sm" onClick={run} disabled={loading}>
          <RefreshCw size={12} className={loading ? "spin" : undefined} />
          {loading ? "Analizando…" : text ? "Actualizar" : "Analizar mes"}
        </button>
      </div>
      {text ? (
        <div className="fin-analysis-body">
          {text.split("\n").filter((l) => l.trim()).map(renderLine)}
          {when && (
            <p className="tick" style={{ marginTop: 10 }}>
              {new Date(when).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      ) : (
        <p style={{ color: "var(--mute)", fontSize: 13 }}>
          Pídele a Shadow que analice tu mes: lectura, en qué se va el dinero y movimientos a seguir.
        </p>
      )}
    </div>
  );
}
