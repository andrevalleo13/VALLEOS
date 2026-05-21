"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";

type TickerData = {
  mrr: number;
  habitsToday: number;
  habitsTotal: number;
  gpa: number | null;
  streak: number;
};

function Sep() {
  return (
    <div
      style={{
        width: 1,
        height: 14,
        background: "var(--glass-bd)",
        flexShrink: 0,
        margin: "0 16px",
      }}
    />
  );
}

function Item({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="ticker-item">
      <span className="ticker-label">{label}</span>
      <span className="ticker-value" style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}

export function Ticker() {
  const [data, setData] = useState<TickerData | null>(null);
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const supabase = createClient();

  useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
      );
      setDate(
        now.toLocaleDateString("es-MX", {
          weekday: "short",
          day: "numeric",
          month: "short",
        })
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split("T")[0];
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
        .toISOString()
        .split("T")[0];

      const [clientsRes, habitsRes, completionsRes, historyRes, coursesRes] =
        await Promise.all([
          supabase
            .from("flouvia_clients")
            .select("monthly_value")
            .eq("status", "activo"),
          supabase.from("habits").select("id").eq("active", true),
          supabase
            .from("habit_completions")
            .select("habit_id")
            .eq("date", today),
          supabase
            .from("habit_completions")
            .select("habit_id, date")
            .gte("date", sevenDaysAgo)
            .lte("date", today),
          supabase
            .from("academic_courses")
            .select("grade")
            .not("grade", "is", null),
        ]);

      const mrr = (clientsRes.data ?? []).reduce(
        (a, c) => a + (c.monthly_value ?? 0),
        0
      );
      const habitsTotal = (habitsRes.data ?? []).length;
      const habitsToday = (completionsRes.data ?? []).length;

      // Calculate max streak across all habits
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

      setData({ mrr, habitsToday, habitsTotal, gpa, streak: maxStreak });
    }

    load();
  }, []);

  return (
    <div className="shell-ticker">
      {/* Time */}
      <div className="ticker-item">
        <span
          className="ticker-value"
          style={{ color: "var(--bone-dim)", fontVariantNumeric: "tabular-nums" }}
        >
          {time}
        </span>
        <span style={{ color: "var(--mute-2)", margin: "0 6px" }}>·</span>
        <span
          className="ticker-value"
          style={{ textTransform: "capitalize", color: "var(--mute)" }}
        >
          {date}
        </span>
      </div>

      {data && (
        <>
          {data.mrr > 0 && (
            <>
              <Sep />
              <Item
                label="MRR"
                value={formatCurrency(data.mrr)}
                color="var(--gold)"
              />
            </>
          )}

          {data.habitsTotal > 0 && (
            <>
              <Sep />
              <Item
                label="HÁBITOS"
                value={`${data.habitsToday}/${data.habitsTotal}`}
                color={
                  data.habitsToday === data.habitsTotal
                    ? "var(--green)"
                    : undefined
                }
              />
            </>
          )}

          {data.streak > 0 && (
            <>
              <Sep />
              <Item
                label="RACHA"
                value={`${data.streak}d`}
                color="var(--gold)"
              />
            </>
          )}

          {data.gpa !== null && (
            <>
              <Sep />
              <Item
                label="GPA"
                value={data.gpa.toFixed(1)}
                color="var(--blue)"
              />
            </>
          )}

          <Sep />
          <Item label="CDMX" value="22°C · Despejado" />
        </>
      )}
    </div>
  );
}
