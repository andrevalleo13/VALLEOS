"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { useAppStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import {
  Home, Grid3x3, Sparkles, DollarSign, Brain, Calendar,
  CheckSquare, Target, Briefcase, BookOpen, Heart, Clock,
  FileText, Settings, Moon, Plus, Search, Dumbbell, Scale, TrendingUp,
} from "lucide-react";

const NAV = [
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
  { label: "Gym", icon: Dumbbell, href: "/gym" },
  { label: "Lectura", icon: BookOpen, href: "/lectura" },
  { label: "Tiempo", icon: Clock, href: "/tiempo" },
  { label: "Páginas", icon: FileText, href: "/paginas" },
];

// Acciones que abren el modal correcto desde cualquier página (vía quickAction + nav)
const ACTIONS = [
  { label: "Captura rápida", icon: Plus, action: "capture" },
  { label: "Registrar gasto", icon: DollarSign, quick: "gasto", href: "/finanzas" },
  { label: "Registrar ingreso", icon: TrendingUp, quick: "gasto", href: "/finanzas" },
  { label: "Log de peso", icon: Scale, quick: "peso", href: "/salud" },
  { label: "Nueva meta", icon: Target, quick: "meta", href: "/metas" },
  { label: "Log de entrenamiento", icon: Dumbbell, quick: "entreno", href: "/gym" },
  { label: "Cierre nocturno", icon: Moon, action: "cierre" },
  { label: "Configuración", icon: Settings, href: "/config" },
];

type Hit = { id: string; label: string; sub: string; href: string; group: string; icon: typeof Brain };

export function CmdK() {
  const { cmdkOpen, setCmdkOpen, setCaptureOpen, setCierreOpen, setQuickAction } = useAppStore();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);

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

  // Carga datos reales una vez al abrir para que la búsqueda alcance notas/metas/clientes/movimientos
  useEffect(() => {
    if (!cmdkOpen || hits.length > 0) return;
    const supabase = createClient();
    (async () => {
      const [notes, goals, clients, entries] = await Promise.all([
        supabase.from("brain_notes").select("id, title, content").order("created_at", { ascending: false }).limit(60),
        supabase.from("goals").select("id, title, status").in("status", ["active", "paused"]),
        supabase.from("flouvia_clients").select("id, name, status").neq("status", "cancelado" as any),
        supabase.from("financial_entries").select("id, description, amount, category, date").order("date", { ascending: false }).limit(60),
      ]);
      const out: Hit[] = [];
      for (const n of notes.data ?? [])
        out.push({ id: n.id, label: n.title ?? (n.content ?? "").slice(0, 60), sub: (n.content ?? "").slice(0, 80), href: "/brain", group: "Notas", icon: Brain });
      for (const g of goals.data ?? [])
        out.push({ id: g.id, label: g.title, sub: g.status === "paused" ? "pausada" : "activa", href: "/metas", group: "Metas", icon: Target });
      for (const c of clients.data ?? [])
        out.push({ id: c.id, label: c.name, sub: c.status, href: "/flouvia", group: "Clientes", icon: Briefcase });
      for (const e of entries.data ?? [])
        out.push({ id: e.id, label: e.description ?? "Movimiento", sub: `${formatCurrency(e.amount)} · ${e.date}`, href: "/finanzas", group: "Movimientos", icon: DollarSign });
      setHits(out);
    })();
  }, [cmdkOpen, hits.length]);

  if (!cmdkOpen) return null;

  function close() {
    setCmdkOpen(false);
    setQuery("");
  }

  function go(href: string) {
    close();
    router.push(href);
  }

  function runAction(item: (typeof ACTIONS)[number]) {
    close();
    if (item.action === "capture") return setCaptureOpen(true);
    if (item.action === "cierre") return setCierreOpen(true);
    if (item.quick) setQuickAction(item.quick);
    if (item.href) router.push(item.href);
  }

  const showHits = query.trim().length >= 2;
  const grouped = showHits
    ? (["Movimientos", "Metas", "Clientes", "Notas"] as const)
        .map((g) => ({ group: g, items: hits.filter((h) => h.group === g) }))
        .filter((g) => g.items.length > 0)
    : [];

  return (
    <div className="cmdk-backdrop" onClick={close}>
      <Command className="cmdk" onClick={(e) => e.stopPropagation()} shouldFilter loop>
        <div className="flex items-center border-b border-[var(--glass-bd)] px-4">
          <Search size={16} style={{ color: "var(--mute)", flexShrink: 0 }} />
          <Command.Input
            className="cmdk-input pl-3"
            placeholder="Buscar páginas, acciones, notas, metas, clientes…"
            value={query}
            onValueChange={setQuery}
            autoFocus
          />
        </div>
        <Command.List className="cmdk-results">
          <Command.Empty className="px-4 py-8 text-center text-sm" style={{ color: "var(--mute)" }}>
            Sin resultados
          </Command.Empty>

          <Command.Group heading={<span className="cmdk-section">Acciones</span>}>
            {ACTIONS.map((item) => (
              <Command.Item key={item.label} value={item.label} className="cmdk-row" onSelect={() => runAction(item)}>
                <item.icon size={16} />
                {item.label}
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading={<span className="cmdk-section">Navegar</span>}>
            {NAV.map((item) => (
              <Command.Item key={item.label} value={item.label} className="cmdk-row" onSelect={() => go(item.href)}>
                <item.icon size={16} />
                {item.label}
              </Command.Item>
            ))}
          </Command.Group>

          {grouped.map((g) => (
            <Command.Group key={g.group} heading={<span className="cmdk-section">{g.group}</span>}>
              {g.items.map((h) => (
                <Command.Item key={h.id} value={`${h.label} ${h.sub}`} className="cmdk-row" onSelect={() => go(h.href)}>
                  <h.icon size={16} style={{ flexShrink: 0 }} />
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {h.label}
                  </span>
                  <span className="tick" style={{ marginLeft: "auto", flexShrink: 0, paddingLeft: 12 }}>{h.sub}</span>
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}
