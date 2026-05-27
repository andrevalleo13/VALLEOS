"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Orb } from "@/components/Orb";
import { ChevronDown, ChevronRight, Search, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_SECTIONS = [
  {
    label: "CORE",
    items: [
      { n: "00", label: "Brief", href: "/" },
      { n: "01", label: "Centro", href: "/centro" },
      { n: "02", label: "Shadow", href: "/shadow" },
    ],
  },
  {
    label: "VIDA",
    items: [
      { n: "03", label: "Finanzas", href: "/finanzas" },
      { n: "04", label: "Brain", href: "/brain" },
      { n: "05", label: "Calendario", href: "/calendario" },
      { n: "06", label: "Hábitos", href: "/habitos" },
      { n: "07", label: "Metas", href: "/metas" },
    ],
  },
  {
    label: "MÓDULOS",
    items: [
      { n: "08", label: "Flouvia", href: "/flouvia" },
      { n: "09", label: "Panamericana", href: "/panamericana" },
    ],
  },
  {
    label: "MÁS",
    items: [
      { n: "10", label: "Salud", href: "/salud" },
      { n: "11", label: "Gym", href: "/gym" },
      { n: "12", label: "Lectura", href: "/lectura" },
      { n: "13", label: "Tiempo", href: "/tiempo" },
      { n: "14", label: "Páginas", href: "/paginas" },
    ],
  },
];

const ALL_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

export function Sidebar() {
  const pathname = usePathname();
  const { setCierreOpen, mobileMenu, setMobileMenu } = useAppStore();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleSection(label: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  const filtered = search.trim()
    ? ALL_ITEMS.filter((i) =>
        i.label.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* Mobile overlay */}
      {mobileMenu && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.5)" }}
          onClick={() => setMobileMenu(false)}
        />
      )}

      <nav className={cn("shell-sidebar", mobileMenu && "open")}>
        <div className="sidebar-glow" aria-hidden />
        {/* Brand */}
        <div className="sidebar-logo">
          <Orb size={32} className="sidebar-orb" />
          <div className="sidebar-brand-block">
            <div className="sidebar-brand">
              VALLE<em>·</em>
            </div>
            <div className="sidebar-brand-meta">v2.0 · Motor de Ops</div>
          </div>
        </div>

        {/* Search */}
        <div className="sidebar-search-wrap">
          <Search size={12} />
          <input
            className="sidebar-search"
            placeholder="Buscar módulo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Nav */}
        <div className="sidebar-nav">
          {filtered ? (
            <>
              {filtered.length === 0 && (
                <p className="tick px-3 py-4 text-center">Sin resultados</p>
              )}
              {filtered.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn("nav-item-v2", isActive(item.href) && "active")}
                  onClick={() => setMobileMenu(false)}
                >
                  <span className="nav-num">{item.n}</span>
                  <span className="nav-label">{item.label}</span>
                </Link>
              ))}
            </>
          ) : (
            NAV_SECTIONS.map((section) => {
              const isCollapsed = collapsed.has(section.label);
              return (
                <div key={section.label}>
                  <button
                    className="nav-section-btn"
                    onClick={() => toggleSection(section.label)}
                  >
                    <span className="nav-section-label">{section.label}</span>
                    {isCollapsed ? (
                      <ChevronRight size={9} />
                    ) : (
                      <ChevronDown size={9} />
                    )}
                  </button>
                  {!isCollapsed &&
                    section.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "nav-item-v2",
                          isActive(item.href) && "active"
                        )}
                        onClick={() => setMobileMenu(false)}
                      >
                        <span className="nav-num">{item.n}</span>
                        <span className="nav-label">{item.label}</span>
                      </Link>
                    ))}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <button
            className="sidebar-cierre"
            onClick={() => { setCierreOpen(true); setMobileMenu(false); }}
          >
            <Moon size={13} />
            <span>Cierre nocturno</span>
            <kbd className="sidebar-cierre-kbd">⌘.</kbd>
          </button>
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              A
              <span className="sidebar-avatar-status" aria-hidden />
            </div>
            <div>
              <div className="sidebar-user-name">André Valle</div>
              <div className="sidebar-user-role">OPERADOR · ADMIN</div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
