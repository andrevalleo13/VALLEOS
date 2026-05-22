import Anthropic from "@anthropic-ai/sdk";
import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FinancialCategory } from "@/lib/supabase/types";
import { formatCurrency } from "@/lib/utils";

type DB = SupabaseClient<Database>;

const FINANCIAL_CATEGORIES: FinancialCategory[] = [
  "flouvia_ingreso", "gasto_personal", "gasto_flouvia", "ahorro", "inversion",
];

export const SHADOW_TOOLS: Anthropic.Tool[] = [
  {
    name: "consultar_estado",
    description:
      "Consulta el estado actual de André: prioridades de hoy, hábitos y su avance, y resumen financiero del mes. Úsalo cuando necesites contexto fresco y concreto antes de responder, analizar o decidir.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "crear_nota",
    description:
      "Guarda una nota o pensamiento en Brain (la base de conocimiento de André). Úsalo cuando André quiera capturar una idea, observación o información para después.",
    input_schema: {
      type: "object",
      properties: { contenido: { type: "string", description: "El texto de la nota" } },
      required: ["contenido"],
    },
  },
  {
    name: "agregar_prioridad",
    description: "Agrega una prioridad o tarea al día de André. Por defecto es para hoy.",
    input_schema: {
      type: "object",
      properties: {
        texto: { type: "string" },
        fecha: { type: "string", description: "YYYY-MM-DD, opcional, default hoy" },
      },
      required: ["texto"],
    },
  },
  {
    name: "completar_prioridad",
    description: "Marca como completada una prioridad de hoy. Busca por coincidencia de texto.",
    input_schema: {
      type: "object",
      properties: { texto: { type: "string", description: "Texto o parte del texto de la prioridad" } },
      required: ["texto"],
    },
  },
  {
    name: "crear_habito",
    description: "Crea un nuevo hábito para André.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string" },
        color: { type: "string", description: "Hex opcional, ej #C9A35F" },
        icono: { type: "string", description: "Nombre de icono opcional" },
      },
      required: ["nombre"],
    },
  },
  {
    name: "completar_habito",
    description: "Marca un hábito como completado hoy. Busca por nombre.",
    input_schema: {
      type: "object",
      properties: { nombre: { type: "string" } },
      required: ["nombre"],
    },
  },
  {
    name: "registrar_finanza",
    description:
      "Registra un movimiento financiero (ingreso, gasto, ahorro o inversión). Montos en MXN por defecto.",
    input_schema: {
      type: "object",
      properties: {
        descripcion: { type: "string" },
        monto: { type: "number" },
        categoria: { type: "string", enum: FINANCIAL_CATEGORIES },
        fecha: { type: "string", description: "YYYY-MM-DD, opcional" },
      },
      required: ["descripcion", "monto", "categoria"],
    },
  },
  {
    name: "recordar",
    description:
      "Guarda un hecho importante en tu memoria persistente para futuras conversaciones (preferencias, contexto, datos clave de André).",
    input_schema: {
      type: "object",
      properties: {
        hecho: { type: "string" },
        categoria: { type: "string", description: "ej: preferencias, trabajo, salud, finanzas" },
        importancia: { type: "number", description: "1-10, qué tan importante es" },
      },
      required: ["hecho"],
    },
  },
  {
    name: "crear_evento",
    description: "Crea un evento en el Google Calendar de André.",
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        inicio: { type: "string", description: "ISO 8601 con fecha y hora, ej 2026-05-22T14:00:00" },
        fin: { type: "string", description: "ISO 8601, opcional (default +1h)" },
        descripcion: { type: "string" },
      },
      required: ["titulo", "inicio"],
    },
  },
];

const truncate = (s: string, n = 60) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export type ToolResult = { ok: boolean; summary: string };

