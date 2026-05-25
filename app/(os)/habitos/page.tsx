"use client";
import { useState, useEffect } from "react";
import {
  Check, Plus, Flame, Trash2, Trophy, ChevronLeft, ChevronRight, Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";
import { ColorPicker } from "@/components/ColorPicker";
import type { Habit } from "@/lib/supabase/types";
const WEEKDAYS = ["D", "L", "M", "M", "J", "V", "S"];
const RANGE = 140;

const iso = (d: Date) => d.toISOString().split("T")[0];
const TODAY = iso(new Date());

export default function HabitosPage() {
  const supabase = createClient();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [byDate, setByDate] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(TODAY);
  const [monthOffset, setMonthOffset] = useState(0);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#C9A35F");
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const start = new Date();
    start.setDate(start.getDate() - RANGE);
    const [habitsRes, compRes] = await Promise.all([
      supabase.from("habits").select("*").eq("active", true).order("sort_order"),
      supabase.from("habit_completions").select("habit_id, date").gte("date", iso(start)).lte("date", TODAY),
    ]);
    const map: Record<string, Set<string>> = {};
    for (const c of compRes.data ?? []) (map[c.date] ??= new Set()).add(c.habit_id);
    setByDate(map);
    setHabits(habitsRes.data ?? []);
    setLoading(false);
  }

  async function toggle(habitId: string, dateKey: string) {
    if (dateKey > TODAY) return;
    const done = byDate[dateKey]?.has(habitId);
    setByDate((prev) => {
      const next = { ...prev };
      const set = new Set(next[dateKey] ?? []);
      if (done) set.delete(habitId);
      else set.add(habitId);
      next[dateKey] = set;
      return next;
    });
    if (done) {
      await supabase.from("habit_completions").delete().eq("habit_id", habitId).eq("date", dateKey);
    } else {
      await supabase.from("habit_completions").upsert(
        { habit_id: habitId, date: dateKey, value: null, frozen: false },
        { onConflict: "habit_id,date" }
      );
    }
  }

  async function createHabit() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    const maxSort = habits.reduce((m, h) => Math.max(m, h.sort_order), 0);
    await supabase.from("habits").insert({
      name, active: true, sort_order: maxSort + 1, type: "binary", unit: null,
      daily_target: null, color: newColor, icon: null, freezes_available: 0,
      schedule_days: [0, 1, 2, 3, 4, 5, 6],
    });
    setSaving(false); setCreating(false); setNewName(""); setNewColor("#C9A35F");
    await load();
  }

  async function removeHabit(habitId: string) {
    setHabits((prev) => prev.filter((h) => h.id !== habitId));
    await supabase.from("habits").update({ active: false }).eq("id", habitId);
  }

  // ── Derived stats ──
  const total = habits.length;
  const doneCount = (key: string) => habits.filter((h) => byDate[key]?.has(h.id)).length;
  const isPerfect = (key: string) => total > 0 && doneCount(key) === total;

  function currentStreak(pred: (key: string) => boolean) {
    let streak = 0;
    const d = new Date();
    if (!pred(iso(d))) d.setDate(d.getDate() - 1);
    while (pred(iso(d))) { streak++; d.setDate(d.getDate() - 1); }
    return streak;
  }
  function bestStreak(pred: (key: string) => boolean) {
    let best = 0, cur = 0;
    const d = new Date();
    for (let i = 0; i < RANGE; i++) {
      if (pred(iso(d))) { cur++; best = Math.max(best, cur); } else cur = 0;
      d.setDate(d.getDate() - 1);
    }
    return best;
  }

  const perfectPred = (key: string) => isPerfect(key);
  const streak = currentStreak(perfectPred);
  const best = bestStreak(perfectPred);

  // This month metrics
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const daysElapsed = now.getDate();
  let monthDone = 0, perfectDays = 0;
  for (let day = 1; day <= daysElapsed; day++) {
    const key = iso(new Date(y, m, day));
    monthDone += doneCount(key);
    if (isPerfect(key)) perfectDays++;
  }
  const monthRate = total > 0 && daysElapsed > 0 ? Math.round((monthDone / (total * daysElapsed)) * 100) : 0;

  const todayDone = doneCount(TODAY);
  const selDone = doneCount(selected);
  const selPct = total > 0 ? Math.round((selDone / total) * 100) : 0;

  // Calendar month to render
  const calBase = new Date(y, m + monthOffset, 1);
  const calY = calBase.getFullYear(), calM = calBase.getMonth();
  const firstWeekday = new Date(calY, calM, 1).getDay();
  const daysInMonth = new Date(calY, calM + 1, 0).getDate();
  const monthLabel = calBase.toLocaleDateString("es-MX", { month: "long", year: "numeric" });

  const motivational = () => {
    if (total === 0) return "Crea tu primer hábito para empezar.";
    if (todayDone === 0) return "Empieza el día. Un check enciende la racha.";
    if (todayDone < total) return `Vas ${todayDone}/${total}. No rompas la cadena.`;
    return streak > 1 ? `Día perfecto. Racha de ${streak} días. 🔥` : "Día perfecto. Así se empieza una racha.";
  };

  if (loading) {
    return (
      <div className="page-body">
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="shimmer h-14 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow mb-2">06 · SISTEMA</p>
            <h1 className="page-title">Hábitos.</h1>
          </div>
          <div style={{ textAlign: "right", marginTop: 4 }}>
            <p className="tick" style={{ marginBottom: 8 }}>{todayDone}/{total} hoy</p>
            <button className="btn btn-ghost btn-sm" onClick={() => setCreating(true)}>
              <Plus size={13} /> Nuevo
            </button>
          </div>
        </div>
      </div>

      <div className="page-body">
        {total === 0 ? (
          <div className="card text-center py-12">
            <Sparkles size={32} style={{ color: "var(--mute-2)", margin: "0 auto 12px" }} />
            <p style={{ color: "var(--mute)", fontSize: 15 }}>Sin hábitos configurados.</p>
            <p className="tick mt-1 mb-4">Agrega tus primeros hábitos para empezar a construir rachas.</p>
            <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
              <Plus size={13} /> Crear hábito
            </button>
          </div>
        ) : (
          <>
            {/* Stats strip */}
            <div className="hb-stats mb-6">
              <div className="hb-stat">
                <span className="v" style={{ color: streak > 0 ? "var(--gold)" : "var(--bone)" }}>
                  <Flame size={20} style={{ color: "var(--gold)" }} /> {streak}
                </span>
                <span className="l">Racha actual</span>
              </div>
              <div className="hb-stat">
                <span className="v" style={{ color: "var(--bone)" }}>
                  <Trophy size={17} style={{ color: "var(--gold-2)" }} /> {best}
                </span>
                <span className="l">Mejor racha</span>
              </div>
              <div className="hb-stat">
                <span className="v" style={{ color: monthRate >= 80 ? "var(--green)" : "var(--bone)" }}>{monthRate}%</span>
                <span className="l">Este mes</span>
              </div>
              <div className="hb-stat">
                <span className="v" style={{ color: "var(--green)" }}>{perfectDays}</span>
                <span className="l">Días perfectos</span>
              </div>
              <div className="hb-stat">
                <span className="v" style={{ color: "var(--bone)" }}>{monthDone}</span>
                <span className="l">Checks del mes</span>
              </div>
            </div>

            {/* Main: check-off + calendar */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
              {/* Check-off for selected day */}
              <div className="card">
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                  <Ring pct={selPct} />
                  <div style={{ flex: 1 }}>
                    <p className="eyebrow" style={{ marginBottom: 4 }}>
                      {selected === TODAY ? "Hoy" : new Date(selected + "T12:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                    <p style={{ fontFamily: "var(--f-serif)", fontSize: 17, color: "var(--bone)", lineHeight: 1.3 }}>
                      {selected === TODAY ? motivational() : `${selDone}/${total} completados`}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {habits.map((h) => {
                    const done = byDate[selected]?.has(h.id) ?? false;
                    const hs = currentStreak((key) => byDate[key]?.has(h.id) ?? false);
                    return (
                      <div
                        key={h.id}
                        className={`hb-toggle${done ? " done" : ""}`}
                        onClick={() => toggle(h.id, selected)}
                      >
                        <span className="dot" style={done ? { background: h.color } : undefined}>
                          {done && <Check size={15} />}
                        </span>
                        <span className="nm">{h.name}</span>
                        {hs > 0 && (
                          <span className="flame"><Flame size={12} /> {hs}</span>
                        )}
                        <button
                          className="habit-del"
                          onClick={(e) => { e.stopPropagation(); removeHabit(h.id); }}
                          title="Archivar"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Calendar heatmap */}
              <div className="card">
                <div className="hb-cal-nav">
                  <button className="tb-btn" style={{ width: 28, height: 28 }} onClick={() => setMonthOffset((o) => o - 1)}>
                    <ChevronLeft size={15} />
                  </button>
                  <span className="mo">{monthLabel}</span>
                  <button
                    className="tb-btn"
                    style={{ width: 28, height: 28, opacity: monthOffset >= 0 ? 0.3 : 1 }}
                    onClick={() => monthOffset < 0 && setMonthOffset((o) => o + 1)}
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
                <div className="hb-cal-weekdays">
                  {WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}
                </div>
                <div className="hb-cal-grid">
                  {Array.from({ length: firstWeekday }).map((_, i) => (
                    <div key={`e${i}`} className="hb-cal-day empty" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const key = iso(new Date(calY, calM, day));
                    const future = key > TODAY;
                    const dc = doneCount(key);
                    const ratio = total > 0 ? dc / total : 0;
                    const full = ratio >= 1;
                    const missed = !future && dc === 0;
                    const style: React.CSSProperties = {};
                    if (!future && dc > 0) {
                      style.background = full
                        ? "linear-gradient(135deg, var(--gold-2), var(--gold))"
                        : `rgba(201,163,95,${0.14 + ratio * 0.34})`;
                      if (!full) style.color = "var(--gold)";
                    }
                    return (
                      <div
                        key={key}
                        className={`hb-cal-day${future ? " future" : ""}${key === TODAY ? " today" : ""}${key === selected ? " selected" : ""}${full ? " full" : ""}${missed ? " missed" : ""}`}
                        style={style}
                        onClick={() => !future && setSelected(key)}
                        title={future ? "" : `${dc}/${total} hábitos`}
                      >
                        {day}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, justifyContent: "center" }}>
                  <span className="tick" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: "linear-gradient(135deg, var(--gold-2), var(--gold))" }} /> Perfecto
                  </span>
                  <span className="tick" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: "rgba(201,163,95,0.3)" }} /> Parcial
                  </span>
                  <span className="tick" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, border: "1px solid rgba(217,107,88,0.4)" }} /> Fallado
                  </span>
                </div>
              </div>
            </div>

            {/* Per-habit breakdown */}
            <p className="eyebrow mt-8 mb-4">Por hábito · últimos 30 días</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {habits.map((h) => {
                const hs = currentStreak((key) => byDate[key]?.has(h.id) ?? false);
                const hb = bestStreak((key) => byDate[key]?.has(h.id) ?? false);
                let last30 = 0;
                const cells: { key: string; done: boolean }[] = [];
                const d = new Date();
                d.setDate(d.getDate() - 29);
                for (let i = 0; i < 30; i++) {
                  const key = iso(d);
                  const done = byDate[key]?.has(h.id) ?? false;
                  if (done) last30++;
                  cells.push({ key, done });
                  d.setDate(d.getDate() + 1);
                }
                return (
                  <div key={h.id} className="card" style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 18px" }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: h.color, flexShrink: 0 }} />
                    <div style={{ width: 130, flexShrink: 0 }}>
                      <p style={{ fontSize: 14, color: "var(--bone)" }}>{h.name}</p>
                      <p className="tick" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Flame size={10} style={{ color: "var(--gold)" }} /> {hs} · récord {hb}
                      </p>
                    </div>
                    <div className="hb-strip" style={{ flex: 1, overflow: "hidden" }}>
                      {cells.map((c) => (
                        <span
                          key={c.key}
                          className={`hb-strip-cell${c.key === TODAY ? " today-cell" : ""}`}
                          style={c.done ? { background: h.color } : undefined}
                          title={c.key}
                        />
                      ))}
                    </div>
                    <span style={{ fontFamily: "var(--f-mono)", fontSize: 13, color: last30 >= 24 ? "var(--green)" : "var(--mute)", flexShrink: 0, width: 52, textAlign: "right" }}>
                      {Math.round((last30 / 30) * 100)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {creating && (
        <Modal title="Nuevo hábito" onClose={() => setCreating(false)}>
          <Field label="Nombre">
            <input
              className="input"
              autoFocus
              placeholder="ej. Leer 30 min"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createHabit(); }}
            />
          </Field>
          <Field label="Color">
            <ColorPicker value={newColor} onChange={setNewColor} />
          </Field>
          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setCreating(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={createHabit} disabled={saving || !newName.trim()}>
              {saving ? "Creando…" : "Crear"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Ring({ pct, size = 72, stroke = 6 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  const color = pct >= 100 ? "var(--green)" : "var(--gold)";
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s var(--ease)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
        <span style={{ fontFamily: "var(--f-serif)", fontSize: 18, color: "var(--bone)" }}>{pct}%</span>
      </div>
    </div>
  );
}
