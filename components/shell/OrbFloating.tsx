"use client";
import { useRouter } from "next/navigation";
import { Orb } from "@/components/Orb";

export function OrbFloating() {
  const router = useRouter();

  return (
    <button
      className="orb-floating"
      onClick={() => router.push("/shadow")}
      title="Shadow — tu agente personal"
      aria-label="Abrir Shadow"
    >
      <span className="orb-floating-label">Shadow</span>
      <Orb size={54} />
    </button>
  );
}
