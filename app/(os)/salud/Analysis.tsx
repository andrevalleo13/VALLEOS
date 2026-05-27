"use client";
import { ShadowAnalysis } from "@/components/ShadowAnalysis";

export function Analysis({ initial, generatedAt }: { initial: string | null; generatedAt: string | null }) {
  return (
    <ShadowAnalysis
      endpoint="/api/shadow/salud"
      cta="Analizar salud"
      loadingText="Analizando tu salud…"
      emptyText="Shadow puede analizar tu salud: sueño, peso, ánimo y energía, y qué ajustar."
      initial={initial}
      generatedAt={generatedAt}
    />
  );
}
