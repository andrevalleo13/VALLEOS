"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Mic, MicOff, X, Send } from "lucide-react";
import { Orb, type OrbState } from "@/components/Orb";

/* ── Minimal Web Speech API typings ───────────────────────────────── */
type SRResult = { isFinal: boolean; 0: { transcript: string } };
type SRResultEvent = { resultIndex: number; results: ArrayLike<SRResult> };
interface ISpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SRResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
type SRConstructor = new () => ISpeechRecognition;

type Phase = "wake" | "command" | "thinking" | "speaking";
type ToolAction = { name: string; summary?: string; ok?: boolean; running: boolean };

const PAGE_LABELS: Record<string, string> = {
  brief: "Brief",
  centro: "Centro",
  shadow: "Shadow",
  finanzas: "Finanzas",
  brain: "Brain",
  calendario: "Calendario",
  habitos: "Hábitos",
  metas: "Metas",
  flouvia: "Flouvia",
  panamericana: "Panamericana (Academia)",
  salud: "Salud",
  gym: "Gym",
  lectura: "Lectura",
  tiempo: "Tiempo",
  paginas: "Páginas",
  config: "Ajustes",
};

const WAKE_RE = /\b(shadow|chadow|shado|chado|sombra)\b/i;

export function VoiceOrb() {
  const pathname = usePathname();
  const segment = (pathname ?? "").split("/").filter(Boolean)[0] ?? "brief";
  const pageLabel = PAGE_LABELS[segment] ?? "Valle OS";
  const onShadowPage = segment === "shadow";

  const [supported, setSupported] = useState(true);
  const [wakeOn, setWakeOn] = useState(true);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("wake");
  const [mood, setMood] = useState<"" | "success" | "alert">("");
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [actions, setActions] = useState<ToolAction[]>([]);
  const [input, setInput] = useState("");

  const recRef = useRef<ISpeechRecognition | null>(null);
  const mutedRef = useRef(false);
  const wakeOnRef = useRef(true);
  const phaseRef = useRef<Phase>("wake");
  const openRef = useRef(false);
  const convIdRef = useRef<string | null>(null);
  const finalBufRef = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ttsQueueRef = useRef<string[]>([]);
  const ttsBufRef = useRef("");
  const ttsSpeakingRef = useRef(false);
  const pageRef = useRef({ label: pageLabel, path: pathname ?? "" });

  useEffect(() => { pageRef.current = { label: pageLabel, path: pathname ?? "" }; }, [pageLabel, pathname]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => { wakeOnRef.current = wakeOn; }, [wakeOn]);

  const setPhaseBoth = useCallback((p: Phase) => { phaseRef.current = p; setPhase(p); }, []);

  /* ── Audio cue on wake ─────────────────────────────────────────── */
  const chime = useCallback(() => {
    try {
      const Ctx = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
        || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.26);
      osc.onended = () => ctx.close();
    } catch { /* noop */ }
  }, []);

  /* ── Text-to-speech ────────────────────────────────────────────── */
  const pickVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (typeof window === "undefined" || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((v) => /es[-_]MX/i.test(v.lang)) ||
      voices.find((v) => v.lang.toLowerCase().startsWith("es")) ||
      null
    );
  }, []);

  const onTTSDrain = useCallback(() => {
    ttsSpeakingRef.current = false;
    if (openRef.current && phaseRef.current === "speaking") {
      // back to listening for a follow-up
      finalBufRef.current = "";
      setTranscript("");
      mutedRef.current = false;
      setPhaseBoth("command");
    }
  }, [setPhaseBoth]);

  const speakNext = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const next = ttsQueueRef.current.shift();
    if (!next) { onTTSDrain(); return; }
    const u = new SpeechSynthesisUtterance(next);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = "es-MX";
    u.rate = 1.03;
    u.pitch = 0.95;
    u.onend = () => speakNext();
    u.onerror = () => speakNext();
    window.speechSynthesis.speak(u);
  }, [onTTSDrain, pickVoice]);

  const enqueueTTS = useCallback((sentence: string) => {
    const s = sentence.trim();
    if (!s) return;
    ttsQueueRef.current.push(s);
    if (!ttsSpeakingRef.current) {
      ttsSpeakingRef.current = true;
      mutedRef.current = true;
      setPhaseBoth("speaking");
      speakNext();
    }
  }, [setPhaseBoth, speakNext]);

  const feedTTS = useCallback((delta: string) => {
    ttsBufRef.current += delta;
    // flush complete sentences as they arrive
    const re = /[^.!?\n]*[.!?\n]+/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    while ((match = re.exec(ttsBufRef.current)) !== null) {
      enqueueTTS(match[0]);
      lastIndex = re.lastIndex;
    }
    if (lastIndex > 0) ttsBufRef.current = ttsBufRef.current.slice(lastIndex);
  }, [enqueueTTS]);

  const flushTTS = useCallback(() => {
    if (ttsBufRef.current.trim()) {
      enqueueTTS(ttsBufRef.current);
      ttsBufRef.current = "";
    }
    if (!ttsSpeakingRef.current) onTTSDrain();
  }, [enqueueTTS, onTTSDrain]);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    ttsQueueRef.current = [];
    ttsBufRef.current = "";
    ttsSpeakingRef.current = false;
  }, []);

  /* ── Send a message to Shadow ──────────────────────────────────── */
  const send = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg) return;
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    mutedRef.current = true;
    setTranscript(msg);
    setResponse("");
    setActions([]);
    setMood("");
    setPhaseBoth("thinking");

    try {
      const res = await fetch("/api/shadow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convIdRef.current,
          message: msg,
          context: { page: pageRef.current.label, pathname: pageRef.current.path, voice: true },
        }),
      });
      if (!res.body) throw new Error("no body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let started = false;

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
            convIdRef.current = ev.id as string;
          } else if (ev.type === "text") {
            const delta = ev.delta as string;
            if (!started) { started = true; }
            setResponse((r) => r + delta);
            feedTTS(delta);
          } else if (ev.type === "tool") {
            const name = ev.name as string;
            setActions((a) => [...a, { name, running: true }]);
          } else if (ev.type === "tool_result") {
            const name = ev.name as string;
            setActions((a) => {
              const u = [...a];
              for (let i = u.length - 1; i >= 0; i--) {
                if (u[i].name === name && u[i].running) {
                  u[i] = { name, summary: ev.summary as string, ok: ev.ok as boolean, running: false };
                  break;
                }
              }
              return u;
            });
          } else if (ev.type === "mood") {
            setMood(ev.mood as "success" | "alert");
          } else if (ev.type === "error") {
            setResponse((r) => r + `\n\n⚠ ${ev.message as string}`);
          }
        }
      }
      flushTTS();
    } catch {
      setResponse((r) => r || "Conexión interrumpida, André. Reintenta en un instante.");
      setMood("alert");
      flushTTS();
    }
  }, [feedTTS, flushTTS, setPhaseBoth]);

  /* ── Open / close the orb window ──────────────────────────────── */
  const openConversation = useCallback((seed?: string) => {
    setOpen(true); openRef.current = true;
    setResponse("");
    setActions([]);
    finalBufRef.current = "";
    setTranscript("");
    mutedRef.current = false;
    setPhaseBoth("command");
    if (seed && seed.trim()) {
      void send(seed);
    }
  }, [send, setPhaseBoth]);

  const closeConversation = useCallback(() => {
    setOpen(false); openRef.current = false;
    stopSpeaking();
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    convIdRef.current = null;
    finalBufRef.current = "";
    setTranscript("");
    setResponse("");
    setActions([]);
    setMood("");
    mutedRef.current = false;
    setPhaseBoth("wake");
  }, [setPhaseBoth, stopSpeaking]);

  /* ── Recognition result handling ──────────────────────────────── */
  const handleResult = useCallback((e: SRResultEvent) => {
    if (mutedRef.current) return;

    let interim = "";
    let finals = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const t = r[0].transcript;
      if (r.isFinal) finals += t; else interim += t;
    }
    const combined = (finalBufRef.current + finals + interim).trim();

    if (phaseRef.current === "wake") {
      if (WAKE_RE.test(combined)) {
        chime();
        // strip everything up to & including the wake word; treat trailing as command
        const after = combined.replace(new RegExp(`.*${WAKE_RE.source}`, "i"), "").trim();
        finalBufRef.current = "";
        openConversation(after.length > 2 ? after : undefined);
      }
      return;
    }

    if (phaseRef.current === "command") {
      if (finals) finalBufRef.current += finals;
      setTranscript((finalBufRef.current + interim).trim());
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        const cmd = finalBufRef.current.trim();
        finalBufRef.current = "";
        if (cmd) void send(cmd);
      }, 1300);
    }
  }, [chime, openConversation, send]);

  /* ── Recognition lifecycle ────────────────────────────────────── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: SRConstructor }).webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }

    let alive = true;
    const rec = new SR();
    rec.lang = "es-MX";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = handleResult;
    rec.onend = () => {
      if (alive && wakeOnRef.current && !onShadowPage) {
        try { rec.start(); } catch { /* already running */ }
      }
    };
    rec.onerror = () => { /* onend will handle restart */ };
    recRef.current = rec;

    if (wakeOnRef.current && !onShadowPage) {
      try { rec.start(); } catch { /* noop */ }
    }

    return () => {
      alive = false;
      try { rec.abort(); } catch { /* noop */ }
      recRef.current = null;
    };
  }, [handleResult, onShadowPage]);

  // toggle wake listening on/off
  useEffect(() => {
    const rec = recRef.current;
    if (!rec) return;
    if (wakeOn && !onShadowPage) { try { rec.start(); } catch { /* noop */ } }
    else { try { rec.stop(); } catch { /* noop */ } }
  }, [wakeOn, onShadowPage]);

  // preload voices
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => pickVoice();
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, [pickVoice]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeConversation(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeConversation]);

  if (onShadowPage) return null;

  const orbState: OrbState =
    mood === "alert" ? "alert" :
    mood === "success" ? "success" :
    phase === "thinking" ? "thinking" :
    phase === "speaking" ? "speaking" :
    phase === "command" ? "listening" :
    "idle";

  const statusLabel =
    phase === "thinking" ? "PROCESANDO" :
    phase === "speaking" ? "HABLANDO" :
    phase === "command" ? "ESCUCHANDO" :
    "EN LÍNEA";

  return (
    <>
      {/* Floating trigger */}
      {!open && (
        <button
          className={`orb-floating${wakeOn && supported ? " listening" : ""}`}
          onClick={() => openConversation()}
          title={supported ? "Shadow — di “Shadow” o haz clic" : "Shadow"}
          aria-label="Abrir Shadow"
        >
          <span className="orb-floating-label">{wakeOn && supported ? "Di “Shadow”" : "Shadow"}</span>
          <Orb size={54} />
        </button>
      )}

      {/* Expanded orb window */}
      {open && (
        <div className="vo-backdrop" onClick={closeConversation}>
          <div className={`vo-window mood-${mood || "none"}`} onClick={(e) => e.stopPropagation()}>
            <button className="vo-close" onClick={closeConversation} aria-label="Cerrar">
              <X size={16} />
            </button>

            <div className="vo-status">
              <span className="eyebrow" style={{ color: orbColor(orbState) }}>● {statusLabel}</span>
              <span className="tick">{pageLabel}</span>
            </div>

            <div className="vo-orb-wrap">
              <span className="vo-aura" />
              <Orb size={132} state={orbState} />
            </div>

            <div className={`vo-wave ${phase === "speaking" || phase === "command" ? "" : "idle"}`}>
              {Array.from({ length: 24 }).map((_, i) => (
                <span
                  key={i}
                  style={{
                    height: phase === "speaking"
                      ? `${24 + Math.abs(Math.sin(i * 0.7)) * 66}%`
                      : phase === "command"
                        ? `${18 + Math.abs(Math.cos(i * 0.5)) * 40}%`
                        : `${14 + (i % 5) * 8}%`,
                    animationDelay: `${i * 0.05}s`,
                    background: `linear-gradient(180deg, ${orbColor(orbState)}, transparent)`,
                  }}
                />
              ))}
            </div>

            {transcript && (
              <p className="vo-transcript">“{transcript}”</p>
            )}

            {response ? (
              <p className="vo-response">{response}</p>
            ) : phase === "thinking" ? (
              <p className="vo-response dim">Procesando…</p>
            ) : !transcript ? (
              <p className="vo-response dim">
                {supported ? "Te escucho, André." : "Escribe tu mensaje, André."}
              </p>
            ) : null}

            {actions.length > 0 && (
              <div className="vo-chips">
                {actions.map((a, j) => (
                  <span key={j} className={`tool-chip ${a.running ? "running" : a.ok ? "" : "err"}`}>
                    {a.running ? `Ejecutando…` : a.summary}
                  </span>
                ))}
              </div>
            )}

            <div className="vo-input">
              {supported && (
                <button
                  className="vo-mic"
                  onClick={() => setWakeOn((v) => !v)}
                  title={wakeOn ? "Silenciar wake word" : "Activar wake word"}
                >
                  {wakeOn ? <Mic size={15} /> : <MicOff size={15} />}
                </button>
              )}
              <input
                value={input}
                placeholder="Escribe o habla…"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && input.trim()) {
                    const v = input; setInput("");
                    void send(v);
                  }
                }}
              />
              <button
                className="vo-send"
                disabled={!input.trim()}
                onClick={() => { const v = input; setInput(""); if (v.trim()) void send(v); }}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function orbColor(state: OrbState): string {
  switch (state) {
    case "listening": return "var(--blue)";
    case "thinking": return "var(--violet)";
    case "success": return "var(--green)";
    case "alert": return "var(--red)";
    default: return "var(--gold)";
  }
}
