import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BASE_SYSTEM = `Eres Shadow, el asistente de IA personal de André Valle Ortega — su Jarvis.

## Identidad
- Actúas como el sistema operativo de su vida: proactivo, estratégico, directo
- Hablas en español. Tono: cálido pero eficiente, nunca genérico
- Conoces su mundo: Flouvia (SaaS CRM que está construyendo), Panamericana (empresa académica), sus metas financieras (Lincoln Corsair → GT3 RS), su GPA de 9.0, sus hábitos
- Eres conciso. Sin relleno. Sin disclaimers innecesarios

## Capacidades
- Tienes acceso a su calendario, finanzas, hábitos, metas, notas y proyectos
- Puedes analizar su situación y dar perspectivas estratégicas
- Recuerdas contexto de conversaciones anteriores
- Cuando hablas de dinero: MXN por defecto

## Estilo de respuesta
- Respuestas cortas y accionables cuando es posible
- Usa listas cuando hay múltiples puntos
- Si hay algo urgente o importante, menciónalo primero
- No empieces con "¡Claro!" ni "Por supuesto!"`;

async function buildSystemPrompt(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const today = new Date().toLocaleDateString("es-MX", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  // Load active memories sorted by importance
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
    const parts = Object.entries(byCategory).map(([cat, facts]) =>
      `### ${cat}\n${facts.map((f) => `- ${f}`).join("\n")}`
    );
    memorySection = `\n\n## Memoria persistente\n${parts.join("\n\n")}`;
  }

  return `${BASE_SYSTEM}${memorySection}\n\nFecha actual: ${today}`;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { conversationId, message } = await req.json() as { conversationId?: string; message: string };

  // 1. Get or create conversation
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

  // 2. Save user message
  await supabase.from("shadow_messages").insert({
    conversation_id: convId,
    role: "user",
    parts: [{ text: message }],
  });

  // 3. Load conversation history + build system prompt in parallel
  const [{ data: history }, systemPrompt] = await Promise.all([
    supabase
      .from("shadow_messages")
      .select("role, parts")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(40),
    buildSystemPrompt(supabase),
  ]);

  const anthropicMessages: Anthropic.MessageParam[] = (history ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const parts = m.parts as { text: string }[];
      return {
        role: m.role as "user" | "assistant",
        content: parts.map((p) => p.text).join(""),
      };
    });

  // 4. Stream response
  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: anthropicMessages,
  });

  const encoder = new TextEncoder();
  let fullText = "";
  const capturedConvId = convId;

  const readable = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`\x00${capturedConvId}\x00`));

      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          fullText += chunk.delta.text;
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }

      // 5. Save assistant response
      await supabase.from("shadow_messages").insert({
        conversation_id: capturedConvId,
        role: "assistant",
        parts: [{ text: fullText }],
      });

      // 6. Update conversation timestamp
      await supabase
        .from("shadow_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", capturedConvId);

      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Conversation-Id": capturedConvId,
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
