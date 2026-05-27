// Sincronización de Panamericana → Google Calendar (best-effort desde el cliente).
// Todo es tolerante a fallos: si el calendario no está configurado o falla, las
// funciones devuelven null y la captura sigue su curso sin romperse.

// CDMX es UTC-6 fijo (sin horario de verano desde 2022).
const CDMX = "-06:00";

function cdmxISO(date: string, time: string): string {
  const t = time.length === 5 ? `${time}:00` : time; // HH:MM → HH:MM:SS
  return `${date}T${t}${CDMX}`;
}

function nextDay(date: string): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

// Colores de la paleta de Google Calendar (colorId).
const COLOR = { assignment: "5", exam: "11", study: "9", class: "7" } as const;

type CalBody = {
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  color?: string;
  allDay?: boolean;
  recurrence?: string[];
};

async function createEvent(body: CalBody): Promise<string | null> {
  try {
    const res = await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.event?.id ?? null;
  } catch {
    return null;
  }
}

export async function deleteCalEvent(id: string | null | undefined): Promise<void> {
  if (!id) return;
  try {
    await fetch(`/api/calendar?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {}
}

// Entrega: evento con hora (si hay) o de todo el día en la fecha límite.
export async function syncAssignment(a: {
  title: string;
  courseName?: string;
  dueDate: string;
  dueTime?: string | null;
}): Promise<string | null> {
  const desc = a.courseName ? `Entrega · ${a.courseName}` : "Entrega";
  if (a.dueTime) {
    const start = cdmxISO(a.dueDate, a.dueTime);
    const end = cdmxISO(a.dueDate, a.dueTime); // punto en el tiempo (la API le suma 1h)
    return createEvent({ title: `📋 ${a.title}`, start, end, description: desc, color: COLOR.assignment });
  }
  return createEvent({
    title: `📋 ${a.title}`,
    start: a.dueDate,
    end: nextDay(a.dueDate),
    allDay: true,
    description: desc,
    color: COLOR.assignment,
  });
}

// Examen: evento con hora (si hay) o de todo el día.
export async function syncExam(e: {
  name: string;
  courseName?: string;
  date: string;
  examTime?: string | null;
  topics?: string | null;
}): Promise<string | null> {
  const desc = [e.courseName ? `Examen · ${e.courseName}` : "Examen", e.topics ? `Temas: ${e.topics}` : ""]
    .filter(Boolean)
    .join("\n");
  if (e.examTime) {
    const start = cdmxISO(e.date, e.examTime);
    const end = cdmxISO(e.date, e.examTime);
    return createEvent({ title: `📝 ${e.name}`, start, end, description: desc, color: COLOR.exam });
  }
  return createEvent({
    title: `📝 ${e.name}`,
    start: e.date,
    end: nextDay(e.date),
    allDay: true,
    description: desc,
    color: COLOR.exam,
  });
}

// Bloque de estudio: evento de todo el día el día sugerido para empezar a estudiar.
export async function syncStudyBlock(s: {
  examName: string;
  courseName?: string;
  studyStart: string;
}): Promise<string | null> {
  return createEvent({
    title: `📚 Estudiar: ${s.examName}`,
    start: s.studyStart,
    end: nextDay(s.studyStart),
    allDay: true,
    description: s.courseName ? `Empieza a preparar el examen · ${s.courseName}` : "Empieza a preparar el examen",
    color: COLOR.study,
  });
}

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function nextOccurrence(dayOfWeek: number): string {
  const today = new Date();
  const t = new Date(today.toISOString().split("T")[0] + "T00:00:00");
  const diff = (dayOfWeek - t.getDay() + 7) % 7;
  t.setDate(t.getDate() + diff);
  return t.toISOString().split("T")[0];
}

// Clase: evento semanal recurrente (≈ un semestre de clases).
export async function syncClass(c: {
  courseName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string | null;
}): Promise<string | null> {
  const date = nextOccurrence(c.dayOfWeek);
  return createEvent({
    title: c.courseName,
    start: cdmxISO(date, c.startTime),
    end: cdmxISO(date, c.endTime),
    location: c.room ?? undefined,
    color: COLOR.class,
    recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[c.dayOfWeek]};COUNT=20`],
  });
}
