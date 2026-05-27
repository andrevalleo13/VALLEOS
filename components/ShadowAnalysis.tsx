"use client";
import { useState } from "react";
import { RefreshCw, ArrowRight } from "lucide-react";
import { Orb } from "@/components/Orb";

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i} style={{ color: "var(--bone)" }}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
}

function Markdownish({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="ac-md">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
        const bullet = /^\s*[-*]\s+/.test(line);
        const content = line.replace(/^\s*[-*]\s+/, "");
        return (
          <p key={i} style={{ paddingLeft: bullet ? 14 : 0, position: "relative" }}>
            {bullet && <span style={{ position: "absolute", left: 2, color: "var(--gold)" }}>·</span>}
            {renderInline(content)}
          </p>
        );
      })}
    </div>
  );
}

export function ShadowAnalysis({
  endpoint,
  title = "Análisis de Shadow",
  cta,
  loadingText,
  emptyText,
  initial,
  generatedAt,
  canRun = true,
}: {
  endpoint: string;
  title?: string;
  cta: string;
  loadingText: string;
  emptyText: string;
  initial: string | null;
  generatedAt: string | null;
  canRun?: boolean;
}) {
  const [text, setText] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [when, setWhen] = useState(generatedAt);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch(endpoint, { method: "POST" });
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
    <div className="card mb-6 ac-analysis">
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <Orb size={40} state={loading ? "thinking" : "idle"} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <p className="eyebrow-gold">{title}</p>
            {text && (
              <button className="tb-btn" style={{ width: 28, height: 28 }} onClick={run} disabled={loading} title="Regenerar análisis">
                <RefreshCw size={13} className={loading ? "spin" : ""} />
              </button>
            )}
          </div>
          {loading ? (
            <p style={{ color: "var(--mute)", fontSize: 14 }}>{loadingText}</p>
          ) : text ? (
            <>
              <Markdownish text={text} />
              {when && (
                <p className="tick" style={{ marginTop: 10 }}>
                  Generado {new Date(when).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </>
          ) : (
            <>
              <p style={{ color: "var(--mute)", fontSize: 14, marginBottom: 12 }}>{emptyText}</p>
              <button className="btn btn-primary btn-sm" onClick={run} disabled={loading || !canRun}>
                {cta} <ArrowRight size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
