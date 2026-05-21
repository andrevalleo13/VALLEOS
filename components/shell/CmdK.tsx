"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { useAppStore } from "@/lib/store";
import {
  Home, Grid3x3, Sparkles, DollarSign, Brain, Calendar,
  CheckSquare, Target, Briefcase, BookOpen, Heart, Clock,
  FileText, Settings, Moon, Plus, Search, Zap
} from "lucide-react";

const COMMANDS = [
  { group: "Navegar", items: [
    { label: "Brief", icon: Home, href: "/" },
    { label: "Centro", icon: Grid3x3, href: "/centro" },
    { label: "Shadow", icon: Sparkles, href: "/shadow" },
    { label: "Finanzas", icon: DollarSign, href: "/finanzas" },
    { label: "Brain", icon: Brain, href: "/brain" },
    { label: "Calendario", icon: Calendar, href: "/calendario" },
    { label: "Hábitos", icon: CheckSquare, href: "/habitos" },
    { label: "Metas", icon: Target, href: "/metas" },
    { label: "Flouvia", icon: Briefcase, href: "/flouvia" },
    { label: "Panamericana", icon: BookOpen, href: "/panamericana" },
    { label: "Salud", icon: Heart, href: "/salud" },
    { label: "Lectura", icon: BookOpen, href: "/lectura" },
    { label: "Tiempo", icon: Clock, href: "/tiempo" },
    { label: "Páginas", icon: FileText, href: "/paginas" },
  ]},
  { group: "Acciones", items: [
    { label: "Captura rápida", icon: Plus, action: "capture" },
    { label: "Cierre nocturno", icon: Moon, action: "cierre" },
    { label: "Configuración", icon: Settings, href: "/config" },
  ]},
];

export function CmdK() {
  const { cmdkOpen, setCmdkOpen, setCaptureOpen, setCierreOpen } = useAppStore();
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdkOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setCmdkOpen]);

  if (!cmdkOpen) return null;

  function run(item: { href?: string; action?: string }) {
    setCmdkOpen(false);
    if (item.href) router.push(item.href);
    if (item.action === "capture") setCaptureOpen(true);
    if (item.action === "cierre") setCierreOpen(true);
  }

  return (
    <div className="cmdk-backdrop" onClick={() => setCmdkOpen(false)}>
      <Command
        className="cmdk"
        onClick={(e) => e.stopPropagation()}
        shouldFilter
        loop
      >
        <div className="flex items-center border-b border-[var(--glass-bd)] px-4">
          <Search size={16} style={{ color: "var(--mute)", flexShrink: 0 }} />
          <Command.Input
            className="cmdk-input pl-3"
            placeholder="Buscar páginas, acciones..."
            autoFocus
          />
        </div>
        <Command.List className="cmdk-results">
          <Command.Empty className="px-4 py-8 text-center text-sm" style={{ color: "var(--mute)" }}>
            Sin resultados
          </Command.Empty>
          {COMMANDS.map((group) => (
            <Command.Group key={group.group} heading={<span className="cmdk-section">{group.group}</span>}>
              {group.items.map((item) => (
                <Command.Item
                  key={item.label}
                  value={item.label}
                  className="cmdk-row"
                  onSelect={() => run(item)}
                >
                  <item.icon size={16} />
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}
