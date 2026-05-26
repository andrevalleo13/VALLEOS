import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/utils";
import { normalizeBucket, bucketLabel } from "@/lib/finance/categories";
import type { FinancialCategory } from "@/lib/supabase/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type Kind = "gasto" | "ingreso" | "tarea" | "lectura" | "nota";
const KINDS: Kind[] = ["gasto", "ingreso", "tarea", "lectura", "nota"];

const READING_TYPES = ["article", "video", "podcast", "paper", "book", "other"];

type Classification = {
  kind: Kind;
  title: string;
  amount?: number;
  bucket?: string;
  url?: string;
  reading_type?: string;
  summary?: string;
};

async function classify(text: string): Promise<Classification> {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: `Eres el clasificador de la captura rápida de André. Recibes un texto suelto y decides a qué módulo de su OS pertenece. Tipos posibles:
- "gasto": registró un gasto/pago (ej. "pagué 200 de uber", "café 65"). Extrae "amount" (número MXN) y "bucket" canónico (escuela, comida, salidas, transporte, suscripciones, salud, hogar, compras, servicios, otros).
- "ingreso": entró dinero (ej. "me pagó el cliente 5000", "depósito 3000"). Extrae "amount".
- "tarea": algo que debe hacer hoy/pronto (ej. "llamar al dentista", "enviar propuesta"). Redacta "title" como acción imperativa concisa.
- "lectura": algo para leer/ver/escuchar (ej. "leer este paper sobre LLMs", una URL, "ver video de X"). Extrae "url" si hay, "reading_type" (article/video/podcast/paper/book/other) y "title".
- "nota": idea, pensamiento u observación que no encaja en lo anterior. Es el default cuando hay duda.
Responde ÚNICAMENTE con JSON válido, sin texto extra, forma exacta: {"kind":"...","title":"...","amount":0,"bucket":"...","url":"...","reading_type":"...","summary":"..."}. Incluye solo los campos relevantes al tipo; "title" siempre. "title" en español, breve.`,
    messages: [{ role: "user", content: text.slice(0, 800) }],
  });

  const raw = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw) as Partial<Classification>;
    const kind = KINDS.includes(parsed.kind as Kind) ? (parsed.kind as Kind) : "nota";
    return {
      kind,
      title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : text.slice(0, 80),
      amount: typeof parsed.amount === "number" && parsed.amount > 0 ? parsed.amount : undefined,
      bucket: typeof parsed.bucket === "string" ? parsed.bucket : undefined,
      url: typeof parsed.url === "string" ? parsed.url : undefined,
      reading_type: READING_TYPES.includes(parsed.reading_type ?? "") ? parsed.reading_type : "article",
      summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
    };
  } catch {
    return { kind: "nota", title: text.slice(0, 80) };
  }
}

export async function POST(req: Request) {
  const { text, force } = await req.json();
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "texto requerido" }, { status: 400 });
  }
  const content = text.trim();
  const supabase = await createClient();
  const today = todayISO();

  // force salta el clasificador cuando André elige el tipo a mano
  const c: Classification =
    force && KINDS.includes(force)
      ? { kind: force, title: content.split("\n").find((l) => l.trim()) ?? content.slice(0, 80) }
      : await classify(content);

  switch (c.kind) {
    case "gasto": {
      const bucket = normalizeBucket(c.bucket) ?? normalizeBucket(content) ?? "otros";
      const category: FinancialCategory = "gasto_personal";
      await supabase.from("financial_entries").insert({
        category, amount: c.amount ?? 0, description: c.title, subcategory: bucket,
        date: today, card_id: null, account_id: null, payment_method: null,
      });
      return NextResponse.json({
        kind: "gasto", icon: "DollarSign", href: "/finanzas",
        summary: c.amount ? `Gasto · $${c.amount.toLocaleString("es-MX")} · ${bucketLabel(bucket)}` : `Gasto · ${bucketLabel(bucket)}`,
      });
    }
    case "ingreso": {
      await supabase.from("financial_entries").insert({
        category: "flouvia_ingreso", amount: c.amount ?? 0, description: c.title, subcategory: "ingreso",
        date: today, card_id: null, account_id: null, payment_method: null,
      });
      return NextResponse.json({
        kind: "ingreso", icon: "TrendingUp", href: "/finanzas",
        summary: c.amount ? `Ingreso · $${c.amount.toLocaleString("es-MX")}` : "Ingreso registrado",
      });
    }
    case "tarea": {
      await supabase.from("priorities").insert({ text: c.title, date: today, completed: false });
      return NextResponse.json({ kind: "tarea", icon: "CheckSquare", href: "/", summary: `Prioridad de hoy · ${c.title}` });
    }
    case "lectura": {
      await supabase.from("reading_items").insert({
        url: c.url ?? "", title: c.title, summary: c.summary ?? null, source: null,
        type: c.reading_type ?? "article", estimated_minutes: null, status: "pending",
        notes: null, completed_at: null, cover_url: null, total_pages: null, current_page: null,
      });
      return NextResponse.json({ kind: "lectura", icon: "BookOpen", href: "/lectura", summary: `Lista de lectura · ${c.title}` });
    }
    default: {
      const { data: inserted } = await supabase
        .from("brain_notes")
        .insert({ content, source: "quick_capture", title: c.title })
        .select("id")
        .single();
      // Shadow enlaza la nota en segundo plano (no bloquea la captura)
      if (inserted?.id) {
        const base = new URL(req.url).origin;
        fetch(`${base}/api/brain/tag`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: inserted.id }),
        }).catch(() => {});
      }
      return NextResponse.json({ kind: "nota", icon: "Brain", href: "/brain", summary: `Nota · ${c.title}` });
    }
  }
}
