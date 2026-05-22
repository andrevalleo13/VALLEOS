"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CYCLE: Record<string, string> = { pending: "reading", reading: "done", done: "pending" };
const CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Por leer", color: "var(--mute)" },
  reading: { label: "Leyendo", color: "var(--gold)" },
  done: { label: "Leído", color: "var(--green)" },
};

export function ReadingStatus({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const supabase = createClient();
  const cfg = CONFIG[status] ?? CONFIG.pending;

  async function cycle() {
    const next = CYCLE[status] ?? "pending";
    await supabase
      .from("reading_items")
      .update({ status: next, completed_at: next === "done" ? new Date().toISOString() : null })
      .eq("id", id);
    router.refresh();
  }

  return (
    <button
      className="tag"
      onClick={cycle}
      title="Cambiar estado"
      style={{ borderColor: cfg.color, color: cfg.color, fontSize: 10, cursor: "pointer" }}
    >
      {cfg.label}
    </button>
  );
}
