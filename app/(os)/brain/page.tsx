"use client";
import { useState, useEffect } from "react";
import { Plus, Search, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { BrainNote } from "@/lib/supabase/types";

export default function BrainPage() {
  const supabase = createClient();
  const [notes, setNotes] = useState<BrainNote[]>([]);
  const [search, setSearch] = useState("");
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from("brain_notes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setNotes(data ?? []);
    setLoading(false);
  }

  async function save() {
    if (!newNote.trim()) return;
    setSaving(true);
    await supabase.from("brain_notes").insert({ content: newNote.trim(), source: "quick_capture" });
    setNewNote("");
    setSaving(false);
    await load();
  }

  const filtered = notes.filter((n) =>
    n.content.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000 / 60);
    if (diff < 60) return `hace ${diff}min`;
    if (diff < 1440) return `hace ${Math.floor(diff / 60)}h`;
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="eyebrow mb-2">Segundo cerebro</p>
            <h1 className="page-title">Brain</h1>
          </div>
        </div>

        {/* Quick capture */}
        <div style={{ display: "flex", gap: 10 }}>
          <textarea
            className="capture-input flex-1"
            rows={2}
            placeholder="Captura un pensamiento, idea, observación..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
            }}
          />
          <button
            className="btn btn-primary"
            onClick={save}
            disabled={saving || !newNote.trim()}
            style={{ alignSelf: "flex-end", flexShrink: 0 }}
          >
            {saving ? "..." : <Plus size={16} />}
          </button>
        </div>

        {/* Search */}
        <div style={{ marginTop: 12, position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--mute)" }} />
          <input
            className="input"
            style={{ paddingLeft: 40 }}
            placeholder="Buscar en Brain..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="page-body">
        <div className="flex items-center justify-between mb-4">
          <p className="eyebrow">{filtered.length} notas</p>
          {search && (
            <button className="tick hover:text-[var(--bone)] cursor-pointer" onClick={() => setSearch("")}>
              Limpiar búsqueda
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => <div key={i} className="shimmer h-16 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-12">
            <Sparkles size={32} style={{ color: "var(--mute-2)", margin: "0 auto 12px" }} />
            <p style={{ color: "var(--mute)", fontSize: 14 }}>
              {search ? "Sin resultados para esa búsqueda" : "Brain vacío — empieza capturando pensamientos"}
            </p>
          </div>
        ) : (
          <div className="notes-list">
            {filtered.map((note) => (
              <div key={note.id} className="note-item">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-start gap-2">
                    <p
                      style={{
                        flex: 1,
                        fontSize: 14,
                        color: "var(--bone-dim)",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {note.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="tag" style={{ fontSize: 10 }}>{note.source}</span>
                    <span className="tick">{formatDate(note.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
