"use client";
import { useState, useEffect } from "react";
import { Plus, FileText, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CustomPage } from "@/lib/supabase/types";

export default function PaginasPage() {
  const supabase = createClient();
  const [pages, setPages] = useState<CustomPage[]>([]);
  const [selected, setSelected] = useState<CustomPage | null>(null);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from("custom_pages")
      .select("*")
      .eq("active", true)
      .order("sort_order")
      .order("created_at");
    setPages(data ?? []);
    setLoading(false);
  }

  function selectPage(page: CustomPage) {
    setSelected(page);
    setTitle(page.title);
    setContent(page.content ?? "");
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    await supabase.from("custom_pages").update({ title, content }).eq("id", selected.id);
    setSaving(false);
    await load();
  }

  async function newPage() {
    const { data } = await supabase
      .from("custom_pages")
      .insert({ title: "Sin título", emoji: "📄", content: "", active: true, sort_order: 0 })
      .select()
      .single();
    if (data) {
      await load();
      selectPage(data);
    }
  }

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {/* Sidebar */}
      <div
        style={{
          width: 240, borderRight: "1px solid var(--glass-bd)",
          background: "rgba(6,6,8,0.3)", padding: "16px 8px",
          flexShrink: 0, overflowY: "auto",
        }}
      >
        <div className="flex items-center justify-between px-3 mb-4">
          <span className="eyebrow">Páginas</span>
          <button className="tb-btn" onClick={newPage}>
            <Plus size={14} />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col gap-1 px-2">
            {[1, 2, 3].map((i) => <div key={i} className="shimmer h-9 rounded-lg" />)}
          </div>
        ) : pages.length === 0 ? (
          <p className="tick px-3 py-4 text-center">Sin páginas</p>
        ) : (
          pages.map((page) => (
            <button
              key={page.id}
              className={`nav-item w-full ${selected?.id === page.id ? "active" : ""}`}
              onClick={() => selectPage(page)}
            >
              <span>{page.emoji ?? "📄"}</span>
              <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {page.title}
              </span>
            </button>
          ))
        )}
      </div>

      {/* Editor */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {selected ? (
          <div className="editor">
            <textarea
              className="editor-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={save}
              rows={1}
              placeholder="Sin título"
              style={{ height: "auto" }}
            />
            <textarea
              className="editor-body"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={save}
              placeholder="Empieza a escribir..."
            />
            {saving && <p className="tick mt-2">Guardando...</p>}
          </div>
        ) : (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <FileText size={40} style={{ color: "var(--mute-2)" }} />
            <p style={{ color: "var(--mute)" }}>Selecciona o crea una página</p>
            <button className="btn btn-primary" onClick={newPage}>
              <Plus size={14} /> Nueva página
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
