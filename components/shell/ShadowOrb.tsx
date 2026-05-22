"use client";
import { Orb } from "@/components/Orb";

export function ShadowOrb({ thinking = false }: { thinking?: boolean }) {
  return (
    <div className={`shadow-presence${thinking ? " thinking" : ""}`}>
      <span className="shadow-aura" />
      <span className="shadow-aura-2" />
      <Orb size={150} state={thinking ? "thinking" : "idle"} />
    </div>
  );
}
