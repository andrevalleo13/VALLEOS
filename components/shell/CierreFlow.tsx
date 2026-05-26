"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Moon, CalendarRange, CalendarDays, RefreshCw, Sparkles, X } from "lucide-react";

const STEPS = [
  { title: "Revisión del día", description: "¿Cómo fue tu día hoy? ¿Qué salió bien?", placeholder: "El día fue..." },
  { title: "Gratitud", description: "Anota 3 cosas por las que estás agradecido hoy.", placeholder: "Hoy estoy agradecido por..." },
  { title: "Wins del día", description: "¿Cuáles fueron tus victorias de hoy, grandes o pequeñas?", placeholder: "Hoy logré..." },
  { title: "Aprendizajes", description: "¿Qué aprendiste o qué harías diferente?", placeholder: "Aprendí que..." },
  { title: "Intención para mañana", description: "¿Cuál es tu prioridad número uno para mañana?", placeholder: "Mañana me enfoco en..." },
];

type Mode = "nocturno" | "semanal" | "mensual";

type AttentionItem = {
  module: string;
  title: string;
  detail: string;
  dueDate: string | null;
  daysUntil: number | null;
  severity: 1 | 2 | 3;
  score: number;
  href: string;
};
type ReviewData = {
  verdict: string;
  items: AttentionItem[];
  rollup: Record<string, string>;
  rangeLabel: string;
  generatedAt: string | null;
};

const MODES: { key: Mode; label: string; icon: typeof Moon; eyebrow: string }[] = [
  { key: "nocturno", label: "Nocturno", icon: Moon, eyebrow: "Cierre nocturno" },
  { key: "semanal", label: "Semanal", icon: CalendarRange, eyebrow: "Cierre semanal" },
  { key: "mensual", label: "Mensual", icon: CalendarDays, eyebrow: "Cierre mensual" },
];

const ROLLUP_LABELS: Record<string, string> = {
  habitos: "Hábitos", metas: "Metas", finanzas: "Finanzas",
  tiempo: "Tiempo", academia: "Academia", salud: "Salud",
};

const sevColor = (s: number) => (s === 3 ? "var(--red)" : s === 2 ? "var(--gold)" : "var(--mute-2)");

function renderVerdict(text: string) {
  return text.split("\n").filter((l) => l.trim()).map((line, i) => {
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
  });
}