export async function executeTool(
  name: string,
  rawInput: unknown,
  supabase: DB,
  convId: string
): Promise<ToolResult> {
  const input = (rawInput ?? {}) as Record<string, unknown>;
  const today = new Date().toISOString().split("T")[0];

  try {
    switch (name) {
      case "consultar_estado":
        return { ok: true, summary: await buildStatus(supabase, today) };

      case "crear_nota": {
        const contenido = String(input.contenido ?? "").trim();
        if (!contenido) return { ok: false, summary: "Falta el contenido de la nota." };
        const { error } = await supabase.from("brain_notes").insert({ content: contenido, source: "shadow" });
        if (error) throw error;
        return { ok: true, summary: `Nota guardada en Brain: "${truncate(contenido)}"` };
      }

      case "agregar_prioridad": {
        const texto = String(input.texto ?? "").trim();
        if (!texto) return { ok: false, summary: "Falta el texto de la prioridad." };
        const fecha = typeof input.fecha === "string" && input.fecha ? input.fecha : today;
        const { error } = await supabase.from("priorities").insert({ text: texto, date: fecha, completed: false });
        if (error) throw error;
        return { ok: true, summary: `Prioridad agregada: "${texto}"` };
      }

      case "completar_prioridad": {
        const texto = String(input.texto ?? "").trim();
        const { data } = await supabase
          .from("priorities").select("id, text").eq("date", today).ilike("text", `%${texto}%`).limit(1);
        const row = data?.[0];
        if (!row) return { ok: false, summary: `No encontré una prioridad de hoy que coincida con "${texto}".` };
        const { error } = await supabase.from("priorities").update({ completed: true }).eq("id", row.id);
        if (error) throw error;
        return { ok: true, summary: `Prioridad completada: "${row.text}"` };
      }

      case "crear_habito": {
        const nombre = String(input.nombre ?? "").trim();
        if (!nombre) return { ok: false, summary: "Falta el nombre del hábito." };
        const color = typeof input.color === "string" && input.color ? input.color : "#C9A35F";
        const icono = typeof input.icono === "string" && input.icono ? input.icono : null;
        const { data: maxRow } = await supabase.from("habits").select("sort_order").order("sort_order", { ascending: false }).limit(1);
        const sort_order = (maxRow?.[0]?.sort_order ?? 0) + 1;
        const { error } = await supabase.from("habits").insert({
          name: nombre, active: true, sort_order, type: "binary", unit: null, daily_target: null,
          color, icon: icono, freezes_available: 0, schedule_days: [0, 1, 2, 3, 4, 5, 6],
        });
        if (error) throw error;
        return { ok: true, summary: `Hábito creado: "${nombre}"` };
      }

      case "completar_habito": {
        const nombre = String(input.nombre ?? "").trim();
        const { data } = await supabase
          .from("habits").select("id, name").eq("active", true).ilike("name", `%${nombre}%`).limit(1);
        const row = data?.[0];
        if (!row) return { ok: false, summary: `No encontré un hábito que coincida con "${nombre}".` };
        const { error } = await supabase
          .from("habit_completions")
          .upsert({ habit_id: row.id, date: today, value: null, frozen: false }, { onConflict: "habit_id,date" });
        if (error) throw error;
        return { ok: true, summary: `Hábito completado hoy: "${row.name}"` };
      }

      case "registrar_finanza": {
        const descripcion = String(input.descripcion ?? "").trim();
        const monto = Number(input.monto);
        const categoria = String(input.categoria) as FinancialCategory;
        const fecha = typeof input.fecha === "string" && input.fecha ? input.fecha : today;
        if (!descripcion || !isFinite(monto)) return { ok: false, summary: "Falta descripción o un monto válido." };
        if (!FINANCIAL_CATEGORIES.includes(categoria))
          return { ok: false, summary: `Categoría inválida. Usa una de: ${FINANCIAL_CATEGORIES.join(", ")}.` };
        const { error } = await supabase.from("financial_entries").insert({
          category: categoria, amount: monto, description: descripcion, date: fecha,
          subcategory: null, card_id: null, payment_method: null,
        });
        if (error) throw error;
        return { ok: true, summary: `Movimiento registrado: ${descripcion} · ${formatCurrency(monto)} (${categoria})` };
      }

      case "recordar": {
        const hecho = String(input.hecho ?? "").trim();
        if (!hecho) return { ok: false, summary: "Falta el hecho a recordar." };
        const categoria = typeof input.categoria === "string" && input.categoria ? input.categoria : "general";
        const importancia = typeof input.importancia === "number" ? input.importancia : 5;
        const { error } = await supabase.from("shadow_memory").insert({
          category: categoria, fact: hecho, importance: importancia,
          source_conversation_id: convId, expires_at: null, last_used_at: null,
        });
        if (error) throw error;
        return { ok: true, summary: `Lo recordaré: "${truncate(hecho)}"` };
      }

      case "crear_evento": {
        const titulo = String(input.titulo ?? "").trim();
        const inicio = String(input.inicio ?? "");
        if (!titulo || !inicio) return { ok: false, summary: "Falta título o fecha de inicio." };
        const startDate = new Date(inicio);
        if (isNaN(startDate.getTime())) return { ok: false, summary: "Fecha de inicio inválida." };
        const fin = typeof input.fin === "string" && input.fin ? new Date(input.fin) : new Date(startDate.getTime() + 3600000);
        const descripcion = typeof input.descripcion === "string" ? input.descripcion : undefined;
        const created = await createCalendarEvent(titulo, startDate, fin, descripcion);
        if (!created) return { ok: false, summary: "No pude crear el evento (calendario no configurado o error)." };
        return {
          ok: true,
          summary: `Evento creado: "${titulo}" · ${startDate.toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`,
        };
      }

      default:
        return { ok: false, summary: `Herramienta desconocida: ${name}` };
    }
  } catch (e) {
    return { ok: false, summary: `Error ejecutando ${name}: ${(e as Error).message}` };
  }
}

