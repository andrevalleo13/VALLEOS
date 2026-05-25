"use client";
import { useEffect, useCallback, useState } from "react";
import { useAppStore } from "@/lib/store";
import { THEMES, applyTheme } from "@/lib/themes";
import { ColorPicker } from "@/components/ColorPicker";
import { darken, toRgba } from "@/lib/colors";
import { X, RotateCcw, RefreshCw } from "lucide-react";

const ACCENT_PRESETS = [
  "#C9A35F", "#5B8DB8", "#7FA98C", "#8B77CC", "#D96B58",
  "#E8A87C", "#6BB8C4", "#F5C842", "#E87BC4", "#60A5FA",
];
const BG_PRESETS = [
  "#0B0B0E", "#090D14", "#090E0B", "#130A09", "#0A0814", "#101018",
];
const BONE_PRESETS = [
  "#F5F2EA", "#E8EEF5", "#EAF0EC", "#F5EEE8", "#EEE8F8", "#FFFFFF",
];

export function AjustesDrawer() {
  const { ajustesOpen, setAjustesOpen, ajustes, setAjustes, setTheme } = useAppStore();
  const [syncing, setSyncing] = useState<"idle" | "loading" | "ok" | "error">("idle");

  async function syncMemory() {
    setSyncing("loading");
    try {
      const res = await fetch("/api/shadow/sync-memory", { method: "POST" });
      setSyncing(res.ok ? "ok" : "error");
    } catch {
      setSyncing("error");
    }
    setTimeout(() => setSyncing("idle"), 3000);
  }
  const customColors = ajustes.customColors ?? {};

  const apply = useCallback(() => {
    applyTheme(ajustes.theme, ajustes.customColors ?? {});
  }, [ajustes.theme, ajustes.customColors]);

  useEffect(() => { apply(); }, [apply]);

  if (!ajustesOpen) return null;

  const hasCustom = Object.keys(customColors).length > 0;
  const currentTheme = THEMES.find((t) => t.id === ajustes.theme);

  function setAccent(hex: string) {
    setAjustes({
      customColors: {
        ...customColors,
        "--gold": hex,
        "--gold-2": darken(hex, 0.15),
        "--gold-glow": toRgba(hex, 0.25),
      },
    });
  }

  function setBg(hex: string) {
    setAjustes({
      customColors: {
        ...customColors,
        "--bg": hex,
        "--bg-deep": darken(hex, 0.4),
      },
    });
  }

  function setBone(hex: string) {
    setAjustes({
      customColors: {
        ...customColors,
        "--bone": hex,
        "--bone-dim": darken(hex, 0.14),
      },
    });
  }

  function resetColors() {
    setAjustes({ customColors: {} });
  }

  function selectTheme(id: typeof ajustes.theme) {
    setTheme(id);
    resetColors();
  }

  const accentVal = customColors["--gold"] ?? currentTheme?.accent ?? "#C9A35F";
  const bgVal     = customColors["--bg"]    ?? currentTheme?.bg    ?? "#0B0B0E";
  const boneVal   = customColors["--bone"]  ?? "#F5F2EA";

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
          {/* Tema base */}
          <div>
            <p className="ajustes-section-label">Tema base</p>
            <div className="theme-grid">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  className={`theme-swatch ${ajustes.theme === t.id && !hasCustom ? "active" : ""}`}
                  style={{ background: t.bg }}
                  onClick={() => selectTheme(t.id)}
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
                  className={`tag cursor-pointer ${ajustes.theme === t.id && !hasCustom ? "tag-gold" : ""}`}
                  onClick={() => selectTheme(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Personalizar colores */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p className="ajustes-section-label" style={{ marginBottom: 0 }}>Personalizar</p>
              {hasCustom && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 11, padding: "3px 10px", gap: 5 }}
                  onClick={resetColors}
                >
                  <RotateCcw size={10} />
                  Resetear
                </button>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <span className="tick" style={{ display: "block", marginBottom: 10, color: "var(--mute)" }}>
                  Acento
                </span>
                <ColorPicker value={accentVal} onChange={setAccent} presets={ACCENT_PRESETS} />
              </div>
              <div>
                <span className="tick" style={{ display: "block", marginBottom: 10, color: "var(--mute)" }}>
                  Fondo
                </span>
                <ColorPicker value={bgVal} onChange={setBg} presets={BG_PRESETS} />
              </div>
              <div>
                <span className="tick" style={{ display: "block", marginBottom: 10, color: "var(--mute)" }}>
                  Texto
                </span>
                <ColorPicker value={boneVal} onChange={setBone} presets={BONE_PRESETS} />
              </div>
            </div>

            {hasCustom && (
              <div
                style={{
                  marginTop: 16,
                  padding: "10px 14px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-bd)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{ width: 14, height: 14, borderRadius: "50%", background: accentVal, display: "block" }} />
                  <span style={{ width: 14, height: 14, borderRadius: "50%", background: bgVal, display: "block" }} />
                  <span style={{ width: 14, height: 14, borderRadius: "50%", background: boneVal, display: "block" }} />
                </div>
                <span className="tick" style={{ color: "var(--gold)" }}>Tema personalizado activo</span>
              </div>
            )}
          </div>

          {/* Tipografía */}
          <div>
            <p className="ajustes-section-label">Tipografía</p>
            <div className="flex gap-2">
              {([
                { id: "geist",      label: "Geist",     style: "Geist, sans-serif" },
                { id: "instrument", label: "Serif",      style: "Instrument Serif, serif" },
                { id: "mono",       label: "Mono",       style: "Geist Mono, monospace" },
              ] as const).map((f) => (
                <button
                  key={f.id}
                  className={`tag cursor-pointer ${ajustes.font === f.id ? "tag-gold" : ""}`}
                  onClick={() => setAjustes({ font: f.id })}
                  style={{ fontFamily: f.style }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bordes */}
          <div>
            <p className="ajustes-section-label">Bordes</p>
            <div className="flex gap-2">
              {([
                { id: "compact", label: "Compact" },
                { id: "default", label: "Default" },
                { id: "round",   label: "Round" },
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

          <div className="divider" />

          {/* Memoria de Claude */}
          <div>
            <p className="ajustes-section-label">Memoria de Claude</p>
            <div className="card-sm flex flex-col gap-3">
              <span className="tick" style={{ color: "var(--mute)", lineHeight: 1.5 }}>
                Exporta tus datos a la memoria de Claude para que tenga contexto de tu vida en futuras conversaciones.
              </span>
              <button
                className="btn btn-ghost btn-sm"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 12,
                  color: syncing === "ok" ? "var(--green)" : syncing === "error" ? "var(--red)" : "var(--gold)",
                  borderColor: syncing === "ok" ? "var(--green)" : syncing === "error" ? "var(--red)" : undefined,
                }}
                onClick={syncMemory}
                disabled={syncing === "loading"}
              >
                <RefreshCw size={12} style={{ animation: syncing === "loading" ? "spin 1s linear infinite" : undefined }} />
                {syncing === "idle" ? "Sync memoria" : syncing === "loading" ? "Sincronizando..." : syncing === "ok" ? "¡Listo!" : "Error al sincronizar"}
              </button>
            </div>
          </div>

          {/* Sistema */}
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
