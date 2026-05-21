"use client";
import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { X, Moon } from "lucide-react";

const STEPS = [
  {
    title: "Revisión del día",
    description: "¿Cómo fue tu día hoy? ¿Qué salió bien?",
    placeholder: "El día fue...",
  },
  {
    title: "Gratitud",
    description: "Anota 3 cosas por las que estás agradecido hoy.",
    placeholder: "Hoy estoy agradecido por...",
  },
  {
    title: "Wins del día",
    description: "¿Cuáles fueron tus victorias de hoy, grandes o pequeñas?",
    placeholder: "Hoy logré...",
  },
  {
    title: "Aprendizajes",
    description: "¿Qué aprendiste o qué harías diferente?",
    placeholder: "Aprendí que...",
  },
  {
    title: "Intención para mañana",
    description: "¿Cuál es tu prioridad número uno para mañana?",
    placeholder: "Mañana me enfoco en...",
  },
];

export function CierreFlow() {
  const { cierreOpen, setCierreOpen } = useAppStore();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(STEPS.length).fill(""));

  if (!cierreOpen) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function next() {
    if (isLast) {
      // TODO: save to supabase shadow_briefings
      setCierreOpen(false);
      setStep(0);
      setAnswers(Array(STEPS.length).fill(""));
    } else {
      setStep((s) => s + 1);
    }
  }

  function prev() {
    setStep((s) => Math.max(0, s - 1));
  }

  return (
    <div className="cierre-overlay">
      <div className="cierre-modal">
        <div className="cierre-header">
          <div className="eyebrow-gold mb-2">Cierre nocturno</div>
          <h2 className="serif" style={{ fontSize: 26, color: "var(--bone)" }}>
            {current.title}
          </h2>
          <p style={{ color: "var(--mute)", fontSize: 14, marginTop: 6 }}>
            {current.description}
          </p>
        </div>

        <div className="cierre-body">
          <textarea
            className="capture-input w-full"
            rows={6}
            placeholder={current.placeholder}
            value={answers[step]}
            onChange={(e) => {
              const next = [...answers];
              next[step] = e.target.value;
              setAnswers(next);
            }}
            autoFocus
          />
        </div>

        <div className="cierre-footer">
          <div className="cierre-step">Paso {step + 1} de {STEPS.length}</div>
          <div className="cierre-dots">
            {STEPS.map((_, i) => (
              <div key={i} className={`cierre-dot ${i <= step ? "done" : ""}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={prev}>
                Atrás
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={next}>
              {isLast ? "Cerrar el día" : "Siguiente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
