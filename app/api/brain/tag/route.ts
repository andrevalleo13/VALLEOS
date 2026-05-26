import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { BrainNote } from "@/lib/supabase/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const snippet = (s: string, n = 220) => (s.length > n ? s.slice(0, n) + "…" : s);

export async function POST(req: Request) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const supabase = await createClient();

  const { data: noteRaw } = await supabase.from("brain_notes").select("*").eq("id", id).single();
  const note = noteRaw as BrainNote | null;
  if (!note) return NextResponse.json({ error: "nota no encontrada" }, { status: 404 });

  const { data: othersRaw } = await supabase
    .from("brain_notes")
    .select("id, title, content")
    .neq("id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  const others = (othersRaw ?? []) as { id: string; title: string | null; content: string }[];

  const catalog = others
    .map((o) => `- [${o.id}] ${o.title ?? snippet(o.content, 60)}: ${snippet(o.content, 120)}`)
    .join("\n");

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    system: `Eres el motor de conocimiento de André. Recibes una NOTA nueva y un CATÁLOGO de notas existentes. Tu trabajo:
1. Extrae 2-4 etiquetas temáticas en español, en minúsculas, una o dos palabras cada una (ej. "flouvia", "idea de producto", "salud", "filosofía"). Reutiliza conceptos del catálogo cuando apliquen para mantener consistencia.
2. Identifica hasta 3 notas del catálogo SEMÁNTICAMENTE relacionadas (mismo tema, proyecto o idea). Solo incluye relaciones reales; si no hay ninguna, devuelve lista vacía.
Responde ÚNICAMENTE con JSON válido, sin texto extra, con esta forma exacta: {"tags": ["..."], "related": ["<id>", ...]}. Los ids de "related" deben venir literalmente del catálogo.`,
    messages: [
      {
        role: "user",
        content: `NOTA nueva:\n"${snippet(note.content, 600)}"\n\nCATÁLOGO:\n${catalog || "(vacío)"}`,
      },
    ],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  let tags: string[] = [];
  let related: string[] = [];
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : text);
    if (Array.isArray(parsed.tags)) tags = parsed.tags.filter((t: unknown) => typeof t === "string").slice(0, 4);
    if (Array.isArray(parsed.related)) related = parsed.related.filter((r: unknown) => typeof r === "string");
  } catch {
    /* devolvemos vacío si el modelo no entregó JSON */
  }

  const validIds = new Set(others.map((o) => o.id));
  related = related.filter((r) => validIds.has(r)).slice(0, 3);

  await supabase.from("brain_notes").update({ tags, related_ids: related }).eq("id", id);

  return NextResponse.json({ tags, related });
}
