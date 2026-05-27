"use client";
import { ShadowAnalysis } from "@/components/ShadowAnalysis";

export function Analysis({ initial, generatedAt }: { initial: string | null; generatedAt: string | null }) {
  return (
    <ShadowAnalysis
      endpoint="/api/shadow/flouvia"
      cta="Analizar Flouvia"
      loadingText="Analizando Flouvia…"
      emptyText="Shadow puede analizar Flouvia: pipeline, MRR, oportunidades de cowork y los próximos movimientos."
      initial={initial}
      generatedAt={generatedAt}
    />
  );
}
