import { createClient } from "@/lib/supabase/server";
import { BookOpen } from "lucide-react";
import { AddReading } from "./AddReading";
import { BookCard } from "./BookCard";
import { ContentCard } from "./ContentCard";
import type { ReadingItem } from "@/lib/supabase/types";

export const revalidate = 0;

export default async function LecturaPage() {
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("reading_items")
    .select("*")
    .neq("status", "archived")
    .order("added_at", { ascending: false });

  const all = (items ?? []) as ReadingItem[];
  const reading = all.filter((i) => i.status === "reading");
  const pending  = all.filter((i) => i.status === "pending");
  const done     = all.filter((i) => i.status === "done");

  const books    = all.filter((i) => i.type === "book").length;
  const content  = all.filter((i) => i.type !== "book").length;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow mb-2">12 · LECTURAS</p>
            <h1 className="page-title">Lectura.</h1>
          </div>
          <div style={{ textAlign: "right", marginTop: 4 }}>
            <AddReading />
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 32 }}>
          {[
            { label: "Leyendo",     val: reading.length, color: "var(--gold)" },
            { label: "Por leer",    val: pending.length,  color: "var(--mute)" },
            { label: "Completados", val: done.length,     color: "var(--green)" },
            { label: "Libros",      val: books,           color: "var(--bone-dim)" },
          ].map((k) => (
            <div key={k.label} className="card" style={{ textAlign: "center" }}>
              <p style={{ fontFamily: "var(--f-mono)", fontSize: 28, color: k.color }}>{k.val}</p>
              <p className="metric-label">{k.label}</p>
            </div>
          ))}
        </div>

        {all.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
            <BookOpen size={32} style={{ color: "var(--mute-2)", margin: "0 auto 12px" }} />
            <p style={{ color: "var(--mute)", fontSize: 14 }}>Lista de lectura vacía</p>
            <p className="tick" style={{ marginTop: 4, marginBottom: 16 }}>
              Agrega libros, artículos, videos o podcasts
            </p>
            <AddReading label="Agregar primero" />
          </div>
        ) : (
          <>
            <Section title="Leyendo ahora" items={reading} />
            <Section title={`Por leer (${pending.length})`} items={pending} />
            {done.length > 0 && (
              <Section title={`Completados (${done.length})`} items={done.slice(0, 20)} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: ReadingItem[] }) {
  if (items.length === 0) return null;

  const books   = items.filter((i) => i.type === "book");
  const content = items.filter((i) => i.type !== "book");

  return (
    <div style={{ marginBottom: 32 }}>
      <p className="eyebrow" style={{ marginBottom: 16 }}>{title}</p>

      {books.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: content.length > 0 ? 12 : 0 }}>
          {books.map((item) => <BookCard key={item.id} item={item} />)}
        </div>
      )}

      {content.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {content.map((item) => <ContentCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}