export function CierreFlow() {
  const { cierreOpen, setCierreOpen } = useAppStore();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("nocturno");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(STEPS.length).fill(""));
  const [reviews, setReviews] = useState<Partial<Record<Mode, ReviewData>>>({});
  const [loading, setLoading] = useState(false);

  const fetchReview = useCallback(async (m: Mode, refresh = false) => {
    setLoading(true);
    try {
      const res = await fetch("/api/shadow/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: m === "mensual" ? "month" : "week", refresh }),
      });
      const data = (await res.json()) as ReviewData;
      setReviews((prev) => ({ ...prev, [m]: data }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!cierreOpen) return;
    if ((mode === "semanal" || mode === "mensual") && !reviews[mode] && !loading) {
      fetchReview(mode);
    }
  }, [cierreOpen, mode, reviews, loading, fetchReview]);

  if (!cierreOpen) return null;

  const meta = MODES.find((m) => m.key === mode)!;

  function close() {
    setCierreOpen(false);
    setStep(0);
    setAnswers(Array(STEPS.length).fill(""));
    setMode("nocturno");
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const review = reviews[mode];

  function next() {
    if (isLast) close();
    else setStep((s) => s + 1);
  }

  return (
    <div className="cierre-overlay" onClick={close}>
      <div
        className={`cierre-modal ${mode !== "nocturno" ? "cierre-modal-wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cierre-header" style={{ position: "relative" }}>
          <button className="cierre-close" onClick={close} aria-label="Cerrar"><X size={16} /></button>
          <div className="cl-modes">
            {MODES.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  className={`cl-mode-btn ${mode === m.key ? "active" : ""}`}
                  onClick={() => setMode(m.key)}
                >
                  <Icon size={13} /> {m.label}
                </button>
              );
            })}
          </div>
          <div className="eyebrow-gold mb-2" style={{ marginTop: 14 }}>{meta.eyebrow}</div>
          {mode === "nocturno" ? (
            <>
              <h2 className="serif" style={{ fontSize: 26, color: "var(--bone)" }}>{current.title}</h2>
              <p style={{ color: "var(--mute)", fontSize: 14, marginTop: 6 }}>{current.description}</p>
            </>
          ) : (
            <h2 className="serif" style={{ fontSize: 26, color: "var(--bone)" }}>
              {review?.rangeLabel ? `Cierre · ${review.rangeLabel}` : "Cierre del período"}
            </h2>
          )}
        </div>

        {mode === "nocturno" ? (
          <>
            <div className="cierre-body">
              <textarea
                className="capture-input w-full"
                rows={6}
                placeholder={current.placeholder}
                value={answers[step]}
                onChange={(e) => {
                  const nextA = [...answers];
                  nextA[step] = e.target.value;
                  setAnswers(nextA);
                }}
                autoFocus
              />
            </div>
            <div className="cierre-footer">
              <div className="cierre-step">Paso {step + 1} de {STEPS.length}</div>
              <div className="cierre-dots">
                {STEPS.map((_, i) => <div key={i} className={`cierre-dot ${i <= step ? "done" : ""}`} />)}
              </div>
              <div className="flex gap-2">
                {step > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setStep((s) => Math.max(0, s - 1))}>Atrás</button>}
                <button className="btn btn-primary btn-sm" onClick={next}>{isLast ? "Cerrar el día" : "Siguiente"}</button>
              </div>
            </div>
          </>
        ) : (
          <div className="cierre-body cl-review-body">
            {loading && !review ? (
              <div className="cl-loading"><RefreshCw size={16} className="spin" /> Shadow está cruzando tus módulos…</div>
            ) : review ? (
              <>
                <div className="cl-section-eyebrow">Qué necesita tu atención</div>
                {review.items.length ? (
                  <ul className="cl-attention">
                    {review.items.slice(0, 8).map((it, i) => (
                      <li
                        key={i}
                        className="cl-att-item"
                        onClick={() => { router.push(it.href); close(); }}
                      >
                        <span className="cl-att-rank">{i + 1}</span>
                        <span className="cl-att-dot" style={{ background: sevColor(it.severity) }} />
                        <div className="cl-att-body">
                          <div className="cl-att-top">
                            <span className="cl-att-title">{it.title}</span>
                            <span className="cl-att-mod">{it.module}</span>
                          </div>
                          <div className="cl-att-detail">{it.detail}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="cl-empty">Nada urgente en el radar. Vas en orden.</p>
                )}

                {review.verdict && (
                  <div className="cl-verdict">{renderVerdict(review.verdict)}</div>
                )}

                <div className="cl-section-eyebrow">El período</div>
                <div className="cl-rollup">
                  {Object.entries(review.rollup).map(([k, v]) => (
                    <div key={k} className="cl-roll-cell">
                      <span className="cl-roll-label">{ROLLUP_LABELS[k] ?? k}</span>
                      <span className="cl-roll-val">{v}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="cl-empty">No se pudo cargar el cierre.</p>
            )}

            <div className="cl-review-foot">
              {review?.generatedAt && (
                <span className="tick">
                  {new Date(review.generatedAt).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => fetchReview(mode, true)} disabled={loading}>
                <RefreshCw size={12} className={loading ? "spin" : undefined} />
                {loading ? "Analizando…" : review ? "Regenerar veredicto" : "Generar"}
              </button>
              <button className="btn btn-primary btn-sm" onClick={close}>
                <Sparkles size={12} /> Cerrar {mode === "semanal" ? "la semana" : "el mes"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
