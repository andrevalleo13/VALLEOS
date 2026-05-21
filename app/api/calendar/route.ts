import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

function getOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return client;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") ?? "7");

  try {
    const auth = getOAuth2Client();
    const calendar = google.calendar({ version: "v3", auth });

    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + days);

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 50,
    });

    const events = (res.data.items ?? []).map((ev) => ({
      id: ev.id,
      title: ev.summary,
      description: ev.description,
      start: ev.start?.dateTime ?? ev.start?.date,
      end: ev.end?.dateTime ?? ev.end?.date,
      location: ev.location,
      color: ev.colorId,
    }));

    return NextResponse.json({ events });
  } catch (err) {
    console.error("Calendar API error:", err);
    return NextResponse.json({ error: "Failed to fetch calendar events" }, { status: 500 });
  }
}
