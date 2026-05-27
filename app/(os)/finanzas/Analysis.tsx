"use client";
import { ShadowAnalysis } from "@/components/ShadowAnalysis";

export function Analysis({ initial, generatedAt }: { initial: string | null; generatedAt: string | null }) {
  return (
    <ShadowAnalysis
      endpoint="/api/shadow/finanzas"
      cta="Analizar mes"
      loadingText="Analizando tu mes…"
      emptyText="Shadow puede analizar tu mes: lectura, en qué se va el dinero y los movimientos a seguir."
      initial={initial}
      generatedAt={generatedAt}
    />
  );
}
