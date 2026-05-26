let ctx: AudioContext | null = null;
let enabled = true;
const MASTER = 0.16;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctx =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setSoundsEnabled(v: boolean) {
  enabled = v;
}

export function soundsOn() {
  return enabled;
}

type ToneOpts = {
  type?: OscillatorType;
  from: number;
  to?: number;
  dur: number;
  gain?: number;
  delay?: number;
  glide?: "exp" | "lin";
};

function tone(c: AudioContext, o: ToneOpts) {
  const t0 = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.connect(g);
  g.connect(c.destination);
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.from, t0);
  if (o.to && o.to !== o.from) {
    if (o.glide === "lin") osc.frequency.linearRampToValueAtTime(o.to, t0 + o.dur);
    else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + o.dur);
  }
  const peak = (o.gain ?? 0.1) * MASTER;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.03);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
}

export type SoundName = "think" | "click" | "bass" | "ping" | "success" | "alert" | "boot";

export function play(name: SoundName) {
  if (!enabled && name !== "boot") return;
  const c = ac();
  if (!c) return;
  switch (name) {
    case "think":
      tone(c, { type: "sine", from: 880, to: 1320, dur: 0.16, gain: 0.05 });
      break;
    case "click":
      tone(c, { type: "triangle", from: 2300, to: 1500, dur: 0.05, gain: 0.045 });
      tone(c, { type: "square", from: 3400, to: 2700, dur: 0.025, gain: 0.015, delay: 0.004 });
      break;
    case "bass":
      tone(c, { type: "sine", from: 180, to: 52, dur: 0.55, gain: 0.26 });
      tone(c, { type: "sine", from: 92, to: 40, dur: 0.62, gain: 0.16, delay: 0.01 });
      break;
    case "ping":
      tone(c, { type: "sine", from: 660, to: 990, dur: 0.22, gain: 0.1 });
      break;
    case "success":
      tone(c, { type: "sine", from: 660, dur: 0.12, gain: 0.08 });
      tone(c, { type: "sine", from: 990, dur: 0.2, gain: 0.08, delay: 0.1 });
      break;
    case "alert":
      tone(c, { type: "triangle", from: 460, to: 340, dur: 0.16, gain: 0.11 });
      tone(c, { type: "triangle", from: 460, to: 340, dur: 0.16, gain: 0.11, delay: 0.22 });
      break;
    case "boot":
      tone(c, { type: "sine", from: 110, to: 720, dur: 1.05, gain: 0.13 });
      tone(c, { type: "sine", from: 220, to: 1440, dur: 0.95, gain: 0.05, delay: 0.05 });
      tone(c, { type: "sine", from: 660, to: 990, dur: 0.32, gain: 0.11, delay: 1.02 });
      break;
  }
}
