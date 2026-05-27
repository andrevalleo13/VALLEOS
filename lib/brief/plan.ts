import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { daysUntil } from "@/lib/academia/grades";

type DB = SupabaseClient<Database>;

// Un renglón del plan cronológico del día. Fusiona clases, gym, estudio,
// entregas y eventos de Google Calendar en una sola línea de tiempo.
export type PlanIcon = "GraduationCap" | "Dumbbell" | "BookOpen" | "Flag" | "CalendarClock" | "Clock";
export type PlanKind = "class" | "gym" | "study" | "assignment" | "event" | "block";

export type PlanItem = {
  key: string;
  kind: PlanKind;
  time: string | null; // "09:00" para mostrar
  endTime: string | null;
  minutes: number | null; // para ordenar (null = sin hora → al final)
  title: string;
  detail: string;
  icon: PlanIcon;
  tone: string;
  href: string;
};

const KIND_META: Record<PlanKind, { label: string; icon: PlanIcon; tone: string; href: string }> = {
  class: { label: "Clase", icon: "GraduationCap", tone: "var(--violet)", href: "/panamericana" },
  gym: { label: "Gym", icon: "Dumbbell", tone: "var(--green)", href: "/gym" },
  study: { label: "Estudio", icon: "BookOpen", tone: "var(--gold)", href: "/panamericana" },
  assignment: { label: "Entrega", icon: "Flag", tone: "var(--red)", href: "/panamericana" },
  event: { label: "Evento", icon: "CalendarClock", tone: "var(--blue)", href: "/calendario" },
  block: { label: "Bloque", icon: "Clock", tone: "var(--mute)", href: "/tiempo" },
};

function getCalendar() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.calendar({ version: "v3", auth: client });
}

