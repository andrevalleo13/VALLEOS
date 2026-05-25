"use client";
import type { CSSProperties } from "react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "success" | "alert";

const STATE_CLASS: Record<OrbState, string> = {
  idle: "",
  listening: "orb-listening",
  thinking: "orb-thinking",
  speaking: "orb-speaking",
  success: "orb-success",
  alert: "orb-alert",
};

export function Orb({
  size = 64,
  state = "idle",
  className = "",
  style,
}: {
  size?: number;
  state?: OrbState;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`orb-jarvis ${STATE_CLASS[state]} ${className}`}
      style={{ ["--orb-size" as string]: `${size}px`, ...style }}
      aria-hidden
    />
  );
}
