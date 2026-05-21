"use client";
import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { THEMES, applyTheme } from "@/lib/themes";
import { createClient } from "@/lib/supabase/client";
import { User, Palette, Bell, Database, Shield, ChevronRight, Save } from "lucide-react";
import type { UserPreferences } from "@/lib/supabase/types";

export default function ConfigPage() {
  const { ajustes, setTheme } = useAppStore();
  const supabase = createClient();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from("user_preferences").select("*").single().then(({ data }) => {
      if (data) setPrefs(data);
    });
  }, []);

  async function savePrefs() {
    if (!prefs) return;
    setSaving(true);
    await supabase.from("user_preferences").update({
      display_name: prefs.display_name,
      vision_primary: prefs.vision_primary,
      vision_secondary: prefs.vision_secondary,
      vision_metadata: prefs.vision_metadata,
    }).eq("id", 1);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <div className="page-header">
        <p className="eyebrow mb-2">Sistema</p>
        <h1 className="page-title">Configuración</h1>
      </div>

      <div className="page-body">
        {/* Perfil */}
        {prefs && (
          <div className="card mb-6">
            <div className="flex items-center gap-3 mb-4">
              <User size={16} style={{ color: "var(--gold)" }} />
              <p className="eyebrow">Perfil</p>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="input-label">Nombre</label>
                <input
                  className="input"
                  value={prefs.display_name}
                  onChange={(e) => setPrefs({ ...prefs, display_name: e.target.value })}
                />
              </div>
              <div>
                <label className="input-label">Visión principal</label>
                <input
                  className="input"
                  value={prefs.vision_primary}
                  onChange={(e) => setPrefs({ ...prefs, vision_primary: e.target.value })}
                  placeholder="Tu meta más importante"
                />
              </div>
              <div>
                <label className="input-label">Visión a largo plazo</label>
                <input
                  className="input"
                  value={prefs.vision_secondary}
                  onChange={(e) => setPrefs({ ...prefs, vision_secondary: e.target.value })}
                  placeholder="Tu visión de 5 años"
                />
              </div>
              <div>
                <label className="input-label">Metadata de visión</label>
                <input
                  className="input"
                  value={prefs.vision_metadata}
                  onChange={(e) => setPrefs({ ...prefs, vision_metadata: e.target.value })}
                  placeholder="GPA · MRR · KPIs clave"
                />
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={savePrefs}
                disabled={saving}
                style={{ alignSelf: "flex-start" }}
              >
                <Save size={13} />
                {saved ? "¡Guardado!" : saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        )}

        {/* Tema */}
        <div className="card mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Palette size={16} style={{ color: "var(--gold)" }} />
            <p className="eyebrow">Tema</p>
          </div>
          <div className="theme-grid" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
            {THEMES.map((t) => (
              <button
                key={t.id}
                className={`theme-swatch ${ajustes.theme === t.id ? "active" : ""}`}
                style={{ background: t.bg }}
                onClick={() => { setTheme(t.id); applyTheme(t.id); }}
                title={t.label}
              >
                <span style={{ width: 16, height: 16, borderRadius: "50%", background: t.accent, display: "block" }} />
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            {THEMES.map((t) => (
              <button
                key={t.id}
                className={`tag cursor-pointer ${ajustes.theme === t.id ? "tag-gold" : ""}`}
                onClick={() => { setTheme(t.id); applyTheme(t.id); }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Other settings */}
        <div className="flex flex-col gap-2 mb-6">
          {[
            { icon: Bell, label: "Notificaciones", desc: "Shadow, hábitos, recordatorios" },
            { icon: Database, label: "Datos", desc: "Supabase · waxptyvzjitiscmcaxbz" },
            { icon: Shield, label: "Sesión", desc: "andrevalleo13@gmail.com" },
          ].map((s) => (
            <button key={s.label} className="card flex items-center gap-4 text-left w-full">
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--glass-bg-2)", border: "1px solid var(--glass-bd)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <s.icon size={18} style={{ color: "var(--gold)" }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 500, color: "var(--bone)", fontSize: 14 }}>{s.label}</p>
                <p className="tick">{s.desc}</p>
              </div>
              <ChevronRight size={16} style={{ color: "var(--mute-2)" }} />
            </button>
          ))}
        </div>

        {/* System info */}
        <div className="divider mb-4" />
        <div className="card-sm">
          <div className="flex flex-col gap-2">
            {[
              { k: "Versión", v: "Valle OS 1.0.0" },
              { k: "Shadow", v: "claude-sonnet-4-6" },
              { k: "Base de datos", v: "Supabase" },
              { k: "Plataforma", v: "Next.js 16 · Vercel" },
            ].map((row) => (
              <div key={row.k} className="flex justify-between">
                <span className="tick">{row.k}</span>
                <span className="tick" style={{ color: "var(--bone-dim)" }}>{row.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
