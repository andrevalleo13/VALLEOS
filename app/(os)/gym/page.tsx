import { createClient } from "@/lib/supabase/server";
import type { WorkoutSet } from "@/lib/supabase/types";
import { GymClient } from "./GymClient";

export const revalidate = 0;

export default async function GymPage() {
  const supabase = await createClient();

  const since = new Date(Date.now() - 120 * 86400000).toISOString().split("T")[0];

  const [
    { data: routines },
    { data: days },
    { data: exercises },
    { data: sessions },
    { data: schedule },
    { data: cardio },
    { data: cardioGoal },
  ] = await Promise.all([
    supabase.from("workout_routines").select("*").order("sort_order"),
    supabase.from("workout_days").select("*").order("day_order"),
    supabase.from("workout_exercises").select("*").order("sort_order"),
    supabase.from("workout_sessions").select("*").gte("date", since).order("date", { ascending: false }),
    supabase.from("workout_schedule").select("*").order("sort_order"),
    supabase.from("cardio_sessions").select("*").gte("date", since).order("date", { ascending: false }),
    supabase.from("cardio_goal").select("*").eq("id", 1).maybeSingle(),
  ]);

  const sessionIds = (sessions ?? []).map((s) => s.id);
  let sets: WorkoutSet[] = [];
  if (sessionIds.length) {
    const { data: setRows } = await supabase
      .from("workout_sets")
      .select("*")
      .in("session_id", sessionIds);
    sets = setRows ?? [];
  }

  return (
    <GymClient
      routines={routines ?? []}
      days={days ?? []}
      exercises={exercises ?? []}
      sessions={sessions ?? []}
      sets={sets ?? []}
      schedule={schedule ?? []}
      cardio={cardio ?? []}
      cardioGoal={cardioGoal ?? null}
    />
  );
}
