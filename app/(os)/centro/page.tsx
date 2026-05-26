import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Calendar, CheckSquare, DollarSign, Brain, Target, Briefcase,
  Dumbbell, HeartPulse, GraduationCap, Clock, BookOpen, ArrowRight,
} from "lucide-react";
import { formatCurrency, todayISO } from "@/lib/utils";
import { weightStats } from "@/lib/salud/health";
import { daysUntil } from "@/lib/academia/grades";
import { fmtHours } from "@/lib/tiempo/categories";
import type { WeightLog } from "@/lib/supabase/types";

export const revalidate = 0;

export default async function CentroPage() {
  const supabase = await createClient();
  const today = todayISO();
  const since90 = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];

  const [
    { data: habits },
    { data: completions },
    { data: banks },
    { data: notes },
    { data: goals },
    { data: flouviaClients },
    { data: routines },
    { data: days },
    { data: lastSess },
    { data: courses },
    { data: nextExam },
    { data: weights },
    { data: timeLogs },
    { data: reading },
  ] = await Promise.all([
    supabase.from("habits").select("id").eq("active", true),
    supabase.from("habit_completions").select("habit_id").eq("date", today),
    supabase.from("bank_accounts").select("current_balance").eq("active", true),
    supabase.from("brain_notes").select("id"),
    supabase.from("goals").select("id").eq("status", "active"),
    supabase.from("flouvia_clients").select("monthly_value").eq("status", "activo"),
    supabase.from("workout_routines").select("id, name, active").order("sort_order"),
    supabase.from("workout_days").select("id, name, day_order, routine_id").order("day_order"),
    supabase.from("workout_sessions").select("day_id, date").not("day_id", "is", null).order("date", { ascending: false }).limit(1),
    supabase.from("academic_courses").select("grade").eq("active", true),
    supabase.from("grade_components").select("name, date, course_id").eq("kind", "examen").neq("status", "done").gte("date", today).order("date").limit(1),
    supabase.from("weight_logs").select("*").gte("date", since90).order("date", { ascending: true }),
    supabase.from("time_logs").select("duration_minutes").gte("started_at", `${today}T00:00:00-06:00`),
    supabase.from("reading_items").select("title").eq("status", "reading").order("added_at", { ascending: false }),
  ]);

  const totalHabits = habits?.length ?? 0;
  const doneHabits = completions?.length ?? 0;
  const habitsPct = totalHabits > 0 ? Math.round((doneHabits / totalHabits) * 100) : 0;
  const totalBanks = (banks ?? []).reduce((a, b) => a + (b.current_balance ?? 0), 0);
  const activeGoals = goals?.length ?? 0;
  const flouviaMRR = (flouviaClients ?? []).reduce((a, c) => a + (c.monthly_value ?? 0), 0);

  // Gym — hoy toca (siguiente día del ciclo tras la última sesión)
  const routine = (routines ?? []).find((r) => r.active) ?? (routines ?? [])[0] ?? null;
  let gymToday: string | null = null;
  if (routine) {
    const dlist = (days ?? []).filter((d) => d.routine_id === routine.id);
    let suggested = dlist[0] ?? null;
    const lastDayId = lastSess?.[0]?.day_id;
    if (lastDayId && dlist.length) {
      const idx = dlist.findIndex((d) => d.id === lastDayId);
      if (idx >= 0) suggested = dlist[(idx + 1) % dlist.length];
    }
    gymToday = suggested?.name ?? null;
  }

  // GPA proyectado = promedio de las calificaciones registradas
  const grades = (courses ?? []).map((c) => c.grade).filter((g): g is number => typeof g === "number");
  const gpa = grades.length ? Math.round((grades.reduce((a, b) => a + b, 0) / grades.length) * 100) / 100 : null;
  const exam = (nextExam ?? [])[0];
  const examDays = exam?.date ? daysUntil(exam.date, new Date(today + "T00:00:00")) : null;

  // Salud — peso (serie para sparkline + delta)
  const w = weightStats((weights ?? []) as WeightLog[]);
  const weightSeries = (weights ?? []).map((x) => x.weight_kg);

  const tiempoHoy = (timeLogs ?? []).reduce((a, l) => a + (l.duration_minutes ?? 0), 0);
  const readingCount = (reading ?? []).length;
  const readingTitle = (reading ?? [])[0]?.title ?? null;

  const dateLabel = new Date().toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow mb-2">01 · COCKPIT</p>
            <h1 className="page-title">Centro.</h1>
          </div>
          <p className="tick" style={{ marginTop: 6, textTransform: "capitalize" }}>
            {dateLabel}
          </p>
        </div>
      </div>

      <div className="page-body">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {/* Hábitos — anillo de progreso */}
          <Widget href="/habitos" label="Hábitos" icon={CheckSquare} color="var(--green)"
            stat={totalHabits > 0 ? `${doneHabits} / ${totalHabits} hoy` : "Sin hábitos"}
            indicator={totalHabits > 0 ? <Ring pct={habitsPct} color="var(--green)" /> : undefined}
          />

          {/* Calendario */}
          <Widget href="/calendario" label="Calendario" icon={Calendar} color="var(--gold)" stat="Ver agenda de hoy" />

          {/* Gym — hoy toca */}
          <Widget href="/gym" label="Gym" icon={Dumbbell} color="#5FB97A"
            stat={gymToday ? `Hoy toca: ${gymToday}` : "Configura tu rutina"} />

          {/* Panamericana — GPA + próximo examen */}
          <Widget href="/panamericana" label="Panamericana" icon={GraduationCap} color="#6BA8E5"
            stat={examDays != null ? `Examen en ${examDays}d` : gpa != null ? `GPA ${gpa.toFixed(2)}` : "Ver materias"}
            value={gpa != null ? gpa.toFixed(2) : undefined}
            valueLabel={gpa != null ? "GPA" : undefined}
          />

          {/* Salud — sparkline de peso */}
          <Widget href="/salud" label="Salud" icon={HeartPulse} color="#E56B8A"
            stat={w ? `${w.current}kg${w.count > 1 ? ` · ${w.delta > 0 ? "+" : ""}${w.delta}kg` : ""}` : "Sin registros"}
            indicator={weightSeries.length > 1 ? <Sparkline data={weightSeries} color="#E56B8A" /> : undefined}
          />

          {/* Tiempo — horas de hoy */}
          <Widget href="/tiempo" label="Tiempo" icon={Clock} color="#9B7DE5"
            stat={tiempoHoy > 0 ? "registrado hoy" : "Sin registrar"}
            value={fmtHours(tiempoHoy)}
            valueLabel="hoy"
          />

          {/* Finanzas */}
          <Widget href="/finanzas" label="Finanzas" icon={DollarSign} color="var(--bone-dim)"
            stat={totalBanks > 0 ? `${formatCurrency(totalBanks)} disponible` : "Ver cuentas"} />

          {/* Metas */}
          <Widget href="/metas" label="Metas" icon={Target} color="var(--red)"
            stat={activeGoals > 0 ? `${activeGoals} activa${activeGoals > 1 ? "s" : ""}` : "Sin metas"} />

          {/* Flouvia */}
          <Widget href="/flouvia" label="Flouvia" icon={Briefcase} color="var(--blue)"
            stat={flouviaMRR > 0 ? `${formatCurrency(flouviaMRR)}/mo MRR` : "Ver clientes"} />

          {/* Lectura */}
          <Widget href="/lectura" label="Lectura" icon={BookOpen} color="#E5A86B"
            stat={readingTitle ?? (readingCount > 0 ? `${readingCount} leyendo` : "Lista vacía")} />

          {/* Brain */}
          <Widget href="/brain" label="Brain" icon={Brain} color="var(--violet)"
            stat={`${notes?.length ?? 0} notas`} />
        </div>
      </div>
    </div>
  );
}

