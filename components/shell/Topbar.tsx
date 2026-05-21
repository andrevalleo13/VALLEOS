"use client";
import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { Bell, Menu, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Topbar() {
  const {
    setCmdkOpen,
    setCaptureOpen,
    setCierreOpen,
    setAjustesOpen,
    setMobileMenu,
    focusMode,
    setFocusMode,
  } = useAppStore();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        setCaptureOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        setCierreOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCaptureOpen, setCierreOpen]);

  return (
    <header className="shell-topbar">
      <button
        className="tb-btn md:hidden"
        onClick={() => setMobileMenu(true)}
        aria-label="Menú"
      >
        <Menu size={16} />
      </button>

      <div style={{ flex: 1 }} />

      {/* Keyboard shortcut chips */}
      <button className="tb-shortcut" onClick={() => setCmdkOpen(true)} title="Búsqueda global">
        ⌘K
      </button>
      <button className="tb-shortcut" onClick={() => setCaptureOpen(true)} title="Captura rápida">
        ⌘J
      </button>
      <button className="tb-shortcut" onClick={() => setCierreOpen(true)} title="Cierre nocturno">
        ⌘.
      </button>

      <div className="tb-divider" />

      {/* Mode buttons */}
      <button
        className={cn("tb-mode-btn", focusMode && "active")}
        onClick={() => setFocusMode(!focusMode)}
        title="Modo silencio"
      >
        <Moon size={11} style={{ display: "inline", marginRight: 5, verticalAlign: "middle" }} />
        Silencio
      </button>

      <button
        className="tb-mode-btn"
        onClick={() => setAjustesOpen(true)}
        title="Ajustes"
      >
        Ajustes
      </button>

      <div className="tb-divider" />

      {/* Notification bell */}
      <button className="tb-btn" aria-label="Notificaciones">
        <Bell size={15} />
      </button>
    </header>
  );
}
