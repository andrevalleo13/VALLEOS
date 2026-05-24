"use client";
import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { Bell, Menu, Moon, Sun } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";

type TickerData = {
  mrr: number;
  habitsToday: number;
  habitsTotal: number;
  gpa: number | null;
  streak: number;
  gymWeek: number;
};

export function Topbar() {
  const {
    setCmdkOpen,
    setCaptureOpen,
    setCierreOpen,
    setAjustesOpen,
    setMobileMenu,
    focusMode,
    setFocusMode,
  } = useAppStore();

  const [now, setNow] = useState(new Date());
  const [data, setData] = useState<TickerData | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        setCaptureOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        setCierreOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCaptureOpen, setCierreOpen]);

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split("T")[0];
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
        .toISOString()
        .split("T")[0];

      const [clientsRes, habitsRes, completionsRes, historyRes, coursesRes, gymRes] =
        await Promise.all([
          supabase.from("flouvia_clients").select("monthly_value").eq("status", "activo"),
          supabase.from("habits").select("id").eq("active", true),
          supabase.from("habit_completions").select("habit_id").eq("date", today),
          supabase.from("habit_completions").select("habit_id, date").gte("date", sevenDaysAgo).lte("date", today),
          supabase.from("academic_courses").select("grade").not("grade", "is", null),
          supabase.from("workout_sessions").select("id").gte("date", sevenDaysAgo).lte("date", today),
        ]);

      const mrr = (clientsRes.data ?? []).reduce(
        (a, c) => a + (c.monthly_value ?? 0),
        0
      );
      const habitsTotal = (habitsRes.data ?? []).length;
      const habitsToday = (completionsRes.data ?? []).length;

      const habitIds = (habitsRes.data ?? []).map((h: { id: string }) => h.id);
      const byHabitDate: Record<string, Set<string>> = {};
      for (const c of historyRes.data ?? []) {
        if (!byHabitDate[c.habit_id]) byHabitDate[c.habit_id] = new Set();
        byHabitDate[c.habit_id].add(c.date);
      }

      const dates: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
        dates.push(d);
      }

      let maxStreak = 0;
      for (const hid of habitIds) {
        const set = byHabitDate[hid] ?? new Set();
        let s = 0;
        for (let i = dates.length - 1; i >= 0; i--) {
          if (set.has(dates[i])) s++;
          else break;
        }
        if (s > maxStreak) maxStreak = s;
      }

      const grades = (coursesRes.data ?? [])
        .map((c: { grade: number | null }) => c.grade)
        .filter(Boolean) as number[];
      const gpa = grades.length
        ? grades.reduce((a: number, b: number) => a + b, 0) / grades.length
        : null;

      const gymWeek = (gymRes.data ?? []).length;

      setData({ mrr, habitsToday, habitsTotal, gpa, streak: maxStreak, gymWeek });
    }
    load();
  }, []);

  const dateStr = now
    .toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "long" })
    .toUpperCase();
  const timeStr = now.toLocaleTimeString("es-MX", { hour12: false });
  const isDay = now.getHours() > 6 && now.getHours() < 19;

  const tickerItems = [
    `${dateStr} · ${timeStr}`,
    data && data.mrr > 0 ? `MRR FLOUVIA ${formatCurrency(data.mrr)}` : null,
    data && data.gpa !== null ? `GPA ${data.gpa.toFixed(1)}` : null,
    data && data.habitsTotal > 0
      ? `HÁBITOS ${data.habitsToday}/${data.habitsTotal}`
      : null,
    data && data.streak > 0 ? `RACHA ${data.streak}D` : null,
    data && data.gymWeek > 0 ? `GYM ${data.gymWeek}× ESTA SEMANA` : null,
    "SHADOW ● EN LÍNEA",
    "CDMX 22°",
  ].filter(Boolean) as string[];

  return (
    <header className="shell-topbar">
      <div className="tb-left">
        <button
          className="tb-btn md:hidden"
          onClick={() => setMobileMenu(true)}
          aria-label="Menú"
        >
          <Menu size={16} />
        </button>
        <button className="kbd" onClick={() => setCmdkOpen(true)}>
          <span className="accent">⌘</span>K
        </button>
        <button className="kbd" onClick={() => setCaptureOpen(true)}>
          <span className="accent">⌘</span>J
        </button>
        <button className="kbd" onClick={() => setCierreOpen(true)}>
          <span className="accent">⌘</span>.
        </button>
      </div>

      <div className="ticker-wrap">
        <div className="ticker">
          {tickerItems.map((item, i) => (
            <span key={i}>{item}</span>
          ))}
          {tickerItems.map((item, i) => (
            <span key={`dup-${i}`}>{item}</span>
          ))}
        </div>
      </div>

      <div className="tb-right">
        <div className="tb-widget">
          {isDay ? <Sun size={11} /> : <Moon size={11} />}
          <span>CDMX <span className="v">22°</span></span>
        </div>
        <button
          className={`tb-widget${focusMode ? " active" : ""}`}
          onClick={() => setFocusMode(!focusMode)}
          style={{ border: "none" }}
        >
          <Moon size={11} />
          SILENCIO
        </button>
        <button
          className="tb-widget"
          onClick={() => setAjustesOpen(true)}
          style={{ border: "none" }}
        >
          AJUSTES
        </button>
        <button className="tb-btn" aria-label="Notificaciones">
          <Bell size={15} />
        </button>
      </div>
    </header>
  );
}
