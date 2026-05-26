"use client";
import { useState, useEffect } from "react";
import { Plus, Search, Sparkles, Link as LinkIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { BrainNote } from "@/lib/supabase/types";
import ObsidianVault from "@/components/brain/ObsidianVault";
import { getObsidianKey, getObsidianFolder, writeNote } from "@/lib/obsidian/client";

export default function BrainPage() {
  const supabase = createClient();
  const [notes, setNotes] = useState<BrainNote[]>([]);
  const [search, setSearch] = useState("");
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"brain" | "vault">("brain");
  const [obsidianKey, setObsidianKeyState] = useState("");
  const [tagging, setTagging] = useState<string | null>(null);

  useEffect(() => {
    load();
    setObsidianKeyState(getObsidianKey());
  }, []);

  async function load() {
    const { data } = await supabase
      .from("brain_notes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setNotes(data ?? []);
    setLoading(false);
  }

  async function save() {
    if (!newNote.trim()) return;
    setSaving(true);
    const content = newNote.trim();

    // Derive title from the first non-empty line
    const title = content.split("\n").find((l) => l.trim()) ?? content.slice(0, 60);

    // Push to Obsidian vault if connected (fire-and-forget, never blocks save)
    let obsidian_path: string | undefined;
    if (getObsidianKey()) {
      try {
        const safe = title.replace(/[/\\:*?"<>|#[\]^]/g, "").slice(0, 80).trim() || new Date().toISOString().slice(0, 19).replace(/:/g, "-");
        const folder = getObsidianFolder();
        obsidian_path = `${folder}/${safe}.md`;
        await writeNote(obsidian_path, `# ${title}\n\n${content}\n`);
      } catch {
        obsidian_path = undefined;
      }
    }

    const { data: inserted } = await supabase
      .from("brain_notes")
      .insert({ content, source: "quick_capture", title, obsidian_path })
      .select("id")
      .single();
    setNewNote("");
    setSaving(false);
    await load();

    // Shadow enlaza la nota: extrae etiquetas + notas relacionadas (no bloquea la captura)
    if (inserted?.id) {
      setTagging(inserted.id);
      try {
        await fetch("/api/brain/tag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: inserted.id }),
        });
        await load();
      } catch {
        /* noop */
      } finally {
        setTagging(null);
      }
    }
  }

  const byId = new Map(notes.map((n) => [n.id, n]));

  const filtered = notes.filter((n) => {
    const q = search.toLowerCase();
    return (
      n.content.toLowerCase().includes(q) ||
      (n.title ?? "").toLowerCase().includes(q) ||
      (n.tags ?? []).some((t) => t.toLowerCase().includes(q))
    );
  });

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const diff = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diff < 60) return `hace ${diff}min`;
    if (diff < 1440) return `hace ${Math.floor(diff / 60)}h`;
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <p className="eyebrow mb-2">04 · CONOCIMIENTO</p>
            <h1 className="page-title">Brain.</h1>
          </div>
          <div style={{ marginTop: 6 }}>
            <span className={`tag ${obsidianKey ? "ob-chip-on" : "ob-chip-off"}`}>
              Obsidian {obsidianKey ? "●" : "○"}
            </span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="seg" style={{ marginBottom: tab === "brain" ? 16 : 0 }}>
          <button className={`seg-btn${tab === "brain" ? " active" : ""}`} onClick={() => setTab("brain")}>Brain</button>
          <button
            className={`seg-btn${tab === "vault" ? " active" : ""}`}
            onClick={() => { setTab("vault"); setObsidianKeyState(getObsidianKey()); }}
          >
            Vault
          </button>
        </div>

        {/* Quick capture — solo en tab Brain */}
        {tab === "brain" && (
          <>
            <div style={{ display: "flex", gap: 10 }}>
              <textarea
                className="capture-input flex-1"
                rows={2}
                placeholder="Captura un pensamiento, idea, observación..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save(); }}
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
          </>
        )}
      </div>

      <div className="page-body">
        {tab === "vault" ? (
          <ObsidianVault />
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="eyebrow">{filtered.length} notas</p>
              {search && (
                <button className="tick hover:text-[var(--bone)] cursor-pointer" onClick={() => setSearch("")}>
                  Limpiar
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
                      {note.title && (
                        <p className="note-title" style={{ marginBottom: 4 }}>{note.title}</p>
                      )}
                      <p style={{ fontSize: 14, color: "var(--bone-dim)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {note.content}
                      </p>

                      {((note.tags ?? []).length > 0 || tagging === note.id) && (
                        <div className="bn-tags">
                          {tagging === note.id && (note.tags ?? []).length === 0 && (
                            <span className="bn-tagging"><Sparkles size={10} /> Shadow etiquetando…</span>
                          )}
                          {(note.tags ?? []).map((t) => (
                            <button key={t} className="bn-tag" onClick={() => setSearch(t)}>#{t}</button>
                          ))}
                        </div>
                      )}

                      {(note.related_ids ?? []).length > 0 && (
                        <div className="bn-related">
                          <LinkIcon size={11} />
                          <span className="tick">Relacionadas:</span>
                          {(note.related_ids ?? []).map((rid) => {
                            const r = byId.get(rid);
                            if (!r) return null;
                            const label = r.title ?? r.content.slice(0, 36);
                            return (
                              <button key={rid} className="bn-rel-chip" onClick={() => setSearch(label)} title={r.content.slice(0, 120)}>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex items-center gap-3 mt-2">
                        <span className="tag" style={{ fontSize: 10 }}>{note.source}</span>
                        {note.obsidian_path && <span className="tick">{note.obsidian_path}</span>}
                        <span className="tick">{formatDate(note.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
