"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, X, Check, CalendarClock, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Notif {
  id: string;
  title: string;
  body: string | null;
  severity: string;
  module: string | null;
  href: string | null;
  read: boolean;
  dismissed: boolean;
  created_at: string;
}

const SCAN_KEY = "valleos-notified-events";
const SOON_MIN = 60;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min}m`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.round(h / 24)}d`;
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "warning") return <AlertTriangle size={14} style={{ color: "var(--gold)" }} />;
  if (severity === "error") return <AlertTriangle size={14} style={{ color: "var(--red)" }} />;
  if (severity === "success") return <CheckCircle2 size={14} style={{ color: "var(--green)" }} />;
  return <Info size={14} style={{ color: "var(--blue)" }} />;
}

export function NotifCenter() {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read).length;

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, severity, module, href, read, dismissed, created_at")
      .eq("dismissed", false)
      .order("created_at", { ascending: false })
      .limit(30);
    const list = (data ?? []) as Notif[];
    if (initialized.current && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      for (const n of list) {
        if (!seen.current.has(n.id) && !n.read) {
          try {
            new Notification(n.title, { body: n.body ?? undefined, tag: n.id });
          } catch {}
        }
      }
    }
    for (const n of list) seen.current.add(n.id);
    initialized.current = true;
    setItems(list);
  }, [supabase]);

  const scanCalendar = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar?days=1");
      if (!res.ok) return;
      const { events } = (await res.json()) as { events?: { id: string; title: string | null; start: string | null; location: string | null }[] };
      const notified: Record<string, number> = JSON.parse(localStorage.getItem(SCAN_KEY) ?? "{}");
      const nowDay = new Date().toISOString().split("T")[0];
      // prune old keys
      for (const k of Object.keys(notified)) if (!k.endsWith(nowDay)) delete notified[k];

      const rows: { title: string; body: string; severity: string; module: string; href: string; read: boolean; dismissed: boolean }[] = [];
      for (const ev of events ?? []) {
        if (!ev.start || !ev.start.includes("T")) continue;
        const start = new Date(ev.start);
        const mins = Math.round((start.getTime() - Date.now()) / 60000);
        if (mins <= 0 || mins > SOON_MIN) continue;
        const key = `${ev.id}:${nowDay}`;
        if (notified[key]) continue;
        notified[key] = Date.now();
        const t = start.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
        rows.push({
          title: `⏰ ${ev.title ?? "Evento"} en ${mins} min`,
          body: `${t}${ev.location ? ` · ${ev.location}` : ""}`,
          severity: "warning",
          module: "calendario",
          href: "/calendario",
          read: false,
          dismissed: false,
        });
      }
      localStorage.setItem(SCAN_KEY, JSON.stringify(notified));
      if (rows.length) {
        await supabase.from("notifications").insert(rows);
        await refresh();
      }
    } catch {}
  }, [supabase, refresh]);

  useEffect(() => {
    refresh();
    scanCalendar();
    const t = setInterval(() => { refresh(); scanCalendar(); }, 60000);
    return () => clearInterval(t);
  }, [refresh, scanCalendar]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
      const ids = items.filter((n) => !n.read).map((n) => n.id);
      if (ids.length) {
        setItems((prev) => prev.map((n) => ({ ...n, read: true })));
        await supabase.from("notifications").update({ read: true }).in("id", ids);
      }
    }
  }

  async function dismiss(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setItems((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("notifications").update({ dismissed: true }).eq("id", id);
  }

  async function clearAll() {
    const ids = items.map((n) => n.id);
    setItems([]);
    if (ids.length) await supabase.from("notifications").update({ dismissed: true }).in("id", ids);
  }

  function openItem(n: Notif) {
    setOpen(false);
    if (n.href) router.push(n.href);
  }

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button className="tb-btn" aria-label="Notificaciones" onClick={toggleOpen}>
        <Bell size={15} />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-head">
            <span className="eyebrow">Notificaciones</span>
            {items.length > 0 && (
              <button className="notif-clear" onClick={clearAll}>
                <Check size={11} /> Limpiar
              </button>
            )}
          </div>
          <div className="notif-list">
            {items.length === 0 ? (
              <div className="notif-empty">
                <CalendarClock size={22} style={{ color: "var(--mute-2)", marginBottom: 8 }} />
                <p>Sin notificaciones</p>
              </div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={`notif-item${n.href ? " clickable" : ""}${n.read ? "" : " unread"}`}
                  onClick={() => openItem(n)}
                >
                  <span className="notif-icon"><SeverityIcon severity={n.severity} /></span>
                  <div className="notif-body">
                    <p className="notif-title">{n.title}</p>
                    {n.body && <p className="notif-text">{n.body}</p>}
                    <span className="notif-meta">
                      {n.module ? `${n.module} · ` : ""}{timeAgo(n.created_at)}
                    </span>
                  </div>
                  <button className="notif-x" onClick={(e) => dismiss(n.id, e)} aria-label="Descartar">
                    <X size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
