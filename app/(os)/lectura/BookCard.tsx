"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ReadingItem } from "@/lib/supabase/types";
import { EditReading } from "./EditReading";

const BOOK_COLORS = [
  "#1a2744","#2d4a2d","#4a1a1a","#1a3a4a",
  "#3a2a4a","#4a3a1a","#2a3a2a","#3a1a2a","#1a3a3a","#3a2a1a",
];

function bookColor(title: string) {
  let h = 0;
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return BOOK_COLORS[Math.abs(h) % BOOK_COLORS.length];
}

const STATUS: Record<string, { label: string; color: string; next: string }> = {
  pending: { label: "Por leer", color: "var(--mute)",  next: "reading" },
  reading: { label: "Leyendo",  color: "var(--gold)",  next: "done"    },
  done:    { label: "Leído",    color: "var(--green)", next: "pending" },
};

export function BookCard({ item }: { item: ReadingItem }) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [localPage, setLocalPage] = useState(item.current_page ?? 0);
  const [saving, setSaving] = useState(false);

  const st = STATUS[item.status] ?? STATUS.pending;
  const pct = item.total_pages && item.total_pages > 0
    ? Math.min(100, Math.round(((item.current_page ?? 0) / item.total_pages) * 100))
    : null;
  const localPct = item.total_pages && item.total_pages > 0
    ? Math.min(100, Math.round((localPage / item.total_pages) * 100))
    : null;
  const bg = bookColor(item.title ?? "?");

  async function cycleStatus() {
    const next = st.next;
    await supabase.from("reading_items").update({
      status: next,
      completed_at: next === "done" ? new Date().toISOString() : null,
    }).eq("id", item.id);
    router.refresh();
  }

  async function commitPage(page: number) {
    setSaving(true);
    await supabase.from("reading_items")
      .update({ current_page: page })
      .eq("id", item.id);
    setSaving(false);
    router.refresh();
  }

  return (
    <>
      <div className="rd-book-card">
        <div className="rd-cover" style={{ background: bg }}>
          {item.cover_url
            ? <img src={item.cover_url} alt={item.title ?? ""} />
            : <span className="rd-cover-initial">{(item.title ?? "?")[0].toUpperCase()}</span>
          }
        </div>

        <div className="rd-book-info">
          <p className="rd-book-title">{item.title ?? "Sin título"}</p>
          {item.source && <p className="rd-book-author">{item.source}</p>}
          {item.summary && <p className="rd-book-summary">{item.summary}</p>}

          {item.total_pages && item.total_pages > 0 && (
            <div className="rd-progress-wrap">
              <div className="rd-progress-bar">
                <div className="rd-progress-fill" style={{ width: `${localPct}%` }} />
              </div>
              <div className="rd-progress-meta">
                <input
                  type="number"
                  className="rd-page-input"
                  value={localPage}
                  min={0}
                  max={item.total_pages}
                  onChange={(e) => setLocalPage(Math.max(0, parseInt(e.target.value) || 0))}
                  onBlur={() => commitPage(localPage)}
                  disabled={saving}
                />
                <span className="tick">/ {item.total_pages} pgs · {localPct}%</span>
              </div>
            </div>
          )}

          <div className="rd-book-actions">
            <button
              className="tag"
              onClick={cycleStatus}
              style={{ borderColor: st.color, color: st.color, fontSize: 10, cursor: "pointer" }}
            >
              {st.label}
            </button>
            <button
              className="tag"
              onClick={() => setEditing(true)}
              style={{ fontSize: 10, cursor: "pointer" }}
            >
              Editar
            </button>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="tag"
                style={{ fontSize: 10 }}
              >
                Ver
              </a>
            )}
          </div>
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
