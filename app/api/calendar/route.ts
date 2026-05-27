import { google, type calendar_v3 } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

function getCalendar() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.calendar({ version: "v3", auth: client });
}

function serialize(ev: calendar_v3.Schema$Event) {
  return {
    id: ev.id,
    title: ev.summary ?? null,
    description: ev.description ?? null,
    start: ev.start?.dateTime ?? ev.start?.date ?? null,
    end: ev.end?.dateTime ?? ev.end?.date ?? null,
    allDay: !ev.start?.dateTime,
    location: ev.location ?? null,
    color: ev.colorId ?? null,
    htmlLink: ev.htmlLink ?? null,
  };
}

const TZ = "America/Mexico_City";

type EventBody = {
  id?: string;
  title?: string;
  description?: string | null;
  start?: string;
  end?: string;
  location?: string | null;
  color?: string | null;
  allDay?: boolean;
  recurrence?: string[] | null;
};

function toRequestBody(body: EventBody): calendar_v3.Schema$Event {
  const req: calendar_v3.Schema$Event = {};
  if (body.title !== undefined) req.summary = body.title;
  if (body.description !== undefined) req.description = body.description ?? "";
  if (body.location !== undefined) req.location = body.location ?? "";
  if (body.color !== undefined) req.colorId = body.color ?? undefined;
  if (body.recurrence !== undefined) req.recurrence = body.recurrence ?? undefined;
  if (body.start !== undefined && body.end !== undefined) {
    if (body.allDay) {
      req.start = { date: body.start.split("T")[0] };
      req.end = { date: body.end.split("T")[0] };
    } else {
      req.start = { dateTime: new Date(body.start).toISOString(), timeZone: TZ };
      req.end = { dateTime: new Date(body.end).toISOString(), timeZone: TZ };
    }
  }
  return req;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") ?? "7");

  try {
    const calendar = getCalendar();
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + days);

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 100,
    });

    return NextResponse.json({ events: (res.data.items ?? []).map(serialize) });
  } catch (err) {
    console.error("Calendar GET error:", err);
    return NextResponse.json({ error: "Failed to fetch calendar events" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as EventBody;
    if (!body.title || !body.start) {
      return NextResponse.json({ error: "Falta título o inicio" }, { status: 400 });
    }
    if (!body.end) {
      body.end = new Date(new Date(body.start).getTime() + 3600000).toISOString();
    }
    const calendar = getCalendar();
    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: toRequestBody(body),
    });
    return NextResponse.json({ event: serialize(res.data) });
  } catch (err) {
    console.error("Calendar POST error:", err);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as EventBody;
    if (!body.id) return NextResponse.json({ error: "Falta id del evento" }, { status: 400 });
    const calendar = getCalendar();
    const res = await calendar.events.patch({
      calendarId: "primary",
      eventId: body.id,
      requestBody: toRequestBody(body),
    });
    return NextResponse.json({ event: serialize(res.data) });
  } catch (err) {
    console.error("Calendar PATCH error:", err);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Falta id del evento" }, { status: 400 });
    const calendar = getCalendar();
    await calendar.events.delete({ calendarId: "primary", eventId: id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Calendar DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
