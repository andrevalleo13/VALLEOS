import { createClient } from "@/lib/supabase/server";
import { Plus, BookOpen } from "lucide-react";
import type { ReadingItem } from "@/lib/supabase/types";

export const revalidate = 0;

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Por leer", color: "var(--mute)" },
  reading: { label: "Leyendo", color: "var(--gold)" },
  done: { label: "Leído", color: "var(--green)" },
  archived: { label: "Archivado", color: "var(--mute-2)" },
};

const TYPE_ICONS: Record<string, string> = {
  article: "📄", video: "📹", podcast: "🎧", paper: "📃", book: "📚", other: "🔗",
};

export default async function LecturaPage() {
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("reading_items")
    .select("*")
    .neq("status", "archived")
    .order("status")
    .order("added_at", { ascending: false });

  const reading = (items ?? []).filter((i) => i.status === "reading");
  const pending = (items ?? []).filter((i) => i.status === "pending");
  const done = (items ?? []).filter((i) => i.status === "done");

  return (
    <div>
      <div className="page-header">
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow mb-2">11 · LECTURAS</p>
            <h1 className="page-title">Lectura.</h1>
          </div>
          <button className="btn btn-primary btn-sm"><Plus size={14} /> Agregar</button>
        </div>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Leyendo", val: reading.length, color: "var(--gold)" },
            { label: "Por leer", val: pending.length, color: "var(--mute)" },
            { label: "Completados", val: done.length, color: "var(--green)" },
          ].map((k) => (
            <div key={k.label} className="card text-center">
              <p style={{ fontFamily: "var(--f-mono)", fontSize: 32, color: k.color }}>{k.val}</p>
              <p className="metric-label">{k.label}</p>
            </div>
          ))}
        </div>

        {(items ?? []).length === 0 ? (
          <div className="card text-center py-12">
            <BookOpen size={32} style={{ color: "var(--mute-2)", margin: "0 auto 12px" }} />
            <p style={{ color: "var(--mute)", fontSize: 14 }}>Reading list vacía</p>
            <p className="tick mt-1">Agrega artículos, videos y libros que quieras consumir</p>
          </div>
        ) : (
          <>
            {reading.length > 0 && (
              <div className="mb-6">
                <p className="eyebrow mb-3">Leyendo ahora</p>
                <div className="flex flex-col gap-2">
                  {reading.map((item) => <ReadingCard key={item.id} item={item} />)}
                </div>
              </div>
            )}

            {pending.length > 0 && (
              <div className="mb-6">
                <p className="eyebrow mb-3">Por leer ({pending.length})</p>
                <div className="flex flex-col gap-2">
                  {pending.map((item) => <ReadingCard key={item.id} item={item} />)}
                </div>
              </div>
            )}

            {done.length > 0 && (
              <div>
                <p className="eyebrow mb-3">Completados ({done.length})</p>
                <div className="flex flex-col gap-2">
                  {done.slice(0, 10).map((item) => <ReadingCard key={item.id} item={item} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ReadingCard({ item }: { item: ReadingItem }) {
  const status = STATUS_CONFIG[item.status] ?? { label: item.status, color: "var(--mute)" };
  return (
    <div className="note-item">
      <span style={{ fontSize: 18, flexShrink: 0 }}>{TYPE_ICONS[item.type] ?? "🔗"}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-start gap-2">
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, color: "var(--bone-dim)", fontWeight: 500 }}>
              {item.title ?? item.url}
            </p>
            {item.summary && (
              <p style={{ fontSize: 12, color: "var(--mute)", marginTop: 2, lineHeight: 1.5 }}>
                {item.summary}
              </p>
            )}
            {item.source && <p className="tick mt-1">{item.source}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="tag" style={{ borderColor: status.color, color: status.color, fontSize: 10 }}>
            {status.label}
          </span>
          {item.estimated_minutes && (
            <span className="tick" style={{ fontSize: 10 }}>⏱ {item.estimated_minutes}min</span>
          )}
          {item.notes && <span className="tag" style={{ fontSize: 10 }}>Notas</span>}
        </div>
      </div>
    </div>
  );
}
