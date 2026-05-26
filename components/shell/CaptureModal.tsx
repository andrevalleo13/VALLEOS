"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { play } from "@/lib/sounds";
import {
  X, Zap, Sparkles, Brain, CheckSquare, DollarSign, TrendingUp, BookOpen,
} from "lucide-react";

type Mode = "auto" | "nota" | "tarea" | "gasto";
const MODES: { key: Mode; label: string }[] = [
  { key: "auto", label: "Auto" },
  { key: "nota", label: "Nota" },
  { key: "tarea", label: "Tarea" },
  { key: "gasto", label: "Gasto" },
];

const ICONS: Record<string, typeof Brain> = {
  Brain, CheckSquare, DollarSign, TrendingUp, BookOpen, Sparkles,
};

type Result = { kind: string; icon: string; summary: string; href: string };

export function CaptureModal() {
  const { captureOpen, setCaptureOpen } = useAppStore();
  const router = useRouter();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<Mode>("auto");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!captureOpen) return null;

  function close() {
    setCaptureOpen(false);
    setText("");
    setResult(null);
    setMode("auto");
    setSaving(false);
  }

  async function save() {
    if (!text.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), force: mode === "auto" ? undefined : mode }),
      });
      if (!res.ok) throw new Error("capture failed");
      const data = (await res.json()) as Result;
      setResult(data);
      play("success");
      const Icon = ICONS[data.icon] ?? Sparkles;
      toast(data.summary, {
        icon: <Icon size={16} style={{ color: "var(--gold)" }} />,
        action: { label: "Ver", onClick: () => router.push(data.href) },
      });
      router.refresh();
      setTimeout(close, 1100);
    } catch {
      play("alert");
      toast.error("No se pudo capturar");
      setSaving(false);
    }
  }

  const ResultIcon = result ? ICONS[result.icon] ?? Sparkles : Sparkles;

  return (
    <div className="capture-backdrop" onClick={close}>
      <div className="capture-modal" onClick={(e) => e.stopPropagation()}>
        <div className="capture-header">
          <Zap size={18} style={{ color: "var(--gold)" }} />
          <span className="serif" style={{ fontSize: 18, color: "var(--bone)" }}>
            Captura rápida
          </span>
          <button className="ml-auto tb-btn" onClick={close}>
            <X size={16} />
          </button>
        </div>

        {result ? (
          <div className="capture-body" style={{ paddingTop: 28, paddingBottom: 28, textAlign: "center" }}>
            <div
              style={{
                width: 44, height: 44, borderRadius: 12, margin: "0 auto 14px",
                display: "grid", placeItems: "center",
                background: "var(--gold-glow)", border: "1px solid var(--gold)",
              }}
            >
              <ResultIcon size={20} style={{ color: "var(--gold)" }} />
            </div>
            <p style={{ color: "var(--bone)", fontSize: 15 }}>{result.summary}</p>
          </div>
        ) : (
          <div className="capture-body">
            <div className="flex gap-2 mb-4">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  className={`tag cursor-pointer ${mode === m.key ? "tag-gold" : ""}`}
                  onClick={() => setMode(m.key)}
                >
                  {m.key === "auto" && <Sparkles size={11} style={{ marginRight: 4, display: "inline" }} />}
                  {m.label}
                </button>
              ))}
            </div>

            <textarea
              ref={textareaRef}
              className="capture-input"
              rows={5}
              placeholder={
                mode === "auto" ? "Escribe lo que sea — Shadow lo manda al lugar correcto…" :
                mode === "tarea" ? "¿Qué necesitas hacer?" :
                mode === "gasto" ? "Ej. pagué 200 de uber" :
                "¿Qué quieres anotar?"
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
              }}
            />
          </div>
        )}

        {!result && (
          <div className="capture-footer">
            <span className="tick">
              {mode === "auto" ? "⌘↵ · Shadow decide dónde guardar" : "⌘↵ para guardar"}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={close}>
              Cancelar
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={save}
              disabled={saving || !text.trim()}
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
