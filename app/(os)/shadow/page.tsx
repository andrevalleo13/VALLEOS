"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Plus, Trash2, Pin, History, Check, X, Loader2,
  Activity, Target, Sparkles, Brain,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { callDaemon } from "@/lib/daemon";
import { formatCurrency } from "@/lib/utils";
import { ShadowOrb } from "@/components/shell/ShadowOrb";
import type { ShadowConversation } from "@/lib/supabase/types";

type ToolAction = { name: string; summary?: string; ok?: boolean; running: boolean };
type UIMessage = { role: string; text: string; id?: string; actions?: ToolAction[] };
type Part = { text?: string; tool?: string };

const QUICK_PROMPTS = [
  { l: "Briefing", t: "Dame un resumen ejecutivo de mi día en 3 puntos.", Icon: Activity },
  { l: "Análisis", t: "¿Qué prioridad o hábito estoy descuidando hoy?", Icon: Target },
  { l: "Captura", t: "Guarda esta idea en Brain: ", Icon: Sparkles },
  { l: "Reflexión", t: "¿Qué patrón ves en mis hábitos esta semana?", Icon: Brain },
];

export default function ShadowPage() {
  const supabase = createClient();
  const [conversations, setConversations] = useState<ShadowConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [telem, setTelem] = useState([
    { l: "GPA", v: "—" },
    { l: "MRR", v: "—" },
    { l: "HÁBITOS", v: "—" },
    { l: "FOCO", v: "3H 12M" },
    { l: "PULSO", v: "58 BPM" },
  ]);

  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  };

  useEffect(() => { loadConversations(); loadTelemetry(); }, []);

  useEffect(() => {
    if (activeConvId) loadMessages(activeConvId);
    else setMessages([{ role: "assistant", text: `${greeting()}, André. Estoy en línea. ¿Qué necesitas?` }]);
  }, [activeConvId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinking]);

  async function loadConversations() {
    const res = await fetch("/api/shadow");
    const { conversations: convs } = await res.json();
    setConversations(convs ?? []);
  }

  async function loadTelemetry() {
    try {
      const [clientsRes, coursesRes, habitsRes, compsRes] = await Promise.all([
        supabase.from("flouvia_clients").select("monthly_value").eq("status", "activo"),
        supabase.from("academic_courses").select("grade").not("grade", "is", null),
        supabase.from("habits").select("id").eq("active", true),
        supabase.from("habit_completions").select("habit_id").eq("date", new Date().toISOString().split("T")[0]),
      ]);
      const mrr = (clientsRes.data ?? []).reduce((a, c) => a + (c.monthly_value ?? 0), 0);
      const grades = (coursesRes.data ?? []).map((c) => c.grade).filter(Boolean) as number[];
      const gpa = grades.length ? (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(1) : "—";
      const total = (habitsRes.data ?? []).length;
      const done = (compsRes.data ?? []).length;
      setTelem([
        { l: "GPA", v: gpa },
        { l: "MRR", v: mrr > 0 ? (mrr >= 1000 ? `$${(mrr / 1000).toFixed(1)}K` : formatCurrency(mrr)) : "—" },
        { l: "HÁBITOS", v: total > 0 ? `${done}/${total}` : "—" },
        { l: "FOCO", v: "3H 12M" },
        { l: "PULSO", v: "58 BPM" },
      ]);
    } catch { /* noop */ }
  }

  async function loadMessages(convId: string) {
    const res = await fetch(`/api/shadow?conversationId=${convId}`);
    const { messages: msgs } = await res.json();
    if (!msgs) return;
    setMessages(
      msgs.map((m: { id: string; role: string; parts: Part[] }) => {
        const parts = m.parts ?? [];
        const text = parts.filter((p) => p.text).map((p) => p.text).join("");
        const actions: ToolAction[] = parts
          .filter((p) => p.tool)
          .map((p) => ({ name: "", summary: p.tool, ok: true, running: false }));
        return { id: m.id, role: m.role, text, actions };
      })
    );
  }

  const updateLastAssistant = useCallback((fn: (m: UIMessage) => UIMessage) => {
    setMessages((prev) => {
      const u = [...prev];
      for (let i = u.length - 1; i >= 0; i--) {
        if (u[i].role === "assistant") { u[i] = fn(u[i]); break; }
      }
      return u;
    });
  }, []);

  async function send(presetText?: string) {
    const text = (presetText ?? input).trim();
    if (!text || streaming) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setStreaming(true);
    setThinking(true);
    setMessages((prev) => [...prev, { role: "user", text }, { role: "assistant", text: "", actions: [] }]);

    let newConvId = activeConvId;

    try {
      const res = await fetch("/api/shadow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeConvId, message: text }),
      });
      if (!res.body) throw new Error("no body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (!line.trim()) continue;
          let ev: Record<string, unknown>;
          try { ev = JSON.parse(line); } catch { continue; }

          if (ev.type === "conv") {
            newConvId = ev.id as string;
          } else if (ev.type === "text") {
            const delta = ev.delta as string;
            updateLastAssistant((m) => ({ ...m, text: m.text + delta }));
          } else if (ev.type === "tool") {
            const name = ev.name as string;
            updateLastAssistant((m) => ({ ...m, actions: [...(m.actions ?? []), { name, running: true }] }));
          } else if (ev.type === "tool_result") {
            const name = ev.name as string;
            updateLastAssistant((m) => {
              const actions = [...(m.actions ?? [])];
              for (let i = actions.length - 1; i >= 0; i--) {
                if (actions[i].name === name && actions[i].running) {
                  actions[i] = { name, summary: ev.summary as string, ok: ev.ok as boolean, running: false };
                  break;
                }
              }
              return { ...m, actions };
            });
          } else if (ev.type === "mac_action") {
            const macAction = String(ev.action ?? "acción");
            const chipName = `mac:${ev.action}:${Date.now()}`;
            updateLastAssistant((m) => ({ ...m, actions: [...(m.actions ?? []), { name: chipName, running: true }] }));
            void callDaemon(ev as Record<string, unknown>).then((r) => {
              updateLastAssistant((m) => {
                const actions = [...(m.actions ?? [])];
                for (let i = actions.length - 1; i >= 0; i--) {
                  if (actions[i].name === chipName && actions[i].running) {
                    actions[i] = { name: chipName, summary: r.ok ? `✓ ${macAction}` : `⚠ ${r.error ?? "Daemon no activo"}`, ok: r.ok, running: false };
                    break;
                  }
                }
                return { ...m, actions };
              });
            });
          } else if (ev.type === "error") {
            updateLastAssistant((m) => ({ ...m, text: m.text + `\n\n⚠ ${ev.message}` }));
          }
        }
      }

      if (newConvId && newConvId !== activeConvId) setActiveConvId(newConvId);
      await loadConversations();
    } catch {
      updateLastAssistant((m) => ({ ...m, text: m.text || "Conexión interrumpida. Reintenta en un instante." }));
    } finally {
      setStreaming(false);
      setThinking(false);
    }
  }

  function newConversation() {
    setActiveConvId(null);
    setShowHistory(false);
    setMessages([{ role: "assistant", text: `${greeting()}, André. Nueva sesión. ¿Por dónde empezamos?` }]);
  }

  async function deleteConversation(id: string) {
    await fetch(`/api/shadow?conversationId=${id}`, { method: "DELETE" });
    if (activeConvId === id) newConversation();
    await loadConversations();
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow mb-2">02 · INTELIGENCIA</p>
            <h1 style={{ fontFamily: "var(--f-serif)", fontSize: 38, color: "var(--bone)", lineHeight: 1.05 }}>
              Shadow<em style={{ color: "var(--gold)", fontStyle: "italic" }}>.</em>
            </h1>
          </div>
          <div style={{ textAlign: "right", marginTop: 4 }}>
            <p style={{ fontFamily: "var(--f-mono)", fontSize: 11, letterSpacing: "0.16em", color: thinking ? "var(--violet)" : "var(--gold)" }}>
              ● {thinking ? "PROCESANDO" : "EN LÍNEA"}
            </p>
            <p className="tick" style={{ marginTop: 2 }}>claude-sonnet-4-6 · con manos</p>
          </div>
        </div>
      </div>

      <div className="page-body" style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: 20, alignItems: "start" }}>
        {/* LEFT — HUD */}
        <div className="card glass" style={{ padding: "28px 22px", display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
          <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="eyebrow" style={{ color: thinking ? "var(--violet)" : "var(--gold)" }}>
              — ESTADO · {thinking ? "PROCESANDO" : "EN LÍNEA"}
            </span>
            <span className="tick" style={{ fontSize: 9 }}>SUPABASE · E2E</span>
          </div>

          <ShadowOrb thinking={thinking} />

          <div className={`hud-wave ${thinking ? "" : "idle"}`}>
            {Array.from({ length: 28 }).map((_, i) => (
              <span
                key={i}
                style={{
                  height: thinking ? `${20 + Math.abs(Math.sin(i * 0.6)) * 70}%` : `${15 + (i % 5) * 10}%`,
                  animationDelay: `${i * 0.06}s`,
                }}
              />
            ))}
          </div>

          <p className="serif" style={{ fontSize: 20, fontStyle: "italic", color: "var(--bone-dim)", textAlign: "center" }}>
            {thinking ? "Procesando…" : "“Estoy aquí, André.”"}
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            {telem.slice(0, 3).map((t) => (
              <div key={t.l} className="stat-pill">
                <span className="v">{t.v}</span>
                <span className="l">{t.l}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <span className="tag">CONTEXTO · MEMORIA</span>
            <span className="tag">9 HERRAMIENTAS</span>
            <span className="tag gold" style={{ color: "var(--gold)", borderColor: "rgba(201,163,95,0.35)" }}>PRIVADO</span>
          </div>
        </div>

        {/* RIGHT — Conversation */}
        <div className="card glass" style={{ padding: 0, display: "flex", flexDirection: "column", height: 600, position: "relative" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="eyebrow">— CONVERSACIÓN</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className="tb-btn" style={{ width: 28, height: 28 }} onClick={() => setShowHistory((s) => !s)} title="Historial">
                <History size={14} />
              </button>
              <button className="tb-btn" style={{ width: 28, height: 28 }} onClick={newConversation} title="Nueva conversación">
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* History dropdown */}
          {showHistory && (
            <div style={{
              position: "absolute", top: 56, right: 12, width: 260, maxHeight: 360, overflowY: "auto",
              zIndex: 20, borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--glass-bd-2)",
              boxShadow: "0 24px 60px -20px rgba(0,0,0,0.6)", padding: 6,
            }}>
              {conversations.length === 0 && <p className="tick" style={{ padding: 16, textAlign: "center" }}>Sin historial</p>}
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`nav-item-v2 ${activeConvId === conv.id ? "active" : ""}`}
                  style={{ cursor: "pointer", gridTemplateColumns: "auto 1fr auto" }}
                  onClick={() => { setActiveConvId(conv.id); setShowHistory(false); }}
                >
                  {conv.pinned ? <Pin size={10} style={{ color: "var(--gold)" }} /> : <span style={{ width: 10 }} />}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>
                    {conv.title ?? "Conversación"}
                  </span>
                  <button style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2 }}
                    onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}>
                    <Trash2 size={11} style={{ color: "var(--mute)" }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
            {messages.map((msg, i) => (
              <div key={i} className={`shadow-msg-row ${msg.role === "user" ? "user" : ""}`}>
                {msg.role === "assistant" && (
                  <span className="orb-jarvis" style={{ ["--orb-size" as string]: "26px", marginTop: 2 }} aria-hidden />
                )}
                <div style={{ maxWidth: "84%" }}>
                  <div style={{ fontFamily: "var(--f-mono)", fontSize: 9, letterSpacing: "0.16em", color: "var(--mute)", marginBottom: 4, textTransform: "uppercase", textAlign: msg.role === "user" ? "right" : "left" }}>
                    {msg.role === "user" ? "André" : "Shadow"}
                  </div>
                  {msg.text && (
                    <div className={`shadow-bubble ${msg.role === "user" ? "user" : "shadow"}`}>{msg.text}</div>
                  )}
                  {!msg.text && msg.role === "assistant" && streaming && (!msg.actions || msg.actions.length === 0) && (
                    <div className="shadow-bubble shadow">
                      <span className="thinking-dots"><span className="thinking-dot" /><span className="thinking-dot" /><span className="thinking-dot" /></span>
                    </div>
                  )}
                  {/* Tool action chips */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                      {msg.actions.map((a, j) => (
                        <span key={j} className={`tool-chip ${a.running ? "running" : a.ok ? "" : "err"}`}>
                          {a.running ? <Loader2 size={12} className="spin" /> : a.ok ? <Check size={12} /> : <X size={12} />}
                          {a.running ? `Ejecutando ${a.name}…` : a.summary}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "14px 16px", borderTop: "1px solid var(--line)", display: "flex", gap: 10, alignItems: "flex-end" }}>
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="Habla con Shadow… (pídele que cree, registre o analice)"
              value={input}
              onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              disabled={streaming}
              style={{ flex: 1, background: "transparent", border: 0, outline: 0, resize: "none", color: "var(--bone)", fontFamily: "var(--f-serif)", fontSize: 17, fontStyle: "italic", padding: "6px 4px", lineHeight: 1.4 }}
            />
            <button className="btn btn-primary btn-icon" onClick={() => send()} disabled={streaming || !input.trim()} style={{ flexShrink: 0 }}>
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Quick prompts */}
      <div className="page-body" style={{ paddingTop: 0, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {QUICK_PROMPTS.map((s) => (
          <button
            key={s.l}
            className="card glass-tight"
            style={{ padding: 16, cursor: "pointer", display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}
            onClick={() => { if (s.t.endsWith(": ")) { setInput(s.t); textareaRef.current?.focus(); } else send(s.t); }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--gold)" }}>
              <s.Icon size={14} />
              <span className="eyebrow" style={{ color: "var(--gold)" }}>{s.l}</span>
            </span>
            <span className="serif" style={{ fontSize: 15, lineHeight: 1.3, color: "var(--bone-dim)" }}>{s.t.endsWith(": ") ? s.t.slice(0, -2) + "…" : s.t}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
