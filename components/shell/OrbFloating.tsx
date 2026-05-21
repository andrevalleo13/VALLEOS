"use client";
import { useRouter } from "next/navigation";

export function OrbFloating() {
  const router = useRouter();

  return (
    <button
      className="orb-floating"
      onClick={() => router.push("/shadow")}
      title="Shadow — tu agente personal"
      aria-label="Abrir Shadow"
    />
  );
}
