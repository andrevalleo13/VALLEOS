"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Plus, Trash2, Pin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ShadowConversation, ShadowMessage } from "@/lib/supabase/types";

type MsgPart = { text: string };
type UIMessage = { role: string; text: string; id?: string };

const EMOTIONAL_STATES = [
  { id: "focused", label: "Enfocado", color: "var(--gold)" },
  { id: "analytical", label: "Analítico", color: "var(--blue)" },
  { id: "intuitive", label: "Intuitivo", color: "var(--violet)" },
  { id: "serene", label: "Sereno", color: "var(--green)" },
];

const TELEMETRY = [
  { label: "Energía", value: "84%", delta: "+3" },
  { label: "Focus", value: "91%", delta: "+7" },
  { label: "Estrés", value: "22%", delta: "-5" },
  { label: "Momentum", value: "78%", delta: "+12" },
];

export default function ShadowPage() {
  const supabase = createClient();
  const [conversations, setConversations] = useState<ShadowConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [emotionalState, setEmotionalState] = useState("focused");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    if (activeConvId) loadMessages(activeConvId);
    else setMessages([{ role: "assistant", text: "Sistema en línea. Soy Shadow — tu agente personal. ¿En qué te puedo ayudar hoy?" }]);
  }, [activeConvId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadConversations() {
    const res = await fetch("/api/shadow");
    const { conversations: convs } = await res.json();
    setConversations(convs ?? []);
  }

  async function loadMessages(convId: string) {
    const res = await fetch(`/api/shadow?conversationId=${convId}`);
    const { messages: msgs } = await res.json();
    if (!msgs) return;
    setMessages(
      msgs.map((m: ShadowMessage) => ({
        id: m.id,
        role: m.role,
        text: (m.parts as MsgPart[])?.[0]?.text ?? "",
      }))
    );
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");
    setStreaming(true);

    // Optimistic user message
    setMessages((prev) => [...prev, { role: "user", text }]);
    // Placeholder assistant message
    setMessages((prev) => [...prev, { role: "assistant", text: "" }]);

    try {
      const res = await fetch("/api/shadow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeConvId, message: text }),
      });

      if (!res.body) throw new Error();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let gotConvId = false;
      let newConvId = activeConvId;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const raw = decoder.decode(value);

        // Extract conversation ID prefix (\x00id\x00)
        if (!gotConvId && raw.startsWith("\x00")) {
          const end = raw.indexOf("\x00", 1);
          if (end !== -1) {
            newConvId = raw.slice(1, end);
            gotConvId = true;
            buffer = raw.slice(end + 1);
          }
        } else {
          buffer = raw;
        }

        if (buffer) {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              text: updated[updated.length - 1].text + buffer,
            };
            return updated;
          });
        }
      }

      if (newConvId && newConvId !== activeConvId) {
        setActiveConvId(newConvId);
      }
      await loadConversations();
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", text: "Error de conexión. Intenta de nuevo." };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  async function newConversation() {
    setActiveConvId(null);
    setMessages([{ role: "assistant", text: "Nueva conversación iniciada. ¿En qué te ayudo?" }]);
  }

  async function deleteConversation(id: string) {
    await fetch(`/api/shadow?conversationId=${id}`, { method: "DELETE" });
    if (activeConvId === id) newConversation();
    await loadConversations();
  }

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {/* Conversations sidebar */}
      {sidebarOpen && (
        <div
          style={{
            width: 220,
            borderRight: "1px solid var(--glass-bd)",
            background: "rgba(6,6,8,0.4)",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
          }}
        >
          <div style={{ padding: "16px 12px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="eyebrow">Conversaciones</span>
            <button className="tb-btn" onClick={newConversation} title="Nueva">
              <Plus size={14} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px" }}>
            {conversations.length === 0 && (
              <p className="tick px-3 py-4" style={{ textAlign: "center" }}>Sin historial</p>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn("nav-item group", activeConvId === conv.id && "active")}
                style={{ position: "relative", cursor: "pointer" }}
                onClick={() => setActiveConvId(conv.id)}
              >
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>
                  {conv.pinned && <Pin size={10} style={{ display: "inline", marginRight: 4, color: "var(--gold)" }} />}
                  {conv.title ?? "Conversación"}
                </span>
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                  style={{ flexShrink: 0 }}
                >
                  <Trash2 size={12} style={{ color: "var(--mute)" }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HUD Panel */}
      <div
        style={{
          width: 280,
          borderRight: "1px solid var(--glass-bd)",
          background: "rgba(6,6,8,0.3)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "32px 20px",
          gap: 28,
          flexShrink: 0,
        }}
      >
        {/* Orb + rings */}
        <div className="hud-container" style={{ width: 200, height: 200 }}>
          <div className="hud-ring hud-ring-1" style={{ width: 200, height: 200, borderColor: "rgba(201,163,95,0.15)" }} />
          <div className="hud-ring hud-ring-2" style={{ width: 150, height: 150, borderColor: "rgba(201,163,95,0.25)" }} />
          <div className="hud-ring hud-ring-3" style={{ width: 100, height: 100, borderColor: "rgba(201,163,95,0.4)" }} />
          <div className="hud-radar" />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>
            <div className="orb" style={{ width: 64, height: 64 }} />
          </div>
        </div>

        {/* Emotional state */}
        <div style={{ width: "100%" }}>
          <p className="eyebrow mb-2" style={{ textAlign: "center" }}>Estado</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
            {EMOTIONAL_STATES.map((s) => (
              <button
                key={s.id}
                className="tag cursor-pointer"
                style={
                  emotionalState === s.id
                    ? { borderColor: s.color, color: s.color, background: `${s.color}22`, fontSize: 11 }
                    : { fontSize: 11 }
                }
                onClick={() => setEmotionalState(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Telemetry */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%" }}>
          {TELEMETRY.map((t) => (
            <div key={t.label} className="hud-chip">
              <span className="hud-chip-label">{t.label}</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontFamily: "var(--f-mono)", fontSize: 16, color: "var(--bone)" }}>{t.value}</span>
                <span style={{ fontFamily: "var(--f-mono)", fontSize: 10, color: t.delta.startsWith("+") ? "var(--green)" : "var(--red)" }}>{t.delta}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Status */}
        <div style={{ width: "100%", marginTop: "auto" }}>
          <div className="card-sm" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { k: "Modelo", v: "Sonnet 4.6", c: "var(--gold)" },
              { k: "Estado", v: "● En línea", c: "var(--green)" },
              { k: "Mensajes", v: String(messages.length) },
              { k: "Conversaciones", v: String(conversations.length) },
            ].map((row) => (
              <div key={row.k} className="flex justify-between">
                <span className="tick">{row.k}</span>
                <span className="tick" style={{ color: row.c ?? "var(--bone-dim)" }}>{row.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div className="page-header" style={{ padding: "14px 24px" }}>
          <div className="flex items-center gap-3">
            <div>
              <p className="eyebrow-gold">Shadow · Agente Personal</p>
            </div>
            <button className="btn btn-ghost btn-sm ml-auto" onClick={newConversation}>
              <Plus size={13} /> Nueva
            </button>
          </div>
        </div>

        <div className="chat-area" style={{ flex: 1 }}>
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}
            >
              {msg.role === "assistant" && (
                <div style={{ marginRight: 8, marginTop: 4, flexShrink: 0 }}>
                  <div className="orb-sm" style={{ width: 24, height: 24 }} />
                </div>
              )}
              <div className={msg.role === "user" ? "chat-bubble chat-bubble-user" : "chat-bubble chat-bubble-shadow"}>
                {msg.text || (
                  <div className="thinking-dots">
                    <div className="thinking-dot" />
                    <div className="thinking-dot" />
                    <div className="thinking-dot" />
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="chat-input-area">
          <textarea
            className="chat-input"
            rows={1}
            placeholder="Habla con Shadow..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            disabled={streaming}
          />
          <button
            className="btn btn-primary btn-icon"
            onClick={send}
            disabled={streaming || !input.trim()}
            style={{ flexShrink: 0 }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