// "09:00:00" / "9:00" → minutos desde medianoche. null si no parsea.
function timeToMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function fmtTime(t: string | null | undefined): string | null {
  const mins = timeToMinutes(t);
  if (mins === null) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

// weekday de "today" en CDMX (convención JS: 0=Domingo … 6=Sábado).
function weekdayCDMX(today: string): number {
  return new Date(today + "T12:00:00-06:00").getDay();
}

// Resuelve el/los entrenamientos de hoy: primero el horario semanal
// (workout_schedule), y si no hay nada configurado cae al ciclo (último día +1).
// Devuelve [] = día de descanso.
export async function gymToday(
  supabase: DB,
  weekday: number
): Promise<{ name: string; muscles: string[] }[]> {
  const [{ data: sched }, { data: days }] = await Promise.all([
    supabase.from("workout_schedule").select("day_id, sort_order").eq("weekday", weekday).order("sort_order"),
    supabase.from("workout_days").select("id, name, muscle_groups, day_order, routine_id").order("day_order"),
  ]);

  const dayById = new Map((days ?? []).map((d) => [d.id, d]));

  if (sched && sched.length > 0) {
    return sched
      .map((s) => dayById.get(s.day_id))
      .filter((d): d is NonNullable<typeof d> => !!d)
      .map((d) => ({ name: d.name, muscles: (d.muscle_groups as string[] | null) ?? [] }));
  }

  // Sin horario: fallback al ciclo de la rutina activa.
  const { data: routines } = await supabase.from("workout_routines").select("id, active, sort_order").order("sort_order");
  const routine = (routines ?? []).find((r) => r.active) ?? (routines ?? [])[0] ?? null;
  if (!routine) return [];
  const dlist = (days ?? []).filter((d) => d.routine_id === routine.id);
  if (!dlist.length) return [];
  const { data: lastSess } = await supabase
    .from("workout_sessions").select("day_id").not("day_id", "is", null).order("date", { ascending: false }).limit(1);
  let suggested = dlist[0];
  const lastDayId = lastSess?.[0]?.day_id;
  if (lastDayId) {
    const idx = dlist.findIndex((d) => d.id === lastDayId);
    if (idx >= 0) suggested = dlist[(idx + 1) % dlist.length];
  }
  return [{ name: suggested.name, muscles: (suggested.muscle_groups as string[] | null) ?? [] }];
}

export type DayPlan = {
  items: PlanItem[];
  text: string; // serialización para el contexto de Shadow
};

// Construye el plan cronológico de HOY cruzando los módulos.
export async function buildDayPlan(supabase: DB, today: string): Promise<DayPlan> {
  const weekday = weekdayCDMX(today);
  const now = new Date(today + "T00:00:00");

  const [{ data: classes }, { data: courses }, { data: exams }, { data: assignments }, gym] = await Promise.all([
    supabase.from("class_schedule").select("course_id, day_of_week, start_time, end_time, room").eq("day_of_week", weekday),
    supabase.from("academic_courses").select("id, name").eq("active", true),
    supabase
      .from("grade_components")
      .select("name, date, course_id, difficulty, study_start_date, status")
      .eq("kind", "examen").neq("status", "done").gte("date", today).not("study_start_date", "is", null)
      .lte("study_start_date", today).order("date").limit(4),
    supabase.from("assignments").select("title, due_date, due_time, course_id, status").eq("due_date", today).neq("status", "done"),
    gymToday(supabase, weekday),
  ]);

  const courseName = new Map((courses ?? []).map((c) => [c.id, c.name]));
  const items: PlanItem[] = [];

  // ── Clases de hoy ────────────────────────────────────────────────────────
  for (const c of classes ?? []) {
    const meta = KIND_META.class;
    items.push({
      key: `class-${c.course_id}-${c.start_time}`,
      kind: "class",
      time: fmtTime(c.start_time),
      endTime: fmtTime(c.end_time),
      minutes: timeToMinutes(c.start_time),
      title: courseName.get(c.course_id) ?? "Clase",
      detail: c.room ? `Salón ${c.room}` : "",
      icon: meta.icon,
      tone: meta.tone,
      href: meta.href,
    });
  }

  // ── Gym de hoy ───────────────────────────────────────────────────────────
  for (const [i, g] of gym.entries()) {
    const meta = KIND_META.gym;
    items.push({
      key: `gym-${i}`,
      kind: "gym",
      time: null,
      endTime: null,
      minutes: null,
      title: g.name,
      detail: g.muscles.length ? g.muscles.slice(0, 3).join(", ") : "",
      icon: meta.icon,
      tone: meta.tone,
      href: meta.href,
    });
  }

  // ── Bloques de estudio (exámenes dentro de su ventana de estudio) ─────────
  for (const ex of exams ?? []) {
    const d = daysUntil(ex.date, now);
    if (d === null || d < 0) continue;
    const meta = KIND_META.study;
    const whenStr = d === 0 ? "examen hoy" : d === 1 ? "examen mañana" : `examen en ${d}d`;
    items.push({
      key: `study-${ex.course_id}-${ex.name}`,
      kind: "study",
      time: null,
      endTime: null,
      minutes: null,
      title: `Estudiar ${courseName.get(ex.course_id) ?? "materia"}`,
      detail: `${ex.name} · ${whenStr}`,
      icon: meta.icon,
      tone: d <= 1 ? "var(--red)" : meta.tone,
      href: meta.href,
    });
  }

  // ── Entregas de hoy ──────────────────────────────────────────────────────
  for (const a of assignments ?? []) {
    const meta = KIND_META.assignment;
    items.push({
      key: `assign-${a.course_id}-${a.title}`,
      kind: "assignment",
      time: fmtTime(a.due_time),
      endTime: null,
      minutes: timeToMinutes(a.due_time),
      title: a.title,
      detail: `${courseName.get(a.course_id) ?? "materia"} · entrega`,
      icon: meta.icon,
      tone: meta.tone,
      href: meta.href,
    });
  }

  // ── Eventos de Google Calendar de hoy ────────────────────────────────────
  try {
    const calendar = getCalendar();
    const startOfDay = new Date(today + "T00:00:00-06:00");
    const endOfDay = new Date(today + "T23:59:59-06:00");
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 20,
    });
    for (const ev of res.data.items ?? []) {
      const startIso = ev.start?.dateTime ?? ev.start?.date ?? null;
      const allDay = !ev.start?.dateTime;
      const when = startIso && !allDay ? new Date(startIso) : null;
      const time = when
        ? when.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Mexico_City" })
        : null;
      const meta = KIND_META.event;
      items.push({
        key: `ev-${ev.id}`,
        kind: "event",
        time,
        endTime: null,
        minutes: timeToMinutes(time),
        title: ev.summary ?? "Evento",
        detail: ev.location ?? "",
        icon: meta.icon,
        tone: meta.tone,
        href: meta.href,
      });
    }
  } catch {
    /* calendario no disponible — el plan sigue con el resto */
  }

  // Orden cronológico: con hora primero (por reloj), sin hora al final.
  items.sort((a, b) => (a.minutes ?? 9999) - (b.minutes ?? 9999));

  const text =
    items.length === 0
      ? "Sin compromisos en el plan de hoy."
      : items
          .map((it) => {
            const t = it.time ? `${it.time} ` : "— ";
            return `${t}· ${KIND_META[it.kind].label}: ${it.title}${it.detail ? ` (${it.detail})` : ""}`;
          })
          .join("\n");

  return { items, text };
}
