import Anthropic from "@anthropic-ai/sdk";
import { google } from "googleapis";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildReview, type Period } from "@/lib/shadow/review";
import type {
  Habit, Goal, GoalMilestone, FlouviaFollowup,
  HealthEntry, CreditCard, RecurringCharge,
  AcademicCourse, GradeComponent, FinancialEntry,
} from "@/lib/supabase/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const DAY = 86400000;

function mondayISO(now: Date): string {
  const d = new Date(now);
  const dow = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - dow);
  return d.toISOString().split("T")[0];
}

async function upcomingAgenda(lookAhead: number): Promise<string> {
  try {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const calendar = google.calendar({ version: "v3", auth: client });
    const now = new Date();
    const end = new Date(now.getTime() + lookAhead * DAY);
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 15,
    });
    const items = res.data.items ?? [];
    if (items.length === 0) return "- (sin eventos próximos)";
    return items
      .map((ev) => {
        const s = ev.start?.dateTime ?? ev.start?.date ?? null;
        const w = s ? new Date(s) : null;
        const t = w ? w.toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
        return `- ${t} ${ev.summary ?? "evento"}${ev.location ? ` @ ${ev.location}` : ""}`;
      })
      .join("\n");
  } catch {
    return "- (calendario no disponible)";
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const period: Period = body?.period === "month" ? "month" : "week";
  const refresh = body?.refresh === true;

  const supabase = await createClient();
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const trail = period === "week" ? 7 : 30;
  const lookAhead = period === "week" ? 10 : 35;
  const sinceStr = new Date(now.getTime() - (trail - 1) * DAY).toISOString().split("T")[0];
  const timeSince = new Date(now.getTime() - 2 * trail * DAY).toISOString();

  const cacheKey = period === "week" ? `review:week:${mondayISO(now)}` : `review:month:${today.slice(0, 7)}`;

  const [
    { data: prefs },
    { data: habits },
    { data: completions },
    { data: components },
    { data: courses },
    { data: cards },
    { data: recurring },
    { data: goals },
    { data: milestones },
    { data: followups },
    { data: clients },
    { data: timeLogs },
    { data: health },
    { data: entries },
    agenda,
  ] = await Promise.all([
    supabase.from("user_preferences").select("display_name").single(),
    supabase.from("habits").select("*").eq("active", true),
    supabase.from("habit_completions").select("habit_id, date").gte("date", sinceStr),
    supabase.from("grade_components").select("*"),
    supabase.from("academic_courses").select("*").eq("active", true),
    supabase.from("credit_cards").select("*").eq("active", true),
    supabase.from("recurring_charges").select("*").eq("active", true),
    supabase.from("goals").select("*").eq("status", "active"),
    supabase.from("goal_milestones").select("*"),
    supabase.from("flouvia_followups").select("*").eq("done", false),
    supabase.from("flouvia_clients").select("id, name"),
    supabase.from("time_logs").select("duration_minutes, category, started_at").gte("started_at", timeSince),
    supabase.from("health_entries").select("*").gte("date", sinceStr),
    supabase.from("financial_entries").select("*").gte("date", sinceStr),
    upcomingAgenda(lookAhead),
  ]);

  const clientName = new Map((clients ?? []).map((c) => [c.id, c.name]));

  const review = buildReview({
    period,
    today,
    now,
    habits: (habits ?? []) as Habit[],
    completions: completions ?? [],
    components: (components ?? []) as GradeComponent[],
    courses: (courses ?? []) as AcademicCourse[],
    cards: (cards ?? []) as CreditCard[],
    recurring: (recurring ?? []) as RecurringCharge[],
    goals: (goals ?? []) as Goal[],
    milestones: (milestones ?? []) as GoalMilestone[],
    followups: ((followups ?? []) as FlouviaFollowup[]).map((f) => ({ ...f, clientName: clientName.get(f.client_id) ?? null })),
    timeLogs: timeLogs ?? [],
    health: (health ?? []) as HealthEntry[],
    entries: (entries ?? []) as FinancialEntry[],
    agenda,
  });

  let verdict: string | null = null;
  let generatedAt: string | null = null;

  if (!refresh) {
    const { data: cached } = await supabase
      .from("shadow_cache")
      .select("content, generated_at")
      .eq("key", cacheKey)
      .single();
    if (cached?.content) {
      verdict = cached.content;
      generatedAt = cached.generated_at;
    }
  }

  if (!verdict) {
    const periodWord = period === "week" ? "SEMANAL" : "MENSUAL";
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: `Eres Shadow, el Jarvis personal de ${prefs?.display_name ?? "André"}. Escribe el CIERRE ${periodWord}: un veredicto único que cruza TODOS sus módulos (hábitos, metas, finanzas, tiempo, academia, salud, Flouvia) en español. Te doy una lista YA RANKEADA por urgencia × severidad × peso del módulo — respétala: lo de arriba pesa más que lo de abajo (un examen difícil el viernes pesa más que un follow-up). Estructura en 3 bloques con estos encabezados exactos en negrita markdown:
**Qué necesita tu atención** (2-3 frases: nombra lo #1 y por qué supera al resto; agrupa lo demás. Sé específico con cifras/fechas reales).
**El período** (1-2 frases: lectura cruzada del roll-up — cómo viene la semana/mes en conjunto, qué módulo jala y cuál arrastra).
**Movimientos** (3-4 acciones concretas y priorizadas, en orden, que atacan lo de arriba primero).
Sin saludos, sin relleno, sin "¡Claro!". Directo y útil. Usa solo los datos que te doy; si no hay nada urgente, dilo y felicítalo en una frase.`,
      messages: [{ role: "user", content: `Estos son mis datos del cierre ${period === "week" ? "de la semana" : "del mes"}:\n\n${review.context}` }],
    });
    verdict = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    generatedAt = new Date().toISOString();
    await supabase
      .from("shadow_cache")
      .upsert({ key: cacheKey, content: verdict, metadata: null, generated_at: generatedAt }, { onConflict: "key" });
  }

  return NextResponse.json({
    verdict,
    items: review.items,
    rollup: review.rollup,
    rangeLabel: review.rangeLabel,
    period,
    generatedAt,
  });
}
