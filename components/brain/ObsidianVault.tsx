"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FolderOpen, FileText, ArrowLeft, RefreshCw,
  Plus, Search, Check, X, Trash2, ChevronRight, Settings,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getObsidianKey, setObsidianKey, getObsidianPort, setObsidianPort,
  getObsidianFolder, setObsidianFolder,
  testObsidian, listVault, readNote, writeNote, deleteNote, searchVault,
  type VaultEntry, type SearchMatch,
} from "@/lib/obsidian/client";

export default function ObsidianVault() {
  const supabase = createClient();

  const [connected, setConnected] = useState<boolean | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [portDraft, setPortDraft] = useState("27124");
  const [testing, setTesting] = useState(false);

  const [folderStack, setFolderStack] = useState<string[]>([]);
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchMatch[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [note, setNote] = useState<{ path: string; content: string } | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showNewNote, setShowNewNote] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [newContent, setNewContent] = useState("");

  const [folderDraft, setFolderDraft] = useState("Brain");

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const currentFolder = folderStack[folderStack.length - 1] ?? "";

  useEffect(() => {
    const k = getObsidianKey();
    if (k) {
      setKeyDraft(k);
      setPortDraft(getObsidianPort());
      setFolderDraft(getObsidianFolder());
      checkAndLoad(false);
    } else {
      setConnected(false);
    }
  }, []);

  async function checkAndLoad(updateCreds: boolean) {
    if (updateCreds) {
      setObsidianKey(keyDraft);
      setObsidianPort(portDraft);
      setObsidianFolder(folderDraft);
    }
    setTesting(true);
    const ok = await testObsidian();
    setTesting(false);
    setConnected(ok);
    if (ok) {
      setShowSetup(false);
      loadFolder("");
      const syncFolder = getObsidianFolder();
      autoSyncFolder(syncFolder);
      flushShadowOutbox(syncFolder);
    }
  }

  // Push notes Shadow created (in Supabase) that haven't reached the vault yet
  async function flushShadowOutbox(folder: string) {
    const { data: pending } = await supabase
      .from("brain_notes")
      .select("id, title, content")
      .is("obsidian_path", null)
      .in("source", ["shadow", "quick_capture"]);
    if (!pending?.length) return;

    for (const note of pending) {
      try {
        const raw = note.title ?? note.content.split("\n").find((l: string) => l.trim()) ?? note.content.slice(0, 60);
        const safe = raw.replace(/[/\\:*?"<>|#[\]^]/g, "").slice(0, 80).trim() ||
          new Date().toISOString().slice(0, 16).replace(/:/g, "-");
        const path = `${folder}/${safe}.md`;
        await writeNote(path, `# ${raw}\n\n${note.content}\n`);
        await supabase.from("brain_notes").update({ obsidian_path: path }).eq("id", note.id);
      } catch {
        // If Obsidian can't write this note, skip and continue
      }
    }
  }

  async function autoSyncFolder(folder: string) {
    try {
      const data = await listVault(folder);
      const mdFiles = data.filter((e) => !e.isDir && e.path.endsWith(".md"));
      for (const file of mdFiles) {
        const content = await readNote(file.path);
        const title = file.path.split("/").pop()?.replace(".md", "") ?? file.path;
        await supabase.from("brain_notes").upsert(
          { content, title, obsidian_path: file.path, source: "obsidian" },
          { onConflict: "obsidian_path" }
        );
      }
    } catch {
      // Obsidian might not have this folder yet — silently ignore
    }
  }

  async function loadFolder(folder: string) {
    setLoadingEntries(true);
    setSearch("");
    setSearchResults(null);
    try {
      const data = await listVault(folder);
      const sorted = [
        ...data.filter((e) => e.isDir),
        ...data.filter((e) => !e.isDir && e.path.endsWith(".md")),
        ...data.filter((e) => !e.isDir && !e.path.endsWith(".md") && !e.path.startsWith(".")),
      ].filter((e) => !e.path.split("/").pop()?.startsWith("."));
      setEntries(sorted);
    } catch {
      setConnected(false);
    } finally {
      setLoadingEntries(false);
    }
  }

  async function navigateInto(folderPath: string) {
    const newStack = [...folderStack, folderPath];
    setFolderStack(newStack);
    await loadFolder(folderPath);
  }

  async function navigateBack() {
    const newStack = folderStack.slice(0, -1);
    setFolderStack(newStack);
    await loadFolder(newStack[newStack.length - 1] ?? "");
  }

  async function navigateTo(index: number) {
    const folder = folderStack[index];
    setFolderStack(folderStack.slice(0, index + 1));
    await loadFolder(folder);
  }

  async function openNote(path: string) {
    try {
      const content = await readNote(path);
      setNote({ path, content });
      setEditContent(content);
      setEditing(false);
    } catch (e) {
      console.error(e);
    }
  }

  async function saveNote() {
    if (!note) return;
    setSaving(true);
    try {
      await writeNote(note.path, editContent);
      setNote({ path: note.path, content: editContent });
      setEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!note) return;
    setDeleting(true);
    try {
      await deleteNote(note.path);
      setNote(null);
      await loadFolder(currentFolder);
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  }

  async function createNote() {
    const path = newPath.trim();
    if (!path) return;
    const fullPath = path.endsWith(".md") ? path : `${path}.md`;
    setSaving(true);
    try {
      await writeNote(fullPath, newContent);
      setShowNewNote(false);
      setNewPath("");
      setNewContent("");
      await loadFolder(currentFolder);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const results = await searchVault(q);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(search), 400);
    return () => clearTimeout(t);
  }, [search, doSearch]);

  async function syncToSupabase() {
    const mdFiles = entries.filter((e) => !e.isDir && e.path.endsWith(".md"));
    if (!mdFiles.length) { setSyncMsg("Sin archivos .md en esta carpeta"); setTimeout(() => setSyncMsg(""), 3000); return; }
    setSyncing(true);
    setSyncMsg("");
    try {
      for (const file of mdFiles) {
        const content = await readNote(file.path);
        const title = file.path.split("/").pop()?.replace(".md", "") ?? file.path;
        await supabase.from("brain_notes").upsert(
          { content, title, obsidian_path: file.path, source: "obsidian" },
          { onConflict: "obsidian_path" }
        );
      }
      setSyncMsg(`${mdFiles.length} nota${mdFiles.length > 1 ? "s" : ""} sincronizada${mdFiles.length > 1 ? "s" : ""}`);
      setTimeout(() => setSyncMsg(""), 4000);
    } catch (e) {
      setSyncMsg("Error al sincronizar");
      setTimeout(() => setSyncMsg(""), 3000);
    } finally {
      setSyncing(false);
    }
  }

  // ── Setup screen ────────────────────────────────────────────────────────────
  if (connected === false && !getObsidianKey()) {
    return (
      <div className="ob-setup-card">
        <p className="eyebrow mb-2">Local REST API</p>
        <p style={{ fontSize: 13, color: "var(--mute)", lineHeight: 1.7, marginBottom: 16 }}>
          Instala el plugin <strong style={{ color: "var(--bone-dim)" }}>Local REST API</strong> en Obsidian
          y pega aquí tu API key.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: 6 }}>API Key</p>
            <input className="input" type="password" placeholder="Pega tu API key..." value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} />
          </div>
          <div>
            <p className="eyebrow" style={{ marginBottom: 6 }}>Puerto</p>
            <input className="input" placeholder="27124" value={portDraft} onChange={(e) => setPortDraft(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => checkAndLoad(true)} disabled={testing || !keyDraft.trim()}>
            {testing ? "Conectando..." : "Conectar Obsidian"}
          </button>
        </div>
        <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--bg-raised)", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)" }}>
          <p className="eyebrow mb-2">Pasos previos</p>
          <ol style={{ fontSize: 12, color: "var(--mute)", lineHeight: 1.9, paddingLeft: 16, margin: 0 }}>
            <li>Obsidian → Settings → Community plugins → busca <em>Local REST API</em></li>
            <li>Instala y activa el plugin</li>
            <li>En este browser abre <code style={{ color: "var(--gold)" }}>https://127.0.0.1:27124</code> y acepta el certificado</li>
            <li>Copia la API key desde Settings → Local REST API</li>
          </ol>
        </div>
      </div>
    );
  }

  // ── Main vault browser ───────────────────────────────────────────────────────
  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--mute)", pointerEvents: "none" }} />
          <input className="input" style={{ paddingLeft: 36 }} placeholder="Buscar en vault..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-ghost" onClick={syncToSupabase} disabled={syncing} title="Sincronizar carpeta con Brain (Shadow podrá leer estas notas)" style={{ gap: 6, fontSize: 12 }}>
          {syncMsg.includes("sincronizada") ? <Check size={14} style={{ color: "var(--green)" }} /> : <RefreshCw size={14} className={syncing ? "spin" : ""} />}
          {syncMsg || "Sync →Brain"}
        </button>
        <button className="btn btn-ghost" style={{ padding: "0 10px" }} onClick={() => { setKeyDraft(getObsidianKey()); setPortDraft(getObsidianPort()); setShowSetup(true); }} title="Configuración">
          <Settings size={14} />
        </button>
        <button className="btn btn-primary" style={{ gap: 4, fontSize: 12 }} onClick={() => { setNewPath(currentFolder ? `${currentFolder}/` : ""); setShowNewNote(true); }}>
          <Plus size={14} /> Nota
        </button>
      </div>

      {/* Breadcrumb */}
      {folderStack.length > 0 && (
        <div className="ob-breadcrumb">
          <button className="ob-bc-item" onClick={() => { setFolderStack([]); loadFolder(""); }}>Vault</button>
          {folderStack.map((folder, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <ChevronRight size={11} style={{ color: "var(--mute-2)" }} />
              <button className="ob-bc-item" onClick={() => navigateTo(i)}>
                {folder.split("/").pop()}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Content */}
      {search ? (
        <div className="notes-list">
          {searching && <p className="tick" style={{ padding: 12 }}>Buscando...</p>}
          {!searching && searchResults?.length === 0 && <p className="tick" style={{ padding: 12 }}>Sin resultados</p>}
          {searchResults?.map((r) => (
            <div key={r.filename} className="note-item" onClick={() => openNote(r.filename)}>
              <FileText size={14} style={{ color: "var(--mute)", flexShrink: 0, marginTop: 2 }} />
              <div style={{ minWidth: 0 }}>
                <p className="note-title" style={{ fontSize: 13 }}>{r.filename.split("/").pop()?.replace(".md", "")}</p>
                <p className="tick">{r.filename}</p>
                {r.matches?.[0]?.context && (
                  <p style={{ fontSize: 12, color: "var(--mute)", marginTop: 4, lineHeight: 1.5 }}>…{r.matches[0].context}…</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : loadingEntries ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="shimmer h-10 rounded-xl" />)}
        </div>
      ) : (
        <div className="notes-list">
          {folderStack.length > 0 && (
            <div className="ob-file-item ob-file-dir" onClick={navigateBack}>
              <ArrowLeft size={13} style={{ color: "var(--mute)" }} />
              <span style={{ fontSize: 13, color: "var(--mute)" }}>volver</span>
            </div>
          )}
          {entries.length === 0 && <p className="tick" style={{ padding: 12 }}>Carpeta vacía</p>}
          {entries.map((entry) => (
            <div
              key={entry.path}
              className={`ob-file-item${entry.isDir ? " ob-file-dir" : ""}`}
              onClick={() => entry.isDir ? navigateInto(entry.path) : openNote(entry.path)}
            >
              {entry.isDir
                ? <FolderOpen size={14} style={{ color: "var(--gold)", flexShrink: 0 }} />
                : <FileText size={14} style={{ color: "var(--mute)", flexShrink: 0 }} />
              }
              <span className={entry.isDir ? "ob-name-dir" : "ob-name-file"}>
                {entry.path.split("/").pop()}
              </span>
              {entry.isDir && <ChevronRight size={12} style={{ color: "var(--mute-2)", marginLeft: "auto" }} />}
            </div>
          ))}
        </div>
      )}

      {/* Note modal */}
      {note && (
        <div className="modal-backdrop" onClick={() => !editing && setNote(null)}>
          <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="tick" style={{ marginBottom: 2 }}>{note.path}</p>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--bone)" }}>
                  {note.path.split("/").pop()?.replace(".md", "")}
                </h3>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {!editing ? (
                  <>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setEditing(true)}>Editar</button>
                    <button className="btn btn-ghost" style={{ padding: "0 8px", color: "var(--red)" }} onClick={handleDelete} disabled={deleting}>
                      <Trash2 size={13} />
                    </button>
                    <button className="btn btn-ghost" style={{ padding: "0 8px" }} onClick={() => setNote(null)}>
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setEditing(false); setEditContent(note.content); }}>Cancelar</button>
                    <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={saveNote} disabled={saving}>
                      {saving ? "..." : "Guardar"}
                    </button>
                  </>
                )}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
              {editing ? (
                <textarea
                  className="capture-input"
                  style={{ width: "100%", minHeight: 380, resize: "vertical", fontFamily: "var(--f-mono)", fontSize: 13, lineHeight: 1.7 }}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                />
              ) : (
                <pre style={{ fontSize: 13, color: "var(--bone-dim)", lineHeight: 1.75, whiteSpace: "pre-wrap", fontFamily: "var(--f-mono)", margin: 0 }}>
                  {note.content}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New note modal */}
      {showNewNote && (
        <div className="modal-backdrop" onClick={() => setShowNewNote(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--bone)" }}>Nueva nota</h3>
              <button className="btn btn-ghost" style={{ padding: "0 8px" }} onClick={() => setShowNewNote(false)}><X size={14} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <p className="eyebrow" style={{ marginBottom: 6 }}>Ruta en vault</p>
                <input className="input" placeholder="carpeta/nombre-nota.md" value={newPath} onChange={(e) => setNewPath(e.target.value)} />
              </div>
              <div>
                <p className="eyebrow" style={{ marginBottom: 6 }}>Contenido</p>
                <textarea
                  className="capture-input"
                  rows={7}
                  style={{ fontFamily: "var(--f-mono)", fontSize: 13 }}
                  placeholder={"# Título\n\nEscribe aquí..."}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={createNote} disabled={saving || !newPath.trim()}>
                {saving ? "Creando..." : "Crear nota"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSetup && (
        <div className="modal-backdrop" onClick={() => setShowSetup(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--bone)" }}>Configurar Obsidian</h3>
              <button className="btn btn-ghost" style={{ padding: "0 8px" }} onClick={() => setShowSetup(false)}><X size={14} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <p className="eyebrow" style={{ marginBottom: 6 }}>API Key</p>
                <input className="input" type="password" placeholder="API key del plugin" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} />
              </div>
              <div>
                <p className="eyebrow" style={{ marginBottom: 6 }}>Puerto</p>
                <input className="input" placeholder="27124" value={portDraft} onChange={(e) => setPortDraft(e.target.value)} />
              </div>
              <div>
                <p className="eyebrow" style={{ marginBottom: 6 }}>Carpeta de sync (Brain → Vault)</p>
                <input className="input" placeholder="Brain" value={folderDraft} onChange={(e) => setFolderDraft(e.target.value)} />
                <p style={{ fontSize: 11, color: "var(--mute)", marginTop: 4 }}>
                  Las notas del quick capture se guardan aquí. También se auto-sincroniza al abrir.
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => checkAndLoad(true)} disabled={testing || !keyDraft.trim()}>
                {testing ? "Probando..." : "Guardar y reconectar"}
              </button>
              {connected === false && getObsidianKey() && (
                <p style={{ fontSize: 12, color: "var(--red)", textAlign: "center" }}>
                  Sin conexión — ¿Obsidian está abierto con el plugin activo?
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
