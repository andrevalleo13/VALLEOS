"use client";
import { useState, useEffect } from "react";
import { Check, Plus, Flame } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Habit, HabitCompletion } from "@/lib/supabase/types";

type HabitWithDone = Habit & { done: boolean; streak: number };

const TODAY = new Date().toISOString().split("T")[0];
const WEEK_DAYS = ["D", "L", "M", "M", "J", "V", "S"];

function weekDates(): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

export default function HabitosPage() {
  const supabase = createClient();
  const [habits, setHabits] = useState<HabitWithDone[]>([]);
  const [weekHistory, setWeekHistory] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);

  const weekDates_ = weekDates();

  useEffect(() => { load(); }, []);

  async function load() {
    const [habitsRes, completionsRes] = await Promise.all([
      supabase.from("habits").select("*").eq("active", true).order("sort_order"),
      supabase.from("habit_completions")
        .select("habit_id, date")
        .gte("date", weekDates_[0])
        .lte("date", TODAY),
    ]);

    const allCompletions = completionsRes.data ?? [];
    const byDate: Record<string, Set<string>> = {};
    for (const c of allCompletions) {
      if (!byDate[c.date]) byDate[c.date] = new Set();
      byDate[c.date].add(c.habit_id);
    }
    setWeekHistory(byDate);

    const todayDone = byDate[TODAY] ?? new Set();
    const mapped = (habitsRes.data ?? []).map((h) => ({
      ...h,
      done: todayDone.has(h.id),
      streak: calcStreak(h.id, byDate, weekDates_),
    }));
    setHabits(mapped);
    setLoading(false);
  }

  function calcStreak(habitId: string, byDate: Record<string, Set<string>>, dates: string[]) {
    let streak = 0;
    for (let i = dates.length - 1; i >= 0; i--) {
      if (byDate[dates[i]]?.has(habitId)) streak++;
      else break;
    }
    return streak;
  }

  async function toggle(habitId: string, currentDone: boolean) {
    setHabits((prev) => prev.map((h) => h.id === habitId ? { ...h, done: !h.done } : h));
    if (currentDone) {
      await supabase.from("habit_completions").delete()
        .eq("habit_id", habitId).eq("date", TODAY);
    } else {
      await supabase.from("habit_completions").upsert({ habit_id: habitId, date: TODAY, value: null, frozen: false });
    }
    await load();
  }

  const done = habits.filter((h) => h.done).length;

  if (loading) {
    return (
      <div className="page-body">
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="shimmer h-14 rounded-xl" />
          ))}
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
            <p className="tick">{done}/{habits.length} completados</p>
            <button className="btn btn-ghost btn-sm mt-2">
              <Plus size={13} /> Nuevo
            </button>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="card text-center">
            <p className="metric-value-lg">{done}</p>
            <p className="metric-label">Completados hoy</p>
          </div>
          <div className="card text-center">
            <p className="metric-value-lg" style={{ color: "var(--gold)" }}>
              {habits.length > 0 ? Math.max(...habits.map((h) => h.streak)) : 0}
            </p>
            <p className="metric-label">Mejor racha</p>
          </div>
          <div className="card text-center">
            <p className="metric-value-lg" style={{ color: "var(--green)" }}>
              {habits.length > 0 ? Math.round((done / habits.length) * 100) : 0}%
            </p>
            <p className="metric-label">Tasa de éxito hoy</p>
          </div>
        </div>

        {/* Progress bar */}
        {habits.length > 0 && (
          <div className="card mb-6">
            <div className="flex justify-between mb-2">
              <span className="eyebrow">Progreso de hoy</span>
              <span className="tick">{done}/{habits.length}</span>
            </div>
            <div className="progress progress-lg">
              <div className="progress-fill green" style={{ width: `${(done / habits.length) * 100}%` }} />
            </div>
          </div>
        )}

        {habits.length === 0 ? (
          <div className="card text-center py-12">
            <p style={{ color: "var(--mute)", fontSize: 15 }}>Sin hábitos configurados.</p>
            <p className="tick mt-1">Agrega tus primeros hábitos para empezar.</p>
          </div>
        ) : (
          <div>
            {/* Column headers */}
            <div className="flex items-center gap-3 px-1 mb-2">
              <div style={{ width: 28, flexShrink: 0 }} />
              <div style={{ flex: 1 }} />
              <div style={{ display: "flex", gap: 4, marginRight: 8 }}>
                {weekDates_.map((d, i) => (
                  <span key={d} className="tick" style={{ width: 18, textAlign: "center", fontSize: 9 }}>
                    {WEEK_DAYS[new Date(d + "T12:00:00").getDay()]}
                  </span>
                ))}
              </div>
              <div style={{ width: 40 }} />
            </div>

            <div className="habits-grid">
              {habits.map((h) => (
                <div key={h.id} className="habit-row">
                  <button
                    className={cn("habit-check", h.done && "done")}
                    onClick={() => toggle(h.id, h.done)}
                  >
                    {h.done && <Check size={12} style={{ color: "white" }} />}
                  </button>

                  <span className="habit-name">{h.name}</span>

                  <div className="habit-history">
                    {weekDates_.map((d) => (
                      <div
                        key={d}
                        className={cn(
                          "habit-day",
                          weekHistory[d]?.has(h.id) ? "done" : d < TODAY ? "missed" : ""
                        )}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-1 ml-2">
                    <Flame size={12} style={{ color: "var(--gold)" }} />
                    <span className="habit-streak">{h.streak}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
