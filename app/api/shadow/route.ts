import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SHADOW_TOOLS, executeTool } from "@/lib/shadow/tools";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BASE_SYSTEM = `Eres Shadow, el asistente de IA personal de André Valle Ortega — su Jarvis.

## Identidad
- Actúas como el sistema operativo de su vida: proactivo, estratégico, directo
- Hablas en español. Tono: cálido pero eficiente, leal, calmado, con autoridad. Nunca genérico
- Conoces su mundo: Flouvia (SaaS CRM que está construyendo), Panamericana (empresa académica), sus metas financieras (Lincoln Corsair → GT3 RS), su GPA de 9.0, sus hábitos
- Eres conciso. Sin relleno. Sin disclaimers innecesarios. No empieces con "¡Claro!" ni "Por supuesto"

## Acciones (tienes manos)
- Puedes EJECUTAR acciones reales con tus herramientas: crear notas en Brain, agregar/completar prioridades, crear/completar hábitos, registrar finanzas, crear eventos de calendario, consultar su rutina de gym, registrar entrenamientos y guardar memoria persistente
- Para gym: usa "consultar_rutina" para ver la rutina activa y el día sugerido; usa "registrar_entrenamiento" cuando André diga que entrenó (parsea ejercicios, peso, series y reps). André edita su rutina desde la app, tú solo consultas y registras sesiones
- Cuando André te pida algo accionable, HAZLO con la herramienta correspondiente — no solo describas cómo
- Usa "consultar_estado" cuando necesites datos frescos antes de analizar o decidir
- Después de ejecutar, confirma en una frase corta qué hiciste. Si algo falla, dilo claro
- Si una acción es ambigua o destructiva, pide una aclaración breve antes
- Usa "recordar" cuando André comparta una preferencia o dato clave que valga la pena conservar

## Estilo
- Respuestas cortas y accionables. Usa listas si hay varios puntos
- Lo urgente o importante, primero
- Dinero en MXN por defecto`;

async function buildSystemPrompt(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const today = new Date().toLocaleDateString("es-MX", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const { data: memories } = await supabase
    .from("shadow_memory")
    .select("category, fact, importance")
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .order("importance", { ascending: false })
    .limit(30);

  let memorySection = "";
  if (memories && memories.length > 0) {
    const byCategory: Record<string, string[]> = {};
    for (const m of memories) {
      const cat = m.category ?? "general";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(m.fact);
    }
    const parts = Object.entries(byCategory).map(
      ([cat, facts]) => `### ${cat}\n${facts.map((f) => `- ${f}`).join("\n")}`
    );
    memorySection = `\n\n## Memoria persistente\n${parts.join("\n\n")}`;
  }

  return `${BASE_SYSTEM}${memorySection}\n\nFecha actual: ${today}`;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { conversationId, message } = (await req.json()) as { conversationId?: string; message: string };

  let convId = conversationId;
  if (!convId) {
    const { data: conv } = await supabase
      .from("shadow_conversations")
      .insert({ title: message.slice(0, 60) || "Nueva conversación", pinned: false })
      .select("id")
      .single();
    convId = conv?.id;
  }
  if (!convId) {
    return NextResponse.json({ error: "Could not create conversation" }, { status: 500 });
  }

  await supabase.from("shadow_messages").insert({
    conversation_id: convId,
    role: "user",
    parts: [{ text: message }],
  });

  const [{ data: history }, systemPrompt] = await Promise.all([
    supabase
      .from("shadow_messages")
      .select("role, parts")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(40),
    buildSystemPrompt(supabase),
  ]);

  const messages: Anthropic.MessageParam[] = (history ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const parts = m.parts as { text: string }[];
      return {
        role: m.role as "user" | "assistant",
        content: parts.map((p) => p.text).join(""),
      };
    });

  const encoder = new TextEncoder();
  const capturedConvId = convId;

  const readable = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      send({ type: "conv", id: capturedConvId });

      let visibleText = "";
      const toolSummaries: string[] = [];

      try {
        for (let turn = 0; turn < 6; turn++) {
          const stream = anthropic.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: 1500,
            system: systemPrompt,
            tools: SHADOW_TOOLS,
            messages,
          });

          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              visibleText += event.delta.text;
              send({ type: "text", delta: event.delta.text });
            }
          }

          const final = await stream.finalMessage();
          messages.push({ role: "assistant", content: final.content });

          const toolUses = final.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
          );
          if (toolUses.length === 0) break;

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            send({ type: "tool", name: tu.name });
            const result = await executeTool(tu.name, tu.input, supabase, capturedConvId);
            toolSummaries.push(result.summary);
            send({ type: "tool_result", name: tu.name, ok: result.ok, summary: result.summary });
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: result.summary,
              is_error: !result.ok,
            });
          }
          messages.push({ role: "user", content: toolResults });
        }
      } catch (e) {
        send({ type: "error", message: (e as Error).message });
      }

      const finalText = visibleText.trim() || toolSummaries.join("\n") || "(sin respuesta)";
      const savedParts: { text?: string; tool?: string }[] = [{ text: finalText }];
      for (const s of toolSummaries) savedParts.push({ tool: s });

      await supabase.from("shadow_messages").insert({
        conversation_id: capturedConvId,
        role: "assistant",
        parts: savedParts,
      });
      await supabase
        .from("shadow_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", capturedConvId);

      send({ type: "done" });
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const convId = searchParams.get("conversationId");

  if (convId) {
    const { data: messages } = await supabase
      .from("shadow_messages")
      .select("id, role, parts, created_at")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    return NextResponse.json({ messages });
  }

  const { data: conversations } = await supabase
    .from("shadow_conversations")
    .select("id, title, pinned, updated_at")
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ conversations });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const convId = searchParams.get("conversationId");
  if (!convId) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await supabase.from("shadow_conversations").delete().eq("id", convId);
  return NextResponse.json({ ok: true });
}
