"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Orb } from "@/components/Orb";
import {
  ArrowRight, Check, Plus, X, RefreshCw, Pencil,
  Dumbbell, GraduationCap, CreditCard, Flag, Briefcase, Clock, BookOpen, Sparkles,
  CalendarClock, Zap, AlertTriangle, TrendingDown, Layers,
} from "lucide-react";
import type { RadarItem } from "@/lib/brief/today";
import type { PlanItem } from "@/lib/brief/plan";
import type { CrossInsight } from "@/lib/brief/insights";
import { fmtHours } from "@/lib/tiempo/categories";

type Priority = { id: string; text: string; completed: boolean };
type Habit = { id: string; name: string };

const RADAR_ICONS = { Dumbbell, GraduationCap, CreditCard, Flag, Briefcase } as const;
const PLAN_ICONS = { GraduationCap, Dumbbell, BookOpen, Flag, CalendarClock, Clock } as const;
const INSIGHT_ICONS = { Zap, AlertTriangle, TrendingDown, CreditCard, Layers } as const;

export function BriefClient({
  today,
  greetingText,
  dateStr,
  displayName,
  visionPrimary,
  visionSecondary,
  initialBrief,
  initialFocus,
  initialPriorities,
  habits,
  initialDoneHabitIds,
  totalBalance,
  monthIncome,
  monthExpenses,
  radar,
  tiempoHoy,
  libro,
  plan,
  insights,
}: {
  today: string;
  greetingText: string;
  dateStr: string;
  displayName: string;
  visionPrimary: string | null;
  visionSecondary: string | null;
  initialBrief: string | null;
  initialFocus: string | null;
  initialPriorities: Priority[];
  habits: Habit[];
  initialDoneHabitIds: string[];
  totalBalance: number;
  monthIncome: number;
  monthExpenses: number;
  radar: RadarItem[];
  tiempoHoy: number;
  libro: { title: string; current: number | null; total: number | null; pct: number | null } | null;
  plan: PlanItem[];
  insights: CrossInsight[];
}) {
  const supabase = createClient();

  const [brief, setBrief] = useState(initialBrief);
  const [briefLoading, setBriefLoading] = useState(false);

  const [focus, setFocus] = useState(initialFocus ?? "");
  const [editingFocus, setEditingFocus] = useState(false);
  const [focusDraft, setFocusDraft] = useState(initialFocus ?? "");

  const [priorities, setPriorities] = useState<Priority[]>(initialPriorities);
  const [newPriority, setNewPriority] = useState("");

  const [doneHabits, setDoneHabits] = useState<Set<string>>(new Set(initialDoneHabitIds));

  async function regenerateBrief() {
    setBriefLoading(true);
    try {
      const res = await fetch("/api/shadow/brief", { method: "POST" });
      const { content } = await res.json();
      if (content) setBrief(content);
    } catch {
      /* noop */
    } finally {
      setBriefLoading(false);
    }
  }

  async function saveFocus() {
    const value = focusDraft.trim();
    setFocus(value);
    setEditingFocus(false);
    await supabase.from("daily_notes").upsert({ date: today, focus: value }, { onConflict: "date" });
  }

  async function togglePriority(p: Priority) {
    const next = !p.completed;
    setPriorities((prev) => prev.map((x) => (x.id === p.id ? { ...x, completed: next } : x)));
    await supabase.from("priorities").update({ completed: next }).eq("id", p.id);
  }

  async function addPriority() {
    const text = newPriority.trim();
    if (!text) return;
    setNewPriority("");
    const { data } = await supabase
      .from("priorities")
      .insert({ text, date: today, completed: false })
      .select("id, text, completed")
      .single();
    if (data) setPriorities((prev) => [...prev, data]);
  }

  async function deletePriority(id: string) {
    setPriorities((prev) => prev.filter((x) => x.id !== id));
    await supabase.from("priorities").delete().eq("id", id);
  }

  async function toggleHabit(id: string) {
    const isDone = doneHabits.has(id);
    setDoneHabits((prev) => {
      const next = new Set(prev);
      if (isDone) next.delete(id);
      else next.add(id);
      return next;
    });
    if (isDone) {
      await supabase.from("habit_completions").delete().eq("habit_id", id).eq("date", today);
    } else {
      await supabase
        .from("habit_completions")
        .insert({ habit_id: id, date: today, value: null, frozen: false });
    }
  }

  const habitsTotal = habits.length;
  const habitsDone = habits.filter((h) => doneHabits.has(h.id)).length;
  const habitsPct = habitsTotal > 0 ? Math.round((habitsDone / habitsTotal) * 100) : 0;
  const prioDone = priorities.filter((p) => p.completed).length;
  const net = monthIncome - monthExpenses;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow mb-2">00 · BRIEF</p>
            <h1 style={{ fontFamily: "var(--f-serif)", fontSize: 38, color: "var(--bone)", lineHeight: 1.05 }}>
              {greetingText}, <em style={{ color: "var(--gold)", fontStyle: "italic" }}>{displayName}</em>.
            </h1>
          </div>
          <div style={{ textAlign: "right", marginTop: 4 }}>
            <p className="tick" style={{ textTransform: "capitalize" }}>{dateStr}</p>
            {visionPrimary && (
              <p style={{ color: "var(--mute)", fontFamily: "var(--f-mono)", fontSize: 11, marginTop: 4, maxWidth: 260 }}>
                {visionPrimary}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="page-body" style={{ paddingBottom: 0 }}>
        <div className="kpi-strip">
          <KPI label="Hábitos hoy" value={`${habitsDone}/${habitsTotal}`} accent={habitsTotal > 0 && habitsDone === habitsTotal ? "var(--green)" : undefined} />
          <KPI label="Prioridades" value={`${prioDone}/${priorities.length}`} />
          <KPI label="Saldo MXN" value={totalBalance > 0 ? formatCurrency(totalBalance) : "—"} />
          <KPI label="Neto del mes" value={net !== 0 ? `${net > 0 ? "+" : ""}${formatCurrency(net)}` : "—"} accent={net > 0 ? "var(--green)" : net < 0 ? "var(--red)" : undefined} />
        </div>
      </div>

      {/* Insights cruzados — lo que Shadow detecta entre módulos */}
      {insights.length > 0 && (
        <div className="page-body" style={{ paddingBottom: 0 }}>
          <div
            className="card"
            style={{
              borderColor: "var(--violet)",
              background: "color-mix(in srgb, var(--violet) 6%, transparent)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Zap size={13} style={{ color: "var(--violet)" }} />
              <p className="eyebrow" style={{ color: "var(--violet)" }}>Shadow detecta</p>
            </div>
            {insights.map((ins) => {
              const Icon = INSIGHT_ICONS[ins.icon];
              return (
                <Link
                  key={ins.key}
                  href={ins.href}
                  style={{ display: "flex", gap: 10, alignItems: "flex-start", textDecoration: "none" }}
                >
                  <Icon size={14} style={{ color: ins.tone, flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: 13, color: "var(--bone-dim)", lineHeight: 1.5 }}>{ins.text}</p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Atender hoy — radar accionable */}
      <div className="page-body" style={{ paddingBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <p className="eyebrow">Atender hoy</p>
          {radar.some((r) => r.urgent) && (
            <span className="tick" style={{ color: "var(--red)" }}>
              {radar.filter((r) => r.urgent).length} urgente{radar.filter((r) => r.urgent).length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {radar.length === 0 ? (
          <div className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Sparkles size={16} style={{ color: "var(--green)" }} />
            <p style={{ fontSize: 13, color: "var(--bone-dim)" }}>
              Nada urgente en el radar. Día despejado — concéntrate en tu intención.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {radar.map((item) => {
              const Icon = RADAR_ICONS[item.icon];
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="card"
                  style={{
                    textDecoration: "none",
                    padding: 14,
                    display: "flex",
                    gap: 11,
                    alignItems: "flex-start",
                    borderColor: item.urgent ? item.tone : "var(--glass-bd)",
                    background: item.urgent ? `color-mix(in srgb, ${item.tone} 7%, transparent)` : undefined,
                  }}
                >
                  <span
                    style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      display: "grid", placeItems: "center",
                      background: `color-mix(in srgb, ${item.tone} 14%, transparent)`,
                      color: item.tone,
                    }}
                  >
                    <Icon size={14} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className="eyebrow" style={{ color: item.tone, marginBottom: 3 }}>{item.label}</p>
                    <p style={{ fontSize: 12.5, color: "var(--bone-dim)", lineHeight: 1.45 }}>{item.detail}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Two-column body */}
      <div className="page-body r-split">
        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Shadow brief */}
          <div className="card live" style={{ borderColor: "var(--gold)", background: "rgba(201,163,95,0.06)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <Orb size={40} state={briefLoading ? "thinking" : "idle"} style={{ marginTop: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <p className="eyebrow-gold">Shadow · Brief del día</p>
                  <button
                    className="tb-btn"
                    onClick={regenerateBrief}
                    disabled={briefLoading}
                    title="Regenerar brief"
                    style={{ width: 26, height: 26 }}
                  >
                    <RefreshCw size={13} className={briefLoading ? "spin" : ""} />
                  </button>
                </div>
                <p style={{ color: "var(--bone-dim)", fontSize: 14, lineHeight: 1.7, marginTop: 6, whiteSpace: "pre-wrap" }}>
                  {briefLoading
                    ? "Shadow está analizando tu día…"
                    : brief ?? "Aún no hay brief de hoy. Pídele a Shadow que lo genere."}
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {!brief && !briefLoading && (
                    <button className="btn btn-primary btn-sm" onClick={regenerateBrief}>
                      Generar brief <ArrowRight size={13} />
                    </button>
                  )}
                  <Link href="/shadow" className="btn btn-ghost btn-sm inline-flex">
                    Hablar con Shadow <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Intención del día */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p className="eyebrow">Intención del día</p>
              {!editingFocus && (
                <button className="tb-btn" style={{ width: 26, height: 26 }} onClick={() => { setFocusDraft(focus); setEditingFocus(true); }} title="Editar">
                  <Pencil size={12} />
                </button>
              )}
            </div>
            {editingFocus ? (
              <div>
                <textarea
                  className="capture-input"
                  autoFocus
                  rows={2}
                  placeholder="¿Cuál es tu foco hoy?"
                  value={focusDraft}
                  onChange={(e) => setFocusDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") saveFocus();
                    if (e.key === "Escape") setEditingFocus(false);
                  }}
                  style={{ width: "100%" }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={saveFocus}>Guardar</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingFocus(false)}>Cancelar</button>
                </div>
              </div>
            ) : focus ? (
              <p style={{ fontFamily: "var(--f-serif)", fontSize: 20, color: "var(--bone)", lineHeight: 1.4 }}>
                &ldquo;{focus}&rdquo;
              </p>
            ) : (
              <button className="tick" style={{ cursor: "pointer" }} onClick={() => { setFocusDraft(""); setEditingFocus(true); }}>
                + Define tu intención del día
              </button>
            )}
          </div>

          {/* Prioridades */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p className="eyebrow">Prioridades</p>
              <span className="tick">{prioDone}/{priorities.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {priorities.map((p) => (
                <div key={p.id} className="prio-row">
                  <button
                    className={`habit-check ${p.completed ? "done" : ""}`}
                    style={{ flexShrink: 0 }}
                    onClick={() => togglePriority(p)}
                  >
                    {p.completed && <Check size={12} style={{ color: "white" }} />}
                  </button>
                  <span
                    style={{
                      fontSize: 13, flex: 1,
                      color: p.completed ? "var(--mute)" : "var(--bone-dim)",
                      textDecoration: p.completed ? "line-through" : "none",
                    }}
                  >
                    {p.text}
                  </span>
                  <button className="prio-del" onClick={() => deletePriority(p.id)} title="Eliminar">
                    <X size={12} />
                  </button>
                </div>
              ))}
              <div className="prio-add">
                <Plus size={13} style={{ color: "var(--mute)", flexShrink: 0 }} />
                <input
                  placeholder="Agregar prioridad…"
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addPriority(); }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Hábitos */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p className="eyebrow">Hábitos · hoy</p>
              <span style={{ fontFamily: "var(--f-mono)", fontSize: 12, color: habitsTotal > 0 && habitsDone === habitsTotal ? "var(--green)" : "var(--mute)" }}>
                {habitsDone}/{habitsTotal}
              </span>
            </div>
            <div className="progress progress-lg mb-3">
              <div className="progress-fill green" style={{ width: `${habitsPct}%` }} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {habits.map((h) => {
                const done = doneHabits.has(h.id);
                return (
                  <button
                    key={h.id}
                    className="tag"
                    onClick={() => toggleHabit(h.id)}
                    style={{
                      cursor: "pointer",
                      ...(done ? { borderColor: "var(--green)", color: "var(--green)", background: "rgba(127,169,140,0.15)" } : {}),
                    }}
                  >
                    {done && <Check size={10} style={{ marginRight: 2 }} />}
                    {h.name}
                  </button>
                );
              })}
              {habitsTotal === 0 && <p className="tick">Sin hábitos activos</p>}
            </div>
          </div>

          {/* Plan de hoy — timeline unificado (clases + gym + estudio + entregas + eventos) */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p className="eyebrow">Plan de hoy</p>
              <span className="tick">{plan.length ? `${plan.length} bloque${plan.length > 1 ? "s" : ""}` : ""}</span>
            </div>
            {plan.length === 0 ? (
              <p className="tick">Sin compromisos hoy — día abierto.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {plan.map((it) => {
                  const Icon = PLAN_ICONS[it.icon];
                  return (
                    <Link
                      key={it.key}
                      href={it.href}
                      style={{ display: "flex", gap: 11, alignItems: "flex-start", textDecoration: "none", padding: "7px 0" }}
                    >
                      <span
                        className="mono"
                        style={{ width: 40, flexShrink: 0, fontSize: 11.5, color: it.time ? "var(--bone-dim)" : "var(--mute-2)", textAlign: "right", marginTop: 2 }}
                      >
                        {it.time ?? "—"}
                      </span>
                      <span
                        style={{
                          width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                          display: "grid", placeItems: "center",
                          background: `color-mix(in srgb, ${it.tone} 14%, transparent)`,
                          color: it.tone,
                        }}
                      >
                        <Icon size={12} />
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontSize: 13, color: "var(--bone-dim)", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {it.title}
                          {it.endTime && <span className="tick" style={{ marginLeft: 6 }}>–{it.endTime}</span>}
                        </p>
                        {it.detail && <p className="tick" style={{ marginTop: 1 }}>{it.detail}</p>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Finanzas */}
          <Link href="/finanzas" className="card" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p className="eyebrow">Finanzas · {new Date().toLocaleDateString("es-MX", { month: "long" })}</p>
              <ArrowRight size={13} style={{ color: "var(--mute-2)" }} />
            </div>
            <p style={{ fontFamily: "var(--f-mono)", fontSize: 24, color: "var(--bone)", lineHeight: 1 }}>
              {totalBalance > 0 ? formatCurrency(totalBalance) : "—"}
            </p>
            <p className="metric-label mt-1">Saldo total</p>
            <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
              <div>
                <p className="tick">Ingresos</p>
                <p style={{ color: "var(--green)", fontFamily: "var(--f-mono)", fontSize: 13 }}>
                  {monthIncome > 0 ? `+${formatCurrency(monthIncome)}` : "—"}
                </p>
              </div>
              <div>
                <p className="tick">Gastos</p>
                <p style={{ color: "var(--red)", fontFamily: "var(--f-mono)", fontSize: 13 }}>
                  {monthExpenses > 0 ? `-${formatCurrency(monthExpenses)}` : "—"}
                </p>
              </div>
            </div>
          </Link>

          {/* Tiempo + Lectura */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Link href="/tiempo" className="card" style={{ textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <p className="eyebrow">Tiempo · hoy</p>
                <Clock size={13} style={{ color: "var(--mute-2)" }} />
              </div>
              <p style={{ fontFamily: "var(--f-mono)", fontSize: 24, color: tiempoHoy > 0 ? "var(--bone)" : "var(--mute)", lineHeight: 1 }}>
                {fmtHours(tiempoHoy)}
              </p>
              <p className="metric-label mt-1">{tiempoHoy > 0 ? "registrado" : "sin registrar"}</p>
            </Link>

            <Link href="/lectura" className="card" style={{ textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <p className="eyebrow">Leyendo</p>
                <BookOpen size={13} style={{ color: "var(--mute-2)" }} />
              </div>
              {libro ? (
                <>
                  <p style={{ fontSize: 14, color: "var(--bone)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {libro.title}
                  </p>
                  {libro.pct != null ? (
                    <div style={{ marginTop: 10 }}>
                      <div className="progress mb-1"><div className="progress-fill" style={{ width: `${libro.pct}%`, background: "var(--gold)" }} /></div>
                      <p className="tick">p. {libro.current}/{libro.total} · {libro.pct}%</p>
                    </div>
                  ) : (
                    <p className="tick" style={{ marginTop: 8 }}>En progreso</p>
                  )}
                </>
              ) : (
                <p className="tick" style={{ marginTop: 4 }}>Nada en progreso</p>
              )}
            </Link>
          </div>

          {/* Visión */}
          {visionSecondary && (
            <div className="card" style={{ borderColor: "var(--glass-bd-2)" }}>
              <p className="eyebrow-gold mb-3">Visión</p>
              <p className="serif" style={{ fontSize: 17, color: "var(--bone)", lineHeight: 1.5 }}>{visionPrimary}</p>
              <p style={{ color: "var(--mute)", marginTop: 8, fontSize: 13 }}>{visionSecondary}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="kpi-cell">
      <p style={{ fontFamily: "var(--f-serif)", fontSize: 28, lineHeight: 1, color: accent ?? "var(--bone)" }}>{value}</p>
      <p className="metric-label" style={{ marginTop: 6 }}>{label}</p>
    </div>
  );
}
