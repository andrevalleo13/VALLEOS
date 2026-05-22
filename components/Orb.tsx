"use client";
import type { CSSProperties } from "react";

type OrbState = "idle" | "thinking";

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
      className={`orb-jarvis${state === "thinking" ? " orb-thinking" : ""} ${className}`}
      style={{ ["--orb-size" as string]: `${size}px`, ...style }}
      aria-hidden
    />
  );
}
