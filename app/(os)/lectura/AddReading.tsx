"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";

const TYPES = [
  { v: "article", l: "Artículo" },
  { v: "video", l: "Video" },
  { v: "podcast", l: "Podcast" },
  { v: "paper", l: "Paper" },
  { v: "book", l: "Libro" },
  { v: "other", l: "Otro" },
];

export function AddReading({ variant = "primary", label = "Agregar" }: { variant?: "ghost" | "primary"; label?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState("article");
  const [status, setStatus] = useState("pending");
  const [minutes, setMinutes] = useState("");
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim() && !url.trim()) return;
    setSaving(true);
    await supabase.from("reading_items").insert({
      url: url.trim(),
      title: title.trim() || null,
      summary: null,
      source: source.trim() || null,
      type,
      estimated_minutes: minutes.trim() ? parseInt(minutes) : null,
      status,
      notes: null,
      completed_at: status === "done" ? new Date().toISOString() : null,
    });
    setSaving(false);
    setOpen(false);
    setTitle(""); setUrl(""); setMinutes(""); setSource("");
    router.refresh();
  }

  return (
    <>
      <button className={`btn btn-${variant} btn-sm`} onClick={() => setOpen(true)}>
        <Plus size={14} /> {label}
      </button>
      {open && (
        <Modal title="Agregar a la lista" onClose={() => setOpen(false)}>
          <Field label="Título">
            <input className="input" autoFocus placeholder="ej. The Lean Startup" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="URL (opcional)">
            <input className="input" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Tipo">
              <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </Field>
            <Field label="Estado">
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="pending">Por leer</option>
                <option value="reading">Leyendo</option>
                <option value="done">Leído</option>
              </select>
            </Field>
            <Field label="Minutos estimados">
              <input className="input" type="number" placeholder="30" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            </Field>
            <Field label="Fuente / autor">
              <input className="input" placeholder="ej. Eric Ries" value={source} onChange={(e) => setSource(e.target.value)} />
            </Field>
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || (!title.trim() && !url.trim())}>
              {saving ? "Guardando…" : "Agregar"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
