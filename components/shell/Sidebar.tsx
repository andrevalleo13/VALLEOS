"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Logo } from "@/components/Logo";
import {
  Home, Grid3x3, Sparkles, DollarSign, Brain, Calendar,
  CheckSquare, Target, Briefcase, BookOpen, Heart, Clock,
  FileText, Settings, Moon, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_SECTIONS = [
  {
    label: "Core",
    items: [
      { label: "Brief", icon: Home, href: "/" },
      { label: "Centro", icon: Grid3x3, href: "/centro" },
      { label: "Shadow", icon: Sparkles, href: "/shadow" },
    ],
  },
  {
    label: "Vida",
    items: [
      { label: "Finanzas", icon: DollarSign, href: "/finanzas" },
      { label: "Brain", icon: Brain, href: "/brain" },
      { label: "Calendario", icon: Calendar, href: "/calendario" },
      { label: "Hábitos", icon: CheckSquare, href: "/habitos" },
      { label: "Metas", icon: Target, href: "/metas" },
    ],
  },
  {
    label: "Módulos",
    items: [
      { label: "Flouvia", icon: Briefcase, href: "/flouvia" },
      { label: "Panamericana", icon: BookOpen, href: "/panamericana" },
    ],
  },
  {
    label: "Más",
    items: [
      { label: "Salud", icon: Heart, href: "/salud" },
      { label: "Lectura", icon: BookOpen, href: "/lectura" },
      { label: "Tiempo", icon: Clock, href: "/tiempo" },
      { label: "Páginas", icon: FileText, href: "/paginas" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { setCierreOpen, ajustes } = useAppStore();

  return (
    <nav className="shell-sidebar">
      <div className="sidebar-logo">
        <Logo />
      </div>

      <div className="sidebar-nav">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="nav-section-label">{section.label}</p>
            {section.items.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn("nav-item", active && "active")}
                >
                  <item.icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <button
          className="nav-item w-full"
          onClick={() => setCierreOpen(true)}
        >
          <Moon size={16} />
          Cierre nocturno
        </button>
        <Link href="/config" className={cn("nav-item", pathname === "/config" && "active")}>
          <Settings size={16} />
          Configuración
        </Link>
      </div>
    </nav>
  );
}
