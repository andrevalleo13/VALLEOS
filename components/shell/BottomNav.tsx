"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Home, LayoutGrid, Sparkles, Wallet, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Brief", href: "/", Icon: Home },
  { label: "Centro", href: "/centro", Icon: LayoutGrid },
  { label: "Shadow", href: "/shadow", Icon: Sparkles },
  { label: "Finanzas", href: "/finanzas", Icon: Wallet },
];

export function BottomNav() {
  const pathname = usePathname();
  const { setMobileMenu, mobileMenu } = useAppStore();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {TABS.map(({ label, href, Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn("bottom-nav-item", isActive(href) && "active")}
          onClick={() => setMobileMenu(false)}
        >
          <Icon size={21} strokeWidth={2} />
          <span>{label}</span>
        </Link>
      ))}
      <button
        type="button"
        className={cn("bottom-nav-item", mobileMenu && "active")}
        onClick={() => setMobileMenu(!mobileMenu)}
        aria-label="Más módulos"
      >
        <Menu size={21} strokeWidth={2} />
        <span>Más</span>
      </button>
    </nav>
  );
}
