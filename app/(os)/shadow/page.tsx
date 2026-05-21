"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Plus, Trash2, Pin, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ShadowConversation, ShadowMessage } from "@/lib/supabase/types";

type MsgPart = { text: string };
type UIMessage = { role: string; text: string; id?: string };

export default function ShadowPage() {
  const supabase = createClient();
  const [conversations, setConversations] = useState<ShadowConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (activeConvId) loadMessages(activeConvId);
    else
      setMessages([
        {
          role: "assistant",
          text: "Sistema en línea. Soy Shadow — tu agente personal. ¿En qué te puedo ayudar hoy?",
        },
      ]);
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
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setStreaming(true);

    setMessages((prev) => [...prev, { role: "user", text }]);
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
      let gotConvId = false;
      let newConvId = activeConvId;
      let accumulated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const raw = decoder.decode(value);

        if (!gotConvId && raw.startsWith("\x00")) {
          const end = raw.indexOf("\x00", 1);
          if (end !== -1) {
            newConvId = raw.slice(1, end);
            gotConvId = true;
            accumulated += raw.slice(end + 1);
          } else {
            accumulated += raw;
          }
        } else {
          accumulated += raw;
        }

        const chunk = accumulated;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            text: chunk,
          };
          return updated;
        });
      }

      if (newConvId && newConvId !== activeConvId) {
        setActiveConvId(newConvId);
      }
      await loadConversations();
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          text: "Error de conexión. Intenta de nuevo.",
        };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  function newConversation() {
    setActiveConvId(null);
    setMessages([
      { role: "assistant", text: "Nueva conversación iniciada. ¿En qué te ayudo?" },
    ]);
  }

  async function deleteConversation(id: string) {
    await fetch(`/api/shadow?conversationId=${id}`, { method: "DELETE" });
    if (activeConvId === id) newConversation();
    await loadConversations();
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
  }

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {/* Conversation history sidebar */}
      <div
        style={{
          width: 220,
          borderRight: "1px solid var(--glass-bd)",
          background: "rgba(6,6,8,0.3)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: "14px 12px 8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--glass-bd)",
          }}
        >
          <span className="eyebrow">Conversaciones</span>
          <button className="tb-btn" onClick={newConversation} title="Nueva conversación">
            <Plus size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
          {conversations.length === 0 && (
            <p className="tick px-3 py-6 text-center">Sin historial</p>
          )}
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={cn("nav-item-v2 group", activeConvId === conv.id && "active")}
              style={{ cursor: "pointer", position: "relative" }}
              onClick={() => setActiveConvId(conv.id)}
            >
              {conv.pinned && (
                <Pin size={9} style={{ color: "var(--gold)", flexShrink: 0 }} />
              )}
              <span
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: 12,
                }}
              >
                {conv.title ?? "Conversación"}
              </span>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ flexShrink: 0, padding: 2 }}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(conv.id);
                }}
              >
                <Trash2 size={11} style={{ color: "var(--mute)" }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header */}
        <div
          style={{
            padding: "12px 20px",
            borderBottom: "1px solid var(--glass-bd)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "var(--gold-glow)",
              border: "1px solid var(--gold)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Sparkles size={13} style={{ color: "var(--gold)" }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--bone)" }}>
              Shadow
            </p>
            <p className="tick" style={{ marginTop: 1 }}>
              {streaming ? "Pensando..." : "● En línea · claude-sonnet-4-6"}
            </p>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: "auto" }}
            onClick={newConversation}
          >
            <Plus size={13} /> Nueva
          </button>
        </div>

        {/* Messages */}
        <div className="chat-area" style={{ flex: 1 }}>
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                gap: 10,
              }}
            >
              {msg.role === "assistant" && (
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "var(--gold-glow)",
                    border: "1px solid var(--gold)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 4,
                  }}
                >
                  <Sparkles size={11} style={{ color: "var(--gold)" }} />
                </div>
              )}
              <div
                className={
                  msg.role === "user"
                    ? "chat-bubble chat-bubble-user"
                    : "chat-bubble chat-bubble-shadow"
                }
                style={{ whiteSpace: "pre-wrap" }}
              >
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

        {/* Input */}
        <div className="chat-input-area">
          <textarea
            ref={textareaRef}
            className="chat-input"
            rows={1}
            placeholder="Escribe a Shadow..."
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={streaming}
          />
          <button
            className="btn btn-primary btn-icon"
            onClick={send}
            disabled={streaming || !input.trim()}
            style={{ flexShrink: 0 }}
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
