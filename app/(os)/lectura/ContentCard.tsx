"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ReadingItem } from "@/lib/supabase/types";
import { EditReading } from "./EditReading";
import { Pencil } from "lucide-react";

const TYPE_CFG: Record<string, { icon: string; accent: string }> = {
  article: { icon: "📄", accent: "var(--blue)" },
  video:   { icon: "▶",  accent: "var(--red)" },
  podcast: { icon: "🎧", accent: "var(--violet)" },
  paper:   { icon: "📃", accent: "var(--mute)" },
  other:   { icon: "🔗", accent: "var(--mute-2)" },
};

const STATUS: Record<string, { label: string; color: string; next: string }> = {
  pending: { label: "Por leer", color: "var(--mute)",  next: "reading" },
  reading: { label: "Leyendo",  color: "var(--gold)",  next: "done"    },
  done:    { label: "Leído",    color: "var(--green)", next: "pending" },
};

export function ContentCard({ item }: { item: ReadingItem }) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);

  const tc = TYPE_CFG[item.type] ?? TYPE_CFG.other;
  const st = STATUS[item.status] ?? STATUS.pending;

  async function cycleStatus() {
    const next = st.next;
    await supabase.from("reading_items").update({
      status: next,
      completed_at: next === "done" ? new Date().toISOString() : null,
    }).eq("id", item.id);
    router.refresh();
  }

  return (
    <>
      <div className="rd-content-card">
        <div
          className="rd-content-type"
          style={{ background: `color-mix(in srgb, ${tc.accent} 12%, transparent)`, color: tc.accent }}
        >
          {tc.icon}
        </div>

        <div className="rd-content-info">
          <div className="rd-content-header">
            <p className="rd-content-title">
              {item.url ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.title ?? item.url}
                </a>
              ) : (
                item.title ?? "Sin título"
              )}
            </p>
            <div className="rd-content-actions">
              <button
                className="tag"
                onClick={cycleStatus}
                style={{ borderColor: st.color, color: st.color, fontSize: 10, cursor: "pointer" }}
              >
                {st.label}
              </button>
              <button className="rd-icon-btn" onClick={() => setEditing(true)} title="Editar">
                <Pencil size={11} />
              </button>
            </div>
          </div>

          {(item.source || item.estimated_minutes) && (
            <div className="rd-content-meta">
              {item.source && <span className="tick">{item.source}</span>}
              {item.source && item.estimated_minutes && <span className="tick">·</span>}
              {item.estimated_minutes && <span className="tick">⏱ {item.estimated_minutes} min</span>}
            </div>
          )}

          {item.summary && <p className="rd-content-summary">{item.summary}</p>}
        </div>
      </div>

      {editing && (
        <EditReading
          item={item}
          onClose={() => { setEditing(false); router.refresh(); }}
        />
      )}
    </>
  );
}
