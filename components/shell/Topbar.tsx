"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Search, Plus, Settings, Menu, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_TITLES: Record<string, string> = {
  "/": "Brief",
  "/centro": "Centro",
  "/shadow": "Shadow",
  "/finanzas": "Finanzas",
  "/brain": "Brain",
  "/calendario": "Calendario",
  "/habitos": "Hábitos",
  "/metas": "Metas",
  "/flouvia": "Flouvia",
  "/panamericana": "Panamericana",
  "/salud": "Salud",
  "/lectura": "Lectura",
  "/tiempo": "Tiempo",
  "/paginas": "Páginas",
  "/config": "Configuración",
};

function Clock() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }));
      setDate(now.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" }));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="tb-widget">
      <span>{time}</span>
      <span style={{ color: "var(--mute-2)" }}>·</span>
      <span style={{ textTransform: "capitalize" }}>{date}</span>
    </div>
  );
}

export function Topbar() {
  const pathname = usePathname();
  const { setCmdkOpen, setCaptureOpen, setAjustesOpen, setMobileMenu, focusMode, setFocusMode } = useAppStore();
  const title = PAGE_TITLES[pathname] ?? "Valle OS";

  return (
    <header className="shell-topbar">
      <button
        className="tb-btn md:hidden"
        onClick={() => setMobileMenu(true)}
        aria-label="Menu"
      >
        <Menu size={18} />
      </button>

      <h1 className="tb-title">{title}</h1>

      <Clock />

      <button
        className={cn("tb-widget", focusMode && "border-[var(--gold)] text-[var(--gold)]")}
        onClick={() => setFocusMode(!focusMode)}
        title="Focus mode"
      >
        <Zap size={14} />
        <span>Focus</span>
      </button>

      <button
        className="tb-btn"
        onClick={() => setCmdkOpen(true)}
        title="Búsqueda (⌘K)"
      >
        <Search size={16} />
      </button>

      <button
        className="tb-btn"
        onClick={() => setCaptureOpen(true)}
        title="Captura rápida"
      >
        <Plus size={18} />
      </button>

      <button
        className="tb-btn"
        onClick={() => setAjustesOpen(true)}
        title="Ajustes"
      >
        <Settings size={16} />
      </button>
    </header>
  );
}