function Widget({
  href, label, icon: Icon, color, stat, value, valueLabel, indicator,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  color: string;
  stat: string;
  value?: string;
  valueLabel?: string;
  indicator?: React.ReactNode;
}) {
  return (
    <Link href={href} className="card hover:no-underline group" style={{ textDecoration: "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, minHeight: 28 }}>
        <Icon size={16} style={{ color }} />
        {indicator ?? <ArrowRight size={12} style={{ color: "var(--mute-2)" }} />}
      </div>
      <p style={{ fontFamily: "var(--f-serif)", fontSize: 19, color: "var(--bone)", lineHeight: 1.2 }}>{label}</p>
      {value ? (
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6 }}>
          <span style={{ fontFamily: "var(--f-mono)", fontSize: 20, color: "var(--bone)" }}>{value}</span>
          {valueLabel && <span className="tick">{valueLabel}</span>}
        </div>
      ) : null}
      <p className="tick mt-2">{stat}</p>
    </Link>
  );
}

// Anillo de progreso compacto (top-right de la tarjeta)
function Ring({ pct, color }: { pct: number; color: string }) {
  const r = 11;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return (
    <svg width={28} height={28} viewBox="0 0 28 28" style={{ transform: "rotate(-90deg)" }}>
      <circle cx={14} cy={14} r={r} fill="none" stroke="var(--line-2)" strokeWidth={3} />
      <circle cx={14} cy={14} r={r} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} />
    </svg>
  );
}

// Mini-sparkline (peso)
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const W = 52, H = 22;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = data.length === 1 ? W / 2 : (i / (data.length - 1)) * W;
    const y = H - 2 - ((v - min) / span) * (H - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
