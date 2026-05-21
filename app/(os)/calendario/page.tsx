"use client";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, Calendar } from "lucide-react";

interface CalEvent {
  id: string;
  title: string | null;
  description: string | null;
  start: string | null;
  end: string | null;
  location: string | null;
  color: string | null;
}

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

function isAllDay(start: string | null): boolean {
  return !!start && !start.includes("T");
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 7);

export default function CalendarioPage() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + offset);
  const dateLabel = targetDate.toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long",
  });
  const targetDateStr = targetDate.toISOString().split("T")[0];

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/calendar?days=30")
      .then((r) => r.json())
      .then(({ events: evs, error: err }) => {
        if (err) { setError(err); return; }
        setEvents(evs ?? []);
      })
      .catch(() => setError("Error al cargar calendario"))
      .finally(() => setLoading(false));
  }, []);

  const dayEvents = events.filter((ev) => {
    const start = ev.start;
    if (!start) return false;
    return start.split("T")[0] === targetDateStr;
  });

  const allDayEvents = dayEvents.filter((ev) => isAllDay(ev.start));
  const timedEvents = dayEvents.filter((ev) => !isAllDay(ev.start));

  function getEventHour(ev: CalEvent): number {
    if (!ev.start || isAllDay(ev.start)) return 0;
    return new Date(ev.start).getHours();
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
            <button className="btn btn-primary btn-sm">
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
                    <div
                      key={ev.id}
                      className="cal-event"
                      style={{ borderLeftColor: eventColor(ev.color) }}
                    >
                      <span className="cal-event-title">{ev.title ?? "Sin título"}</span>
                    </div>
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
                    <div style={{ flex: 1, position: "relative" }}>
                      {hourEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className="cal-event"
                          style={{ borderLeftColor: eventColor(ev.color), marginBottom: 4 }}
                        >
                          <span className="cal-event-title">{ev.title ?? "Sin título"}</span>
                          <span className="cal-event-time">
                            {formatTime(ev.start)} – {formatTime(ev.end)}
                          </span>
                          {ev.location && (
                            <span className="tick" style={{ fontSize: 10 }}>{ev.location}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {dayEvents.length === 0 && (
                <div style={{ padding: "48px 16px", textAlign: "center" }}>
                  <p style={{ color: "var(--mute)", fontSize: 14 }}>Sin eventos para este día</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
