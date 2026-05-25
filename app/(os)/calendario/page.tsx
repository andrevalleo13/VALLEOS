"use client";
import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, Calendar, MapPin, Pencil } from "lucide-react";
import { EventModal, type CalEvent } from "@/components/calendario/EventModal";

const COLOR_MAP: Record<string, string> = {
  "1": "var(--blue)",
  "2": "var(--green)",
  "3": "var(--violet)",
  "4": "var(--red)",
  "5": "var(--gold)",
  "6": "var(--red)",
  "7": "var(--blue)",
  "8": "var(--mute)",
  "9": "var(--blue)",
  "10": "var(--green)",
  "11": "var(--red)",
};

function eventColor(colorId: string | null): string {
  return colorId ? (COLOR_MAP[colorId] ?? "var(--gold)") : "var(--gold)";
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function isAllDay(ev: CalEvent): boolean {
  return ev.allDay ?? (!!ev.start && !ev.start.includes("T"));
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 7);

export default function CalendarioPage() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<CalEvent | null>(null);
  const [creating, setCreating] = useState<Date | null>(null);

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + offset);
  const dateLabel = targetDate.toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long",
  });
  const targetDateStr = targetDate.toISOString().split("T")[0];

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/calendar?days=60")
      .then((r) => r.json())
      .then(({ events: evs, error: err }) => {
        if (err) { setError(err); return; }
        setEvents(evs ?? []);
      })
      .catch(() => setError("Error al cargar calendario"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const dayEvents = events.filter((ev) => {
    if (!ev.start) return false;
    return ev.start.split("T")[0] === targetDateStr;
  });

  const allDayEvents = dayEvents.filter(isAllDay);
  const timedEvents = dayEvents.filter((ev) => !isAllDay(ev));

  function getEventHour(ev: CalEvent): number {
    if (!ev.start || isAllDay(ev)) return 0;
    return new Date(ev.start).getHours();
  }

  function newEventAt(hour: number) {
    const d = new Date(targetDate);
    d.setHours(hour, 0, 0, 0);
    setCreating(d);
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-4">
          <div style={{ flex: 1 }}>
            <p className="eyebrow mb-1" style={{ textTransform: "capitalize" }}>{dateLabel}</p>
            <h1 className="page-title">Calendario</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-icon" onClick={() => setOffset((o) => o - 1)}>
              <ChevronLeft size={16} />
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setOffset(0)}>Hoy</button>
            <button className="btn btn-ghost btn-icon" onClick={() => setOffset((o) => o + 1)}>
              <ChevronRight size={16} />
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => newEventAt(9)}>
              <Plus size={14} /> Evento
            </button>
          </div>
        </div>
      </div>

      <div className="page-body" style={{ maxHeight: "calc(100% - 100px)", overflowY: "auto" }}>
        {loading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="shimmer h-14 rounded-xl" />)}
          </div>
        ) : error ? (
          <div className="card text-center py-12">
            <Calendar size={32} style={{ color: "var(--mute-2)", margin: "0 auto 12px" }} />
            <p style={{ color: "var(--mute)", fontSize: 14 }}>No se pudo conectar con Google Calendar</p>
            <p className="tick mt-1">{error}</p>
          </div>
        ) : (
          <>
            {allDayEvents.length > 0 && (
              <div className="card mb-4">
                <p className="eyebrow mb-2">Todo el día</p>
                <div className="flex flex-col gap-1">
                  {allDayEvents.map((ev) => (
                    <button
                      key={ev.id}
                      className="cal-event cal-event-btn"
                      style={{ borderLeftColor: eventColor(ev.color) }}
                      onClick={() => setEditing(ev)}
                    >
                      <span className="cal-event-title">{ev.title ?? "Sin título"}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ position: "relative" }}>
              {HOURS.map((hour) => {
                const hourEvents = timedEvents.filter((ev) => getEventHour(ev) === hour);
                return (
                  <div key={hour} className="cal-slot">
                    <div className="cal-slot-time">{String(hour).padStart(2, "0")}:00</div>
                    <div
                      className="cal-slot-body"
                      onClick={(e) => { if (e.target === e.currentTarget) newEventAt(hour); }}
                    >
                      {hourEvents.map((ev) => (
                        <button
                          key={ev.id}
                          className="cal-event cal-event-btn"
                          style={{ borderLeftColor: eventColor(ev.color), marginBottom: 4 }}
                          onClick={() => setEditing(ev)}
                        >
                          <span className="cal-event-title">
                            {ev.title ?? "Sin título"}
                            <Pencil size={11} className="cal-event-edit" />
                          </span>
                          <span className="cal-event-time">
                            {formatTime(ev.start)} – {formatTime(ev.end)}
                          </span>
                          {ev.location && (
                            <span className="tick" style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 3 }}>
                              <MapPin size={9} /> {ev.location}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {dayEvents.length === 0 && (
                <div style={{ padding: "48px 16px", textAlign: "center" }}>
                  <p style={{ color: "var(--mute)", fontSize: 14 }}>Sin eventos para este día</p>
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => newEventAt(9)}>
                    <Plus size={13} /> Agregar evento
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {(editing || creating) && (
        <EventModal
          event={editing}
          defaultStart={creating ?? undefined}
          onClose={() => { setEditing(null); setCreating(null); }}
          onSaved={load}
        />
      )}
    </div>
  );
}
