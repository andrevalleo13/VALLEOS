"use client";
import { useMemo, useState } from "react";
import { Dumbbell, TrendingUp, TrendingDown, Activity, Calendar, Trophy } from "lucide-react";
import type {
  WorkoutRoutine, WorkoutDay, WorkoutExercise, WorkoutSession, WorkoutSet,
} from "@/lib/supabase/types";
import { MUSCLES, muscleLabel, normalizeMuscle, type MuscleKey } from "@/lib/gym/muscles";
import { MuscleMap, type MuscleStat } from "@/components/gym/MuscleMap";
import { LogSession } from "./LogSession";
import { RoutineEditor } from "./RoutineEditor";

const iso = (d: Date) => d.toISOString().split("T")[0];
const TODAY = iso(new Date());
const daysAgoISO = (n: number) => iso(new Date(Date.now() - n * 86400000));

function fmtVol(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)}kg`;
}

type Props = {
  routines: WorkoutRoutine[];
  days: WorkoutDay[];
  exercises: WorkoutExercise[];
  sessions: WorkoutSession[];
  sets: WorkoutSet[];
};

export function GymClient({ routines, days, exercises, sessions, sets }: Props) {
  const [period, setPeriod] = useState<7 | 30>(7);

  const activeRoutine = routines.find((r) => r.active) ?? routines[0] ?? null;
  const routineDays = useMemo(
    () => days.filter((d) => d.routine_id === activeRoutine?.id).sort((a, b) => a.day_order - b.day_order),
    [days, activeRoutine]
  );

  // session id -> date
  const sessionDate = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of sessions) m[s.id] = s.date;
    return m;
  }, [sessions]);

  // Período actual y anterior
  const winStart = daysAgoISO(period - 1);
  const prevStart = daysAgoISO(period * 2 - 1);
  const prevEnd = daysAgoISO(period);

  const setsIn = (from: string, to: string) =>
    sets.filter((s) => {
      const d = sessionDate[s.session_id];
      return d && d >= from && d <= to;
    });

  const curSets = useMemo(() => setsIn(winStart, TODAY), [sets, sessionDate, winStart]);
  const prevSets = useMemo(() => setsIn(prevStart, prevEnd), [sets, sessionDate, prevStart, prevEnd]);

  const volume = (arr: WorkoutSet[]) =>
    arr.reduce((a, s) => a + (s.weight_kg ?? 0) * (s.reps ?? 0), 0);

  const curVol = volume(curSets);
  const prevVol = volume(prevSets);
  const volDelta = prevVol > 0 ? Math.round(((curVol - prevVol) / prevVol) * 100) : null;

  const sessionsInWindow = sessions.filter((s) => s.date >= winStart && s.date <= TODAY);

  // Mapa muscular: series por músculo en el período
  const muscleData = useMemo(() => {
    const counts: Partial<Record<MuscleKey, number>> = {};
    for (const s of curSets) {
      const m = normalizeMuscle(s.muscle_group);
      if (!m) continue;
      counts[m] = (counts[m] ?? 0) + 1;
    }
    const max = Math.max(1, ...Object.values(counts));
    const data: Partial<Record<MuscleKey, MuscleStat>> = {};
    for (const m of MUSCLES) {
      const sets = counts[m.key] ?? 0;
      data[m.key] = { sets, intensity: sets / max };
    }
    return data;
  }, [curSets]);

  const muscleBars = useMemo(
    () =>
      MUSCLES.map((m) => ({ ...m, sets: muscleData[m.key]?.sets ?? 0 }))
        .filter((m) => m.sets > 0)
        .sort((a, b) => b.sets - a.sets),
    [muscleData]
  );
  const maxBar = Math.max(1, ...muscleBars.map((m) => m.sets));

  // PRs este mes (peso máximo por ejercicio supera el histórico previo)
  const prCount = useMemo(() => {
    const monthStart = TODAY.slice(0, 7) + "-01";
    const byEx: Record<string, { before: number; month: number }> = {};
    for (const s of sets) {
      if (s.weight_kg == null) continue;
      const d = sessionDate[s.session_id];
      if (!d) continue;
      const key = s.exercise_name.toLowerCase();
      byEx[key] ??= { before: 0, month: 0 };
      if (d >= monthStart) byEx[key].month = Math.max(byEx[key].month, s.weight_kg);
      else byEx[key].before = Math.max(byEx[key].before, s.weight_kg);
    }
    return Object.values(byEx).filter((e) => e.month > e.before && e.before > 0).length;
  }, [sets, sessionDate]);

  // Volumen por semana (8 semanas)
  const weekly = useMemo(() => {
    const weeks: { label: string; vol: number }[] = [];
    for (let w = 7; w >= 0; w--) {
      const start = daysAgoISO(w * 7 + 6);
      const end = daysAgoISO(w * 7);
      const vol = volume(setsIn(start, end));
      weeks.push({ label: w === 0 ? "Ahora" : `-${w}s`, vol });
    }
    return weeks;
  }, [sets, sessionDate]);
  const maxWeekly = Math.max(1, ...weekly.map((w) => w.vol));

  // Progresión: top ejercicios por frecuencia, peso máx por fecha
  const progression = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const s of sets) freq[s.exercise_name] = (freq[s.exercise_name] ?? 0) + 1;
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 4).map((e) => e[0]);
    return top.map((name) => {
      const byDate: Record<string, number> = {};
      for (const s of sets) {
        if (s.exercise_name !== name || s.weight_kg == null) continue;
        const d = sessionDate[s.session_id];
        if (!d) continue;
        byDate[d] = Math.max(byDate[d] ?? 0, s.weight_kg);
      }
      const points = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0])).map((e) => e[1]);
      const first = points[0] ?? 0;
      const last = points[points.length - 1] ?? 0;
      return { name, points, first, last, delta: last - first };
    }).filter((p) => p.points.length > 0);
  }, [sets, sessionDate]);

  // Día sugerido hoy (siguiente en el ciclo tras la última sesión)
  const suggestedDay = useMemo(() => {
    if (routineDays.length === 0) return null;
    const lastWithDay = sessions.find((s) => s.day_id && routineDays.some((d) => d.id === s.day_id));
    if (!lastWithDay) return routineDays[0];
    const idx = routineDays.findIndex((d) => d.id === lastWithDay.day_id);
    return routineDays[(idx + 1) % routineDays.length];
  }, [routineDays, sessions]);

  const suggestedExercises = exercises
    .filter((e) => e.day_id === suggestedDay?.id)
    .sort((a, b) => a.sort_order - b.sort_order);

  // Historial: sesiones con sus series agrupadas por ejercicio
  const setsBySession = useMemo(() => {
    const m: Record<string, WorkoutSet[]> = {};
    for (const s of sets) (m[s.session_id] ??= []).push(s);
    return m;
  }, [sets]);

  const empty = routines.length === 0;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <p className="eyebrow mb-2">11 · ENTRENAMIENTO</p>
            <h1 className="page-title">Gym.</h1>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <RoutineEditor routines={routines} days={days} exercises={exercises} />
            <LogSession routines={routines} days={days} exercises={exercises} suggestedDayId={suggestedDay?.id ?? null} />
          </div>
        </div>
      </div>

      <div className="page-body">
        {empty ? (
          <div className="card text-center py-12">
            <Dumbbell size={32} style={{ color: "var(--mute-2)", margin: "0 auto 12px" }} />
            <p style={{ color: "var(--mute)", fontSize: 15 }}>Sin rutina configurada.</p>
            <p className="tick mt-1 mb-4">Crea tu rutina (Push/Pull/Legs, Upper/Lower…) para empezar a registrar.</p>
            <RoutineEditor routines={routines} days={days} exercises={exercises} label="Crear rutina" primary />
          </div>
        ) : (
          <>
            {/* Stats strip */}
            <div className="hb-stats mb-6">
              <div className="hb-stat">
                <span className="v" style={{ color: "var(--bone)" }}>
                  <Activity size={18} style={{ color: "var(--gold)" }} /> {sessionsInWindow.length}
                </span>
                <span className="l">Sesiones · {period}d</span>
              </div>
              <div className="hb-stat">
                <span className="v" style={{ color: "var(--bone)" }}>{fmtVol(curVol)}</span>
                <span className="l">Volumen · {period}d</span>
              </div>
              <div className="hb-stat">
                <span className="v" style={{ color: volDelta == null ? "var(--bone)" : volDelta >= 0 ? "var(--green)" : "var(--red)", display: "flex", alignItems: "center", gap: 6 }}>
                  {volDelta != null && (volDelta >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />)}
                  {volDelta == null ? "—" : `${volDelta > 0 ? "+" : ""}${volDelta}%`}
                </span>
                <span className="l">vs período previo</span>
              </div>
              <div className="hb-stat">
                <span className="v" style={{ color: "var(--bone)" }}>{curSets.length}</span>
                <span className="l">Series · {period}d</span>
              </div>
              <div className="hb-stat">
                <span className="v" style={{ color: prCount > 0 ? "var(--gold)" : "var(--bone)" }}>
                  <Trophy size={16} style={{ color: "var(--gold-2)" }} /> {prCount}
                </span>
                <span className="l">PRs del mes</span>
              </div>
            </div>

            {/* Hoy + período */}
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 20, alignItems: "start", marginBottom: 24 }}>
              {/* Día de rutina sugerido */}
              <div className="card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <p className="eyebrow">Hoy toca</p>
                  <span className="tick">{activeRoutine?.name}</span>
                </div>
                {suggestedDay ? (
                  <>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
                      <h2 style={{ fontFamily: "var(--f-serif)", fontSize: 26, color: "var(--bone)" }}>{suggestedDay.name}</h2>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {suggestedDay.muscle_groups.map((m) => (
                          <span key={m} className="tag" style={{ fontSize: 9 }}>{muscleLabel(m)}</span>
                        ))}
                      </div>
                    </div>
                    <div className="gym-ex-list">
                      {suggestedExercises.map((e) => (
                        <div key={e.id} className="gym-ex-row">
                          <span className="gym-ex-name">{e.name}</span>
                          <span className="gym-ex-target">{e.target_sets}×{e.target_reps ?? "—"}</span>
                        </div>
                      ))}
                      {suggestedExercises.length === 0 && (
                        <p className="tick">Este día no tiene ejercicios. Edítalo en la rutina.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="tick">Sin días en la rutina activa.</p>
                )}
              </div>

              {/* Mapa muscular */}
              <div className="card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <p className="eyebrow">Músculos trabajados</p>
                  <div className="seg">
                    <button className={`seg-btn${period === 7 ? " on" : ""}`} onClick={() => setPeriod(7)}>Semana</button>
                    <button className={`seg-btn${period === 30 ? " on" : ""}`} onClick={() => setPeriod(30)}>Mes</button>
                  </div>
                </div>
                <MuscleMap data={muscleData} />
              </div>
            </div>

            {/* Análisis: volumen por músculo */}
            <div className="card mb-6">
              <p className="eyebrow mb-4">Volumen por músculo · {period === 7 ? "semana" : "mes"}</p>
              {muscleBars.length === 0 ? (
                <p className="tick">Sin series registradas en este período.</p>
              ) : (
                <div className="gym-bars">
                  {muscleBars.map((m) => (
                    <div key={m.key} className="gym-bar-row">
                      <span className="gym-bar-label">{m.label}</span>
                      <div className="gym-bar-track">
                        <div className="gym-bar-fill" style={{ width: `${(m.sets / maxBar) * 100}%` }} />
                      </div>
                      <span className="gym-bar-val">{m.sets}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Progresión + volumen semanal */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
              <div className="card">
                <p className="eyebrow mb-4">Progresión · peso máx</p>
                {progression.length === 0 ? (
                  <p className="tick">Registra peso en tus series para ver progresión.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {progression.map((p) => (
                      <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 120, flexShrink: 0 }}>
                          <p style={{ fontSize: 13, color: "var(--bone)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</p>
                          <p className="tick" style={{ color: p.delta > 0 ? "var(--green)" : p.delta < 0 ? "var(--red)" : "var(--mute)" }}>
                            {p.delta > 0 ? "+" : ""}{p.delta}kg
                          </p>
                        </div>
                        <Spark points={p.points} />
                        <span style={{ fontFamily: "var(--f-mono)", fontSize: 13, color: "var(--bone)", width: 48, textAlign: "right", flexShrink: 0 }}>
                          {p.last}kg
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card">
                <p className="eyebrow mb-4">Volumen semanal · 8 semanas</p>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 130 }}>
                  {weekly.map((w, i) => {
                    const pct = (w.vol / maxWeekly) * 100;
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        <span className="tick" style={{ fontSize: 9 }}>{w.vol > 0 ? fmtVol(w.vol) : ""}</span>
                        <div
                          title={fmtVol(w.vol)}
                          style={{
                            width: "100%",
                            height: `${Math.max(pct, w.vol > 0 ? 6 : 2)}%`,
                            background: i === weekly.length - 1 ? "linear-gradient(180deg, var(--gold), var(--gold-2))" : "var(--line-2)",
                            borderRadius: "4px 4px 0 0",
                            minHeight: 4,
                            transition: "height 0.5s var(--ease)",
                          }}
                        />
                        <span className="tick" style={{ fontSize: 9 }}>{w.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Historial */}
            <p className="eyebrow mb-4">Historial reciente</p>
            {sessions.length === 0 ? (
              <div className="card text-center py-10">
                <p className="tick">Aún no registras sesiones. Usa “Registrar sesión”.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sessions.slice(0, 12).map((s) => {
                  const ss = setsBySession[s.id] ?? [];
                  const vol = volume(ss);
                  const exNames = Array.from(new Set(ss.map((x) => x.exercise_name)));
                  return (
                    <div key={s.id} className="card" style={{ padding: "14px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--gold)", flexShrink: 0 }} />
                        <span style={{ fontSize: 14, color: "var(--bone)", fontFamily: "var(--f-serif)" }}>{s.day_name ?? "Sesión"}</span>
                        <span className="tick" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Calendar size={11} /> {new Date(s.date + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                        </span>
                        <span style={{ flex: 1 }} />
                        {s.duration_minutes && <span className="tag" style={{ fontSize: 10 }}>{s.duration_minutes}min</span>}
                        <span className="tag tag-gold" style={{ fontSize: 10 }}>{ss.length} series</span>
                        {vol > 0 && <span className="tag" style={{ fontSize: 10 }}>{fmtVol(vol)}</span>}
                      </div>
                      {exNames.length > 0 && (
                        <p className="tick" style={{ marginTop: 8, paddingLeft: 20 }}>
                          {exNames.slice(0, 6).join(" · ")}{exNames.length > 6 ? "…" : ""}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Spark({ points }: { points: number[] }) {
  if (points.length < 2) {
    return <div style={{ flex: 1, height: 32, display: "flex", alignItems: "center" }}><span className="tick">—</span></div>;
  }
  const w = 100, h = 32;
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - ((p - min) / range) * (h - 4) - 2).toFixed(1)}`)
    .join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ flex: 1, height: 32 }}>
      <path d={d} fill="none" stroke={up ? "var(--green)" : "var(--red)"} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
