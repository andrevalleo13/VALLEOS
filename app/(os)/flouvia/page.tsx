import { createClient } from "@/lib/supabase/server";
import { FlouviaClient } from "./FlouviaClient";
import type { FlouviaProject, FlouviaFollowup } from "@/lib/supabase/types";

export const revalidate = 0;

export default async function FlouviaPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const month = today.slice(0, 7);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().slice(0, 10);

  const [
    { data: clients },
    { data: projects },
    { data: invoices },
    { data: followups },
    { data: cache },
  ] = await Promise.all([
    supabase.from("flouvia_clients").select("*").order("sort_order").order("created_at"),
    supabase.from("flouvia_projects")
      .select("*, flouvia_clients(name)")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false }),
    supabase.from("flouvia_invoices")
      .select("*")
      .gte("issued_date", sixMonthsAgoStr)
      .neq("status", "cancelled")
      .order("issued_date"),
    supabase.from("flouvia_followups")
      .select("*, flouvia_clients(name)")
      .eq("done", false)
      .order("due_date")
      .limit(10),
    supabase.from("shadow_cache")
      .select("content, generated_at")
      .eq("key", `flouvia:${month}`)
      .single(),
  ]);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow mb-2">08 · FLOUVIA</p>
            <h1 className="page-title">Flouvia.</h1>
          </div>
          <div style={{ textAlign: "right", marginTop: 4 }}>
            <p className="tick">{(clients ?? []).filter((c) => c.status === "activo").length} activos</p>
            <p className="tick">{(clients ?? []).filter((c) => c.status === "propuesta").length} propuestas</p>
          </div>
        </div>
      </div>

      <div className="page-body">
        <FlouviaClient
          clients={clients ?? []}
          projects={(projects ?? []) as unknown as (FlouviaProject & { flouvia_clients: { name: string } | null })[]}
          followups={(followups ?? []) as unknown as (FlouviaFollowup & { flouvia_clients: { name: string } | null })[]}
          invoices={invoices ?? []}
          analysis={{ content: cache?.content ?? null, generated_at: cache?.generated_at ?? null }}
        />
      </div>
    </div>
  );
}
