"use client";
import { useState } from "react";
import { Trash2, MapPin } from "lucide-react";
import { Modal, Field } from "@/components/Modal";

export interface CalEvent {
  id: string;
  title: string | null;
  description: string | null;
  start: string | null;
  end: string | null;
  allDay?: boolean;
  location: string | null;
  color: string | null;
}

const COLORS: { id: string; v: string; label: string }[] = [
  { id: "5", v: "var(--gold)", label: "Oro" },
  { id: "1", v: "var(--blue)", label: "Azul" },
  { id: "2", v: "var(--green)", label: "Verde" },
  { id: "3", v: "var(--violet)", label: "Violeta" },
  { id: "4", v: "var(--red)", label: "Rojo" },
  { id: "8", v: "var(--mute)", label: "Gris" },
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalInput(iso: string | null, allDay: boolean): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const base = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (allDay) return base;
  return `${base}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function EventModal({
  event,
  defaultStart,
  onClose,
  onSaved,
}: {
  event?: CalEvent | null;
  defaultStart?: Date;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!event?.id;
  const initialAllDay = event?.allDay ?? false;
  const initialStart = event?.start
    ? toLocalInput(event.start, initialAllDay)
    : toLocalInput((defaultStart ?? new Date()).toISOString(), false);
  const initialEnd = event?.end
    ? toLocalInput(event.end, initialAllDay)
    : toLocalInput(new Date((defaultStart ?? new Date()).getTime() + 3600000).toISOString(), false);

  const [title, setTitle] = useState(event?.title ?? "");
  const [desc, setDesc] = useState(event?.description ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [allDay, setAllDay] = useState(initialAllDay);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [color, setColor] = useState(event?.color ?? "5");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchAllDay(v: boolean) {
    setAllDay(v);
    setStart((s) => (s ? s.split("T")[0] + (v ? "" : "T09:00") : s));
    setEnd((e) => (e ? e.split("T")[0] + (v ? "" : "T10:00") : e));
  }

  async function save() {
    if (!title.trim() || !start) {
      setError("Falta título o fecha de inicio.");
      return;
    }
    setSaving(true);
    setError(null);
    let endVal = end || start;
    if (allDay && endVal <= start) endVal = addDay(start);
    if (!allDay && new Date(endVal) <= new Date(start)) {
      endVal = new Date(new Date(start).getTime() + 3600000).toISOString();
    }
    const payload = {
      ...(editing ? { id: event!.id } : {}),
      title: title.trim(),
      description: desc.trim() || null,
      location: location.trim() || null,
      color,
      allDay,
      start,
      end: endVal,
    };
    const res = await fetch("/api/calendar", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      setError("No se pudo guardar. Revisa la conexión con Google.");
      return;
    }
    onSaved();
    onClose();
  }

  async function remove() {
    if (!editing) return;
    if (!confirm("¿Eliminar este evento del calendario?")) return;
    setSaving(true);
    const res = await fetch(`/api/calendar?id=${encodeURIComponent(event!.id)}`, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) {
      setError("No se pudo eliminar.");
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Modal title={editing ? "Editar evento" : "Nuevo evento"} onClose={onClose}>
      <Field label="Título">
        <input
          className="input"
          autoFocus
          placeholder="ej. Llamada con cliente"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>

      <label className="cal-allday">
        <input type="checkbox" checked={allDay} onChange={(e) => switchAllDay(e.target.checked)} />
        <span>Todo el día</span>
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Inicio">
          <input
            className="input"
            type={allDay ? "date" : "datetime-local"}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <Field label="Fin">
          <input
            className="input"
            type={allDay ? "date" : "datetime-local"}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Ubicación">
        <div style={{ position: "relative" }}>
          <MapPin size={14} style={{ position: "absolute", left: 12, top: 13, color: "var(--mute)" }} />
          <input
            className="input"
            style={{ paddingLeft: 34 }}
            placeholder="Opcional"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
      </Field>

      <Field label="Descripción">
        <textarea
          className="input"
          rows={3}
          style={{ resize: "vertical", minHeight: 64 }}
          placeholder="Notas, enlaces, agenda…"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
      </Field>

      <Field label="Color">
        <div className="cal-colors">
          {COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`cal-color-chip${color === c.id ? " active" : ""}`}
              style={{ background: c.v }}
              title={c.label}
              onClick={() => setColor(c.id)}
              aria-label={c.label}
            />
          ))}
        </div>
      </Field>

      {error && <p className="tick" style={{ color: "var(--red)", marginTop: 4 }}>{error}</p>}

      <div className="modal-actions" style={{ justifyContent: editing ? "space-between" : "flex-end" }}>
        {editing && (
          <button className="btn btn-ghost btn-sm" onClick={remove} disabled={saving} style={{ color: "var(--red)" }}>
            <Trash2 size={13} /> Eliminar
          </button>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !title.trim()}>
            {saving ? "Guardando…" : editing ? "Guardar" : "Crear"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
