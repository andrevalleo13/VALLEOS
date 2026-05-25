"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";
import type { ReadingItem } from "@/lib/supabase/types";

const TYPES = [
  { v: "article", l: "Artículo" },
  { v: "video",   l: "Video" },
  { v: "podcast", l: "Podcast" },
  { v: "paper",   l: "Paper" },
  { v: "book",    l: "Libro" },
  { v: "other",   l: "Otro" },
];

export function EditReading({ item, onClose }: { item: ReadingItem; onClose: () => void }) {
  const supabase = createClient();
  const [title, setTitle]       = useState(item.title ?? "");
  const [url, setUrl]           = useState(item.url ?? "");
  const [type, setType]         = useState(item.type);
  const [status, setStatus]     = useState(item.status);
  const [source, setSource]     = useState(item.source ?? "");
  const [minutes, setMinutes]   = useState(item.estimated_minutes?.toString() ?? "");
  const [coverUrl, setCoverUrl] = useState(item.cover_url ?? "");
  const [totalPages, setTotal]  = useState(item.total_pages?.toString() ?? "");
  const [notes, setNotes]       = useState(item.notes ?? "");
  const [summary, setSummary]   = useState(item.summary ?? "");
  const [saving, setSaving]     = useState(false);
  const [archiving, setArchiving] = useState(false);

  async function save() {
    setSaving(true);
    await supabase.from("reading_items").update({
      title:              title.trim() || null,
      url:                url.trim() || "",
      type,
      status,
      source:             source.trim() || null,
      summary:            summary.trim() || null,
      estimated_minutes:  minutes.trim() ? parseInt(minutes) : null,
      cover_url:          coverUrl.trim() || null,
      total_pages:        totalPages.trim() ? parseInt(totalPages) : null,
      notes:              notes.trim() || null,
      completed_at:       status === "done"
        ? (item.completed_at ?? new Date().toISOString())
        : null,
    }).eq("id", item.id);
    setSaving(false);
    onClose();
  }

  async function archive() {
    setArchiving(true);
    await supabase.from("reading_items").update({ status: "archived" }).eq("id", item.id);
    setArchiving(false);
    onClose();
  }

  const isBook = type === "book";

  return (
    <Modal title="Editar" onClose={onClose}>
      <Field label="Título">
        <input
          className="input"
          autoFocus
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
          <input className="input" value={source} onChange={(e) => setSource(e.target.value)} />
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

      <Field label="Descripción">
        <textarea
          className="input"
          rows={2}
          placeholder="De qué trata…"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          style={{ resize: "vertical" }}
        />
      </Field>

      <Field label="Notas personales">
        <textarea
          className="input"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ resize: "vertical" }}
        />
      </Field>

      <div className="modal-actions" style={{ justifyContent: "space-between" }}>
        <button
          className="btn btn-ghost btn-sm"
          style={{ color: "var(--red)" }}
          onClick={archive}
          disabled={archiving}
        >
          {archiving ? "Archivando…" : "Archivar"}
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary btn-sm"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
