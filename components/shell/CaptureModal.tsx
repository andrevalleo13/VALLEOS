"use client";
import { useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { X, Zap } from "lucide-react";

export function CaptureModal() {
  const { captureOpen, setCaptureOpen } = useAppStore();
  const [text, setText] = useState("");
  const [type, setType] = useState<"nota" | "tarea" | "idea">("nota");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!captureOpen) return null;

  async function save() {
    if (!text.trim()) return;
    setSaving(true);
    // TODO: save to supabase brain_notes
    await new Promise((r) => setTimeout(r, 400));
    setText("");
    setSaving(false);
    setCaptureOpen(false);
  }

  return (
    <div className="capture-backdrop" onClick={() => setCaptureOpen(false)}>
      <div className="capture-modal" onClick={(e) => e.stopPropagation()}>
        <div className="capture-header">
          <Zap size={18} style={{ color: "var(--gold)" }} />
          <span className="serif" style={{ fontSize: 18, color: "var(--bone)" }}>
            Captura rápida
          </span>
          <button
            className="ml-auto tb-btn"
            onClick={() => setCaptureOpen(false)}
          >
            <X size={16} />
          </button>
        </div>

        <div className="capture-body">
          <div className="flex gap-2 mb-4">
            {(["nota", "tarea", "idea"] as const).map((t) => (
              <button
                key={t}
                className={`tag cursor-pointer capitalize ${type === t ? "tag-gold" : ""}`}
                onClick={() => setType(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <textarea
            ref={textareaRef}
            className="capture-input"
            rows={5}
            placeholder={
              type === "nota" ? "¿Qué quieres anotar?" :
              type === "tarea" ? "¿Qué necesitas hacer?" :
              "¿Qué idea quieres capturar?"
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
            }}
          />
        </div>

        <div className="capture-footer">
          <span className="tick">⌘↵ para guardar</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setCaptureOpen(false)}>
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
      </div>
    </div>
  );
}
