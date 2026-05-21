"use client";
import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { THEMES, applyTheme } from "@/lib/themes";
import { X } from "lucide-react";

export function AjustesDrawer() {
  const { ajustesOpen, setAjustesOpen, ajustes, setAjustes, setTheme } = useAppStore();

  useEffect(() => {
    applyTheme(ajustes.theme);
  }, [ajustes.theme]);

  if (!ajustesOpen) return null;

  return (
    <>
      <div className="ajustes-backdrop" onClick={() => setAjustesOpen(false)} />
      <aside className="ajustes-drawer">
        <div className="ajustes-header flex items-center justify-between">
          <div>
            <p className="eyebrow-gold mb-1">Sistema</p>
            <h2 className="serif" style={{ fontSize: 22, color: "var(--bone)" }}>
              Ajustes
            </h2>
          </div>
          <button className="tb-btn" onClick={() => setAjustesOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="ajustes-body">
          {/* Themes */}
          <div>
            <p className="ajustes-section-label">Tema</p>
            <div className="theme-grid">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  className={`theme-swatch ${ajustes.theme === t.id ? "active" : ""}`}
                  style={{ background: t.bg, color: t.accent }}
                  onClick={() => setTheme(t.id)}
                  title={t.label}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: t.accent,
                      display: "block",
                    }}
                  />
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  className={`tag cursor-pointer ${ajustes.theme === t.id ? "tag-gold" : ""}`}
                  onClick={() => setTheme(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font */}
          <div>
            <p className="ajustes-section-label">Fuente</p>
            <div className="flex gap-2">
              {([
                { id: "geist", label: "Geist" },
                { id: "instrument", label: "Serif" },
                { id: "mono", label: "Mono" },
              ] as const).map((f) => (
                <button
                  key={f.id}
                  className={`tag cursor-pointer ${ajustes.font === f.id ? "tag-gold" : ""}`}
                  onClick={() => setAjustes({ font: f.id })}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Radius */}
          <div>
            <p className="ajustes-section-label">Bordes</p>
            <div className="flex gap-2">
              {([
                { id: "compact", label: "Compact" },
                { id: "default", label: "Default" },
                { id: "round", label: "Round" },
              ] as const).map((r) => (
                <button
                  key={r.id}
                  className={`tag cursor-pointer ${ajustes.radius === r.id ? "tag-gold" : ""}`}
                  onClick={() => setAjustes({ radius: r.id })}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="divider" />

          {/* Info */}
          <div>
            <p className="ajustes-section-label">Sistema</p>
            <div className="card-sm flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="tick">Versión</span>
                <span className="tick">Valle OS 1.0</span>
              </div>
              <div className="flex justify-between">
                <span className="tick">Modelo IA</span>
                <span className="tick" style={{ color: "var(--gold)" }}>Claude Sonnet 4.6</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
