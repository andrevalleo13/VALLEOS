"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";

const TYPES = [
  { v: "article", l: "Artículo" },
  { v: "video",   l: "Video" },
  { v: "podcast", l: "Podcast" },
  { v: "paper",   l: "Paper" },
  { v: "book",    l: "Libro" },
  { v: "other",   l: "Otro" },
];

export function AddReading({
  variant = "primary",
  label = "Agregar",
}: {
  variant?: "ghost" | "primary";
  label?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen]         = useState(false);
  const [title, setTitle]       = useState("");
  const [url, setUrl]           = useState("");
  const [type, setType]         = useState("article");
  const [status, setStatus]     = useState("pending");
  const [minutes, setMinutes]   = useState("");
  const [source, setSource]     = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [totalPages, setTotal]  = useState("");
  const [saving, setSaving]     = useState(false);

  function reset() {
    setTitle(""); setUrl(""); setMinutes(""); setSource("");
    setCoverUrl(""); setTotal(""); setType("article"); setStatus("pending");
  }

  async function save() {
    if (!title.trim() && !url.trim()) return;
    setSaving(true);
    const isBook = type === "book";
    await supabase.from("reading_items").insert({
      url:               url.trim() || "",
      title:             title.trim() || null,
      source:            source.trim() || null,
      type,
      status,
      estimated_minutes: !isBook && minutes.trim() ? parseInt(minutes) : null,
      cover_url:         isBook && coverUrl.trim() ? coverUrl.trim() : null,
      total_pages:       isBook && totalPages.trim() ? parseInt(totalPages) : null,
      current_page:      0,
      summary:           null,
      notes:             null,
      completed_at:      status === "done" ? new Date().toISOString() : null,
    });
    setSaving(false);
    setOpen(false);
    reset();
    router.refresh();
  }

  const isBook = type === "book";

  return (
    <>
      <button className={`btn btn-${variant} btn-sm`} onClick={() => setOpen(true)}>
        <Plus size={14} /> {label}
      </button>

      {open && (
        <Modal title="Agregar a la lista" onClose={() => { setOpen(false); reset(); }}>
          <Field label="Título">
            <input
              className="input"
              autoFocus
              placeholder={isBook ? "ej. The Lean Startup" : "ej. How to think"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
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
            <Field label="Autor / fuente">
              <input
                className="input"
                placeholder={isBook ? "ej. Eric Ries" : "ej. Medium"}
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </Field>
            {isBook ? (
              <Field label="Total páginas">
                <input
                  className="input"
                  type="number"
                  placeholder="380"
                  value={totalPages}
                  onChange={(e) => setTotal(e.target.value)}
                />
              </Field>
            ) : (
              <Field label="Minutos estimados">
                <input
                  className="input"
                  type="number"
                  placeholder="15"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
              </Field>
            )}
          </div>

          {isBook && (
            <Field label="URL portada">
              <input
                className="input"
                placeholder="https://…/cover.jpg"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
              />
            </Field>
          )}

          <Field label="URL (opcional)">
            <input
              className="input"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>

          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); reset(); }}>
              Cancelar
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={save}
              disabled={saving || (!title.trim() && !url.trim())}
            >
              {saving ? "Guardando…" : "Agregar"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
