"use client";
import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, Check } from "lucide-react";
import {
  canInstall,
  subscribeInstall,
  promptInstall,
  isStandalone,
  isIOS,
} from "@/lib/pwa/install";

export function InstallApp() {
  const [, force] = useState(0);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone());
    setIos(isIOS());
    return subscribeInstall(() => force((n) => n + 1));
  }, []);

  if (standalone) {
    return (
      <div>
        <p className="ajustes-section-label">Aplicación</p>
        <div className="card-sm flex items-center gap-2">
          <Check size={14} style={{ color: "var(--green)" }} />
          <span className="tick" style={{ color: "var(--mute)" }}>
            Valle OS está instalada
          </span>
        </div>
      </div>
    );
  }

  const installable = canInstall();

  return (
    <div>
      <p className="ajustes-section-label">Instalar app</p>
      <div className="card-sm flex flex-col gap-3">
        <span className="tick" style={{ color: "var(--mute)", lineHeight: 1.5 }}>
          Instala Valle OS como app nativa en tu teléfono o escritorio — pantalla
          completa, ícono propio y notificaciones.
        </span>
        {installable ? (
          <button
            className="btn btn-primary btn-sm"
            style={{ alignSelf: "flex-start", gap: 7 }}
            onClick={() => promptInstall()}
          >
            <Download size={13} /> Instalar Valle OS
          </button>
        ) : ios ? (
          <span
            className="tick"
            style={{ color: "var(--bone-dim)", lineHeight: 1.8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5 }}
          >
            En Safari toca
            <Share size={13} style={{ color: "var(--gold)" }} />
            Compartir y luego
            <SquarePlus size={13} style={{ color: "var(--gold)" }} />
            «Agregar a inicio».
          </span>
        ) : (
          <span className="tick" style={{ color: "var(--mute)", lineHeight: 1.6 }}>
            Abre el menú del navegador (⋮) y elige «Instalar app».
          </span>
        )}
      </div>
    </div>
  );
}
