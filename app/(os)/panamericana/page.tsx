import { createClient } from "@/lib/supabase/server";
import type { AcademicCourse, Assignment, GradeComponent, ClassSchedule, Semester } from "@/lib/supabase/types";
import { PanamericanaClient } from "./PanamericanaClient";

export const revalidate = 0;

export default async function PanamericanaPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const [
    { data: courses },
    { data: components },
    { data: assignments },
    { data: schedule },
    { data: semesters },
    { data: cache },
  ] = await Promise.all([
    supabase.from("academic_courses").select("*").eq("active", true).order("name"),
    supabase.from("grade_components").select("*").order("sort_order"),
    supabase.from("assignments").select("*, academic_courses(name, color)").neq("status", "done").order("due_date").limit(30),
    supabase.from("class_schedule").select("*").order("day_of_week").order("start_time"),
    supabase.from("semesters").select("*").order("term_number"),
    supabase.from("shadow_cache").select("content, generated_at").eq("key", `academia:${today}`).single(),
  ]);

  const allSemesters = (semesters ?? []) as Semester[];

  return (
    <PanamericanaClient
      courses={(courses ?? []) as AcademicCourse[]}
      components={(components ?? []) as GradeComponent[]}
      assignments={(assignments ?? []) as unknown as (Assignment & { academic_courses: { name: string; color: string } | null })[]}
      schedule={(schedule ?? []) as ClassSchedule[]}
      closedSemesters={allSemesters.filter((s) => s.status === "closed")}
      activeSemester={allSemesters.find((s) => s.status === "active") ?? null}
      analysis={cache?.content ?? null}
      analysisAt={cache?.generated_at ?? null}
    />
  );
}