async function createCalendarEvent(title: string, start: Date, end: Date, description?: string): Promise<boolean> {
  try {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const calendar = google.calendar({ version: "v3", auth: client });
    await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: title,
        description,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      },
    });
    return true;
  } catch (e) {
    console.error("createCalendarEvent error:", e);
    return false;
  }
}

async function buildStatus(supabase: DB, today: string): Promise<string> {
  const monthStart = today.slice(0, 7) + "-01";
  const [{ data: prios }, { data: habits }, { data: comps }, { data: entries }, { data: banks }] = await Promise.all([
    supabase.from("priorities").select("text, completed").eq("date", today),
    supabase.from("habits").select("id, name").eq("active", true),
    supabase.from("habit_completions").select("habit_id").eq("date", today),
    supabase.from("financial_entries").select("category, amount").gte("date", monthStart),
    supabase.from("bank_accounts").select("current_balance, currency").eq("active", true),
  ]);

  const done = new Set((comps ?? []).map((c) => c.habit_id));
  const prioList = (prios ?? []).map((p) => `${p.completed ? "✓" : "○"} ${p.text}`).join("; ") || "ninguna";
  const habitsList = (habits ?? []).map((h) => `${done.has(h.id) ? "✓" : "○"} ${h.name}`).join(", ") || "ninguno";
  const balance = (banks ?? []).filter((b) => b.currency === "MXN").reduce((a, b) => a + b.current_balance, 0);
  const income = (entries ?? []).filter((e) => e.category === "flouvia_ingreso").reduce((a, e) => a + e.amount, 0);
  const expenses = (entries ?? [])
    .filter((e) => e.category === "gasto_personal" || e.category === "gasto_flouvia")
    .reduce((a, e) => a + e.amount, 0);

  return `Estado de hoy (${today}):
Prioridades: ${prioList}
Hábitos (${done.size}/${(habits ?? []).length}): ${habitsList}
Finanzas del mes: saldo ${formatCurrency(balance)}, ingresos ${formatCurrency(income)}, gastos ${formatCurrency(expenses)}.`;
}
