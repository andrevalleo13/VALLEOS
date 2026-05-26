import Anthropic from "@anthropic-ai/sdk";
import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FinancialCategory } from "@/lib/supabase/types";
import { formatCurrency, todayISO } from "@/lib/utils";
import { normalizeMuscle } from "@/lib/gym/muscles";
import {
  computeCourseGrades,
  neededForTarget,
  suggestStudyStart,
  daysUntil,
  KIND_LABELS,
  DIFFICULTY_LABELS,
} from "@/lib/academia/grades";
import { normalizeBucket, bucketLabel, entryBucket, SPENDING_BUCKETS } from "@/lib/finance/categories";
import { buildUpcomingPayments } from "@/lib/finance/payments";
import { avg, weightStats, sleepDebt, compareWindows, correlate, corrLabel } from "@/lib/salud/health";
import { goalPct, goalPace, milestoneState } from "@/lib/metas/progress";
import type { HealthEntry, WeightLog, Goal, GoalMilestone } from "@/lib/supabase/types";

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
      "Registra un movimiento financiero (ingreso, gasto, ahorro o inversión) en MXN. IMPORTANTE: tú categorizas. Elige la 'categoria' general y SIEMPRE asigna una 'subcategoria' canónica según en qué se gastó (ej. un café → comida, un Uber → transporte, Netflix → suscripciones, colegiatura → escuela). Si André menciona con qué pagó (efectivo, débito, una tarjeta), ponlo en metodo_pago.",
    input_schema: {
      type: "object",
      properties: {
        descripcion: { type: "string" },
        monto: { type: "number" },
        categoria: { type: "string", enum: FINANCIAL_CATEGORIES },
        subcategoria: {
          type: "string",
          description: `En qué se gastó/asignó. Elige la más cercana: ${SPENDING_BUCKETS.join(", ")}.`,
          enum: SPENDING_BUCKETS,
        },
        metodo_pago: { type: "string", description: "ej. efectivo, débito, tarjeta de crédito, transferencia. Opcional." },
        fecha: { type: "string", description: "YYYY-MM-DD, opcional" },
      },
      required: ["descripcion", "monto", "categoria"],
    },
  },
  {
    name: "consultar_finanzas",
    description:
      "Consulta el detalle financiero de André: patrimonio neto, saldos por cuenta, ingresos/gastos del mes, distribución del gasto por categoría (en qué gasta más), y próximos pagos de tarjetas y cargos recurrentes (cuándo y cuánto). Úsalo antes de analizar finanzas, responder en qué gasta, o avisar de pagos.",
    input_schema: { type: "object", properties: {} },
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
    name: "consultar_rutina",
    description:
      "Consulta la rutina de gym activa de André, sus días y el día sugerido para hoy con sus ejercicios. Úsalo antes de proponer o registrar un entrenamiento.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "registrar_entrenamiento",
    description:
      "Registra una sesión de gym de André: el día de rutina y los ejercicios con peso y repeticiones. Úsalo cuando André diga que entrenó (ej. 'hice push: press banca 80kg 4x10, militar 40kg 3x8').",
    input_schema: {
      type: "object",
      properties: {
        dia: { type: "string", description: "Nombre del día de rutina (ej. Push, Pull, Pierna). Opcional." },
        fecha: { type: "string", description: "YYYY-MM-DD, opcional, default hoy" },
        duracion_min: { type: "number", description: "Duración en minutos, opcional" },
        peso_corporal: { type: "number", description: "Peso corporal en kg, opcional" },
        ejercicios: {
          type: "array",
          description: "Ejercicios realizados",
          items: {
            type: "object",
            properties: {
              nombre: { type: "string" },
              musculo: { type: "string", description: "grupo muscular: pecho, espalda, hombros, biceps, triceps, cuadriceps, isquios, gluteos, pantorrillas, abdomen, trapecio, antebrazo, lumbar" },
              peso_kg: { type: "number" },
              reps: { type: "number" },
              series: { type: "number", description: "número de series, default 1" },
            },
            required: ["nombre"],
          },
        },
      },
      required: ["ejercicios"],
    },
  },
  {
    name: "consultar_academia",
    description:
      "Consulta el estado académico de André en la Panamericana: materias con su calificación actual/proyectada/meta y qué necesita en lo que falta, faltas vs. límite, exámenes próximos con dificultad y desde cuándo estudiar, y entregas pendientes. Úsalo antes de analizar, proyectar o aconsejar sobre la escuela.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "agregar_componente",
    description:
      "Agrega un componente de calificación a una materia: examen (parcial/final), tarea, proyecto o participación, con su peso (% del 100). Para exámenes incluye dificultad (1-5) y, si no la das, calcula sola la fecha desde cuándo conviene empezar a estudiar.",
    input_schema: {
      type: "object",
      properties: {
        materia: { type: "string", description: "Nombre (o parte) de la materia" },
        nombre: { type: "string", description: "ej. 'Parcial 1', 'Proyecto final'" },
        tipo: { type: "string", enum: ["examen", "tarea", "proyecto", "participacion", "otro"] },
        peso: { type: "number", description: "% del 100 que vale" },
        calificacion: { type: "number", description: "0-10, opcional si ya tiene nota" },
        fecha: { type: "string", description: "YYYY-MM-DD, fecha del examen/entrega, opcional" },
        dificultad: { type: "number", description: "1 (fácil) a 5 (muy difícil), solo exámenes" },
        estudiar_desde: { type: "string", description: "YYYY-MM-DD, opcional (se calcula sola)" },
        temas: { type: "string", description: "temas a estudiar, opcional" },
      },
      required: ["materia", "nombre"],
    },
  },
  {
    name: "calificar_componente",
    description:
      "Registra la calificación obtenida en un componente (ej. un parcial) de una materia y recalcula la calificación de la materia. Busca el componente por nombre dentro de la materia.",
    input_schema: {
      type: "object",
      properties: {
        materia: { type: "string" },
        componente: { type: "string", description: "Nombre o parte del componente, ej 'Parcial 1'" },
        calificacion: { type: "number", description: "0-10" },
      },
      required: ["materia", "componente", "calificacion"],
    },
  },
  {
    name: "registrar_falta",
    description:
      "Registra falta(s) a una materia y avisa qué tan cerca está André del límite permitido.",
    input_schema: {
      type: "object",
      properties: {
        materia: { type: "string" },
        cantidad: { type: "number", description: "Cuántas faltas, default 1" },
      },
      required: ["materia"],
    },
  },
  {
    name: "consultar_salud",
    description:
      "Consulta el estado de salud de André: peso actual y tendencia, promedios de sueño/ánimo/energía/pasos de los últimos 7 días con su cambio vs. la semana previa, deuda de sueño y correlaciones (cómo el sueño afecta su ánimo y energía). Úsalo antes de analizar o aconsejar sobre salud, sueño, peso o energía.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "registrar_salud",
    description:
      "Registra el día de salud de André (sueño, ánimo, energía, pasos, agua, ejercicio). Úsalo cuando diga cosas como 'dormí 7 horas, ando con buena energía' o 'caminé 9 mil pasos'. NO uses esto para el peso — para el peso usa 'registrar_peso'.",
    input_schema: {
      type: "object",
      properties: {
        fecha: { type: "string", description: "YYYY-MM-DD, opcional, default hoy" },
        horas_sueno: { type: "number", description: "Horas dormidas" },
        calidad_sueno: { type: "number", description: "1-5" },
        animo: { type: "number", description: "1-5" },
        energia: { type: "number", description: "1-5" },
        pasos: { type: "number" },
        fc_reposo: { type: "number", description: "Frecuencia cardiaca en reposo (lpm)" },
        agua_l: { type: "number", description: "Litros de agua" },
        ejercicio_min: { type: "number" },
        tipo_ejercicio: { type: "string" },
        notas: { type: "string" },
      },
    },
  },
  {
    name: "registrar_peso",
    description:
      "Registra el peso de André (y opcionalmente % de grasa y kg de músculo). André no se pesa a diario, así que esto crea/actualiza la medición de ese día y el último registro queda como su peso actual.",
    input_schema: {
      type: "object",
      properties: {
        peso_kg: { type: "number" },
        grasa_pct: { type: "number", description: "% de grasa corporal, opcional" },
        musculo_kg: { type: "number", description: "kg de masa muscular, opcional" },
        fecha: { type: "string", description: "YYYY-MM-DD, opcional, default hoy" },
        notas: { type: "string" },
      },
      required: ["peso_kg"],
    },
  },
  {
    name: "consultar_metas",
    description:
      "Consulta las metas activas de André: progreso de cada una, si va a tiempo/adelantado/atrasado según su fecha objetivo, hitos pendientes con fecha, y qué hábitos la sostienen con su adherencia (30d). Úsalo antes de analizar, aconsejar o actualizar metas.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "crear_meta",
    description:
      "Crea una meta para André. Elige el tipo de progreso: 'percentage' (avance 0-100%), 'numeric' (medible, requiere valor objetivo y unidad, ej. 12 libros) o 'milestones' (el progreso lo definen los hitos). Agrega hitos con fecha si los menciona.",
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        categoria: { type: "string", enum: ["career", "finance", "health", "learning", "relationships", "experience", "creative", "other"] },
        descripcion: { type: "string", description: "Por qué importa, opcional" },
        tipo_progreso: { type: "string", enum: ["percentage", "numeric", "milestones"], description: "default percentage" },
        valor_objetivo: { type: "number", description: "Solo para tipo numeric" },
        unidad: { type: "string", description: "Solo para tipo numeric, ej. libros, km" },
        fecha_objetivo: { type: "string", description: "YYYY-MM-DD, opcional" },
        hitos: {
          type: "array",
          description: "Hitos iniciales, opcional",
          items: { type: "object", properties: { titulo: { type: "string" }, fecha: { type: "string", description: "YYYY-MM-DD opcional" } }, required: ["titulo"] },
        },
      },
      required: ["titulo"],
    },
  },
  {
    name: "actualizar_progreso_meta",
    description:
      "Actualiza el progreso de una meta de André (busca por título). Para metas de porcentaje pasa el % (0-100); para numéricas pasa el valor actual (ej. 5 libros leídos). Si alcanza el objetivo se marca completada. No usar en metas por hitos (usa completar_hito).",
    input_schema: {
      type: "object",
      properties: {
        meta: { type: "string", description: "Título o parte del título de la meta" },
        valor: { type: "number", description: "% (0-100) o valor numérico actual" },
      },
      required: ["meta", "valor"],
    },
  },
  {
    name: "agregar_hito",
    description: "Agrega un hito (paso) a una meta de André, opcionalmente con fecha límite. Busca la meta por título.",
    input_schema: {
      type: "object",
      properties: {
        meta: { type: "string", description: "Título o parte del título de la meta" },
        hito: { type: "string", description: "El hito a agregar" },
        fecha: { type: "string", description: "YYYY-MM-DD fecha límite, opcional" },
      },
      required: ["meta", "hito"],
    },
  },
  {
    name: "completar_hito",
    description: "Marca un hito de una meta como completado. Busca la meta por título y el hito por coincidencia de texto.",
    input_schema: {
      type: "object",
      properties: {
        meta: { type: "string", description: "Título o parte del título de la meta" },
        hito: { type: "string", description: "Texto o parte del texto del hito" },
      },
      required: ["meta", "hito"],
    },
  },
  {
    name: "vincular_habito_meta",
    description:
      "Vincula un hábito a una meta para registrar qué hábito la sostiene (el 'motor' de la meta). Busca ambos por nombre/título.",
    input_schema: {
      type: "object",
      properties: {
        meta: { type: "string", description: "Título o parte del título de la meta" },
        habito: { type: "string", description: "Nombre o parte del nombre del hábito" },
      },
      required: ["meta", "habito"],
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
        ubicacion: { type: "string", description: "Lugar del evento, opcional" },
      },
      required: ["titulo", "inicio"],
    },
  },
  {
    name: "consultar_eventos",
    description:
      "Lee los próximos eventos del Google Calendar de André para razonar sobre su agenda y urgencia. Devuelve los eventos ordenados por hora con cuánto falta para cada uno. Úsalo antes de hablar de la agenda, decidir qué es urgente, o crear notificaciones de calendario.",
    input_schema: {
      type: "object",
      properties: {
        dias: { type: "number", description: "Cuántos días hacia adelante mirar, default 7" },
      },
    },
  },
  {
    name: "editar_evento",
    description:
      "Edita un evento existente del calendario, buscándolo por coincidencia de título entre los próximos eventos. Permite cambiar título, horario (para agrandarlo o moverlo), descripción o ubicación.",
    input_schema: {
      type: "object",
      properties: {
        buscar: { type: "string", description: "Texto del título del evento a editar" },
        titulo: { type: "string", description: "Nuevo título, opcional" },
        inicio: { type: "string", description: "Nuevo inicio ISO 8601, opcional" },
        fin: { type: "string", description: "Nuevo fin ISO 8601, opcional" },
        descripcion: { type: "string", description: "Nueva descripción, opcional" },
        ubicacion: { type: "string", description: "Nueva ubicación, opcional" },
      },
      required: ["buscar"],
    },
  },
  {
    name: "eliminar_evento",
    description: "Elimina un evento del calendario, buscándolo por coincidencia de título entre los próximos eventos.",
    input_schema: {
      type: "object",
      properties: { buscar: { type: "string", description: "Texto del título del evento a eliminar" } },
      required: ["buscar"],
    },
  },
  {
    name: "controlar_mac",
    description:
      "Ejecuta una acción en la Mac de André: abrir apps, abrir URLs, leer/escribir/eliminar archivos, listar directorios, ejecutar comandos de shell, mostrar notificaciones nativas y obtener contexto de la pantalla (app activa + portapapeles). IMPORTANTE: solo úsala cuando André te lo pida explícitamente. Solo disponible cuando el daemon local corre en su Mac.",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["open_app", "open_url", "read_file", "write_file", "delete_file", "list_dir", "run_shell", "notify_mac", "get_context"],
          description: "Qué hacer",
        },
        app: { type: "string", description: "Nombre de la app (para open_app), ej. Spotify, Chrome, Finder" },
        url: { type: "string", description: "URL a abrir (para open_url)" },
        path: { type: "string", description: "Ruta del archivo o directorio. Soporta ~ para home." },
        content: { type: "string", description: "Contenido a escribir (para write_file)" },
        cmd: { type: "string", description: "Comando de shell a ejecutar (para run_shell)" },
        title: { type: "string", description: "Título (para notify_mac)" },
        body: { type: "string", description: "Cuerpo del mensaje (para notify_mac)" },
      },
      required: ["action"],
    },
  },
  {
    name: "crear_notificacion",
    description:
      "Crea una notificación que aparece en la campana del topbar de André (centro de notificaciones). Úsala para avisarle de algo importante o urgente: un evento próximo, un recordatorio, una alerta. Sé específico y breve.",
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        cuerpo: { type: "string", description: "Detalle breve, opcional" },
        severidad: { type: "string", enum: ["info", "warning", "error", "success"], description: "default info" },
        modulo: { type: "string", description: "Módulo relacionado, ej: calendario, finanzas. Opcional" },
        enlace: { type: "string", description: "Ruta interna a abrir al hacer click, ej /calendario. Opcional" },
      },
      required: ["titulo"],
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
  const today = todayISO();

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
        const subcategory =
          normalizeBucket(typeof input.subcategoria === "string" ? input.subcategoria : null) ??
          normalizeBucket(descripcion) ??
          (categoria === "gasto_personal" ? "otros" : null);
        const payment_method = typeof input.metodo_pago === "string" && input.metodo_pago ? input.metodo_pago : null;
        const { error } = await supabase.from("financial_entries").insert({
          category: categoria, amount: monto, description: descripcion, date: fecha,
          subcategory, card_id: null, account_id: null, payment_method,
        });
        if (error) throw error;
        const tag = subcategory ? ` · ${bucketLabel(subcategory)}` : "";
        return { ok: true, summary: `Movimiento registrado: ${descripcion} · ${formatCurrency(monto)}${tag}` };
      }

      case "consultar_finanzas":
        return { ok: true, summary: await buildFinanceDetail(supabase, today) };

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

      case "consultar_rutina":
        return { ok: true, summary: await buildRoutine(supabase) };

      case "registrar_entrenamiento": {
        const ejercicios = Array.isArray(input.ejercicios) ? (input.ejercicios as Record<string, unknown>[]) : [];
        if (ejercicios.length === 0) return { ok: false, summary: "No me diste ejercicios para registrar." };
        const fecha = typeof input.fecha === "string" && input.fecha ? input.fecha : today;

        const { data: routines } = await supabase.from("workout_routines").select("id, active").order("sort_order");
        const routine = (routines ?? []).find((r) => r.active) ?? (routines ?? [])[0] ?? null;

        let dayId: string | null = null;
        let dayName: string | null = null;
        const diaStr = typeof input.dia === "string" ? input.dia.trim() : "";
        if (routine && diaStr) {
          const { data: dm } = await supabase
            .from("workout_days").select("id, name").eq("routine_id", routine.id).ilike("name", `%${diaStr}%`).limit(1);
          if (dm?.[0]) { dayId = dm[0].id; dayName = dm[0].name; }
        }
        if (!dayName && diaStr) dayName = diaStr;

        const { data: sess, error } = await supabase
          .from("workout_sessions")
          .insert({
            date: fecha,
            routine_id: routine?.id ?? null,
            day_id: dayId,
            day_name: dayName,
            duration_minutes: typeof input.duracion_min === "number" ? Math.round(input.duracion_min) : null,
            bodyweight_kg: typeof input.peso_corporal === "number" ? input.peso_corporal : null,
            notes: null,
          })
          .select("id")
          .single();
        if (error || !sess) throw error ?? new Error("No pude crear la sesión.");

        let dayExercises: { id: string; name: string; muscle_group: string | null }[] = [];
        if (dayId) {
          const { data } = await supabase.from("workout_exercises").select("id, name, muscle_group").eq("day_id", dayId);
          dayExercises = data ?? [];
        }

        const rows: Database["public"]["Tables"]["workout_sets"]["Insert"][] = [];
        let totalSets = 0;
        for (const ex of ejercicios) {
          const nombre = String(ex?.nombre ?? "").trim();
          if (!nombre) continue;
          const lower = nombre.toLowerCase();
          const match =
            dayExercises.find((d) => d.name.toLowerCase() === lower) ??
            dayExercises.find((d) => d.name.toLowerCase().includes(lower) || lower.includes(d.name.toLowerCase()));
          const muscle = normalizeMuscle(typeof ex?.musculo === "string" ? ex.musculo : null) ?? match?.muscle_group ?? null;
          const peso = typeof ex?.peso_kg === "number" ? ex.peso_kg : null;
          const reps = typeof ex?.reps === "number" ? Math.round(ex.reps) : null;
          const series = typeof ex?.series === "number" && ex.series > 0 ? Math.round(ex.series) : 1;
          for (let i = 0; i < series; i++) {
            totalSets++;
            rows.push({
              session_id: sess.id, exercise_id: match?.id ?? null, exercise_name: nombre,
              muscle_group: muscle, set_number: i + 1, weight_kg: peso, reps, rpe: null,
            });
          }
        }
        if (rows.length) {
          const { error: e2 } = await supabase.from("workout_sets").insert(rows);
          if (e2) throw e2;
        }
        const nombres = ejercicios.map((e) => String(e?.nombre ?? "")).filter(Boolean);
        return { ok: true, summary: `Sesión registrada${dayName ? ` · ${dayName}` : ""}: ${nombres.length} ejercicios, ${totalSets} series.` };
      }

      case "consultar_academia":
        return { ok: true, summary: await buildAcademia(supabase, today) };

      case "agregar_componente": {
        const course = await findCourse(supabase, String(input.materia ?? ""));
        if (!course) return { ok: false, summary: `No encontré la materia "${input.materia}".` };
        const nombre = String(input.nombre ?? "").trim();
        if (!nombre) return { ok: false, summary: "Falta el nombre del componente." };
        const kind = ["examen", "tarea", "proyecto", "participacion", "otro"].includes(String(input.tipo))
          ? String(input.tipo) : "otro";
        const fecha = typeof input.fecha === "string" && input.fecha ? input.fecha : null;
        const dificultad = typeof input.dificultad === "number" ? Math.max(1, Math.min(5, Math.round(input.dificultad))) : null;
        let study = typeof input.estudiar_desde === "string" && input.estudiar_desde ? input.estudiar_desde : null;
        if (!study && kind === "examen" && fecha) study = suggestStudyStart(fecha, dificultad);
        const grade = typeof input.calificacion === "number" ? input.calificacion : null;
        const { data: maxRow } = await supabase.from("grade_components").select("sort_order").eq("course_id", course.id).order("sort_order", { ascending: false }).limit(1);
        const { error } = await supabase.from("grade_components").insert({
          course_id: course.id, name: nombre, kind,
          weight: typeof input.peso === "number" ? input.peso : 0,
          grade, date: fecha, difficulty: dificultad, study_start_date: study,
          topics: typeof input.temas === "string" && input.temas ? input.temas : null,
          status: grade !== null ? "done" : "pending",
          sort_order: (maxRow?.[0]?.sort_order ?? 0) + 1,
        });
        if (error) throw error;
        if (grade !== null) await recomputeCourseGrade(supabase, course.id);
        const extra = kind === "examen" && study ? ` · estudiar desde ${study}` : "";
        return { ok: true, summary: `Agregado a ${course.name}: ${KIND_LABELS[kind]} "${nombre}"${input.peso ? ` (${input.peso}%)` : ""}${extra}.` };
      }

      case "calificar_componente": {
        const course = await findCourse(supabase, String(input.materia ?? ""));
        if (!course) return { ok: false, summary: `No encontré la materia "${input.materia}".` };
        const compName = String(input.componente ?? "").trim();
        const cal = Number(input.calificacion);
        if (!isFinite(cal)) return { ok: false, summary: "Falta una calificación válida (0-10)." };
        const { data: comps } = await supabase
          .from("grade_components").select("id, name").eq("course_id", course.id).ilike("name", `%${compName}%`).limit(1);
        const comp = comps?.[0];
        if (!comp) return { ok: false, summary: `No encontré "${compName}" en ${course.name}.` };
        const { error } = await supabase.from("grade_components").update({ grade: cal, status: "done" }).eq("id", comp.id);
        if (error) throw error;
        const newGrade = await recomputeCourseGrade(supabase, course.id);
        return { ok: true, summary: `${comp.name} en ${course.name}: ${cal}. Calificación de la materia ahora: ${newGrade !== null ? newGrade.toFixed(2) : "—"}.` };
      }

      case "registrar_falta": {
        const course = await findCourse(supabase, String(input.materia ?? ""));
        if (!course) return { ok: false, summary: `No encontré la materia "${input.materia}".` };
        const n = typeof input.cantidad === "number" && input.cantidad > 0 ? Math.round(input.cantidad) : 1;
        const newAbs = (course.absences ?? 0) + n;
        const { error } = await supabase.from("academic_courses").update({ absences: newAbs }).eq("id", course.id);
        if (error) throw error;
        const limit = course.max_absences;
        const tail = limit ? ` (${newAbs}/${limit}${newAbs >= limit ? " — ¡límite alcanzado!" : newAbs >= limit * 0.66 ? " — ojo, cerca del límite" : ""})` : ` (${newAbs} en total)`;
        return { ok: true, summary: `Falta registrada en ${course.name}${tail}.` };
      }

      case "consultar_salud":
        return { ok: true, summary: await buildHealthDetail(supabase, today) };

      case "registrar_salud": {
        const fecha = typeof input.fecha === "string" && input.fecha ? input.fecha : today;
        const numOr = (k: string) => (typeof input[k] === "number" ? (input[k] as number) : null);
        const intOr = (k: string) => {
          const n = numOr(k);
          return n == null ? null : Math.round(n);
        };
        const fields = {
          sleep_hours: numOr("horas_sueno"),
          sleep_quality: intOr("calidad_sueno"),
          mood: intOr("animo"),
          energy: intOr("energia"),
          steps: intOr("pasos"),
          resting_hr: intOr("fc_reposo"),
          water_l: numOr("agua_l"),
          workout_minutes: intOr("ejercicio_min"),
          workout_type: typeof input.tipo_ejercicio === "string" && input.tipo_ejercicio ? input.tipo_ejercicio : null,
          notes: typeof input.notas === "string" && input.notas ? input.notas : null,
        };
        if (Object.values(fields).every((v) => v == null)) {
          return { ok: false, summary: "No me diste ningún dato de salud para registrar." };
        }
        const { error } = await supabase.from("health_entries").upsert(
          { date: fecha, source: "shadow", ...fields } as never,
          { onConflict: "date" }
        );
        if (error) throw error;
        const parts: string[] = [];
        if (fields.sleep_hours != null) parts.push(`${fields.sleep_hours}h sueño`);
        if (fields.mood != null) parts.push(`ánimo ${fields.mood}/5`);
        if (fields.energy != null) parts.push(`energía ${fields.energy}/5`);
        if (fields.steps != null) parts.push(`${fields.steps} pasos`);
        if (fields.workout_minutes != null) parts.push(`${fields.workout_minutes}min ejercicio`);
        return { ok: true, summary: `Día registrado (${fecha}): ${parts.join(", ") || "datos guardados"}.` };
      }

      case "registrar_peso": {
        const peso = Number(input.peso_kg);
        if (!isFinite(peso) || peso <= 0) return { ok: false, summary: "Falta un peso válido en kg." };
        const fecha = typeof input.fecha === "string" && input.fecha ? input.fecha : today;
        const { error } = await supabase.from("weight_logs").upsert(
          {
            date: fecha,
            weight_kg: peso,
            body_fat_pct: typeof input.grasa_pct === "number" ? input.grasa_pct : null,
            muscle_kg: typeof input.musculo_kg === "number" ? input.musculo_kg : null,
            notes: typeof input.notas === "string" && input.notas ? input.notas : null,
            source: "shadow",
          },
          { onConflict: "date" }
        );
        if (error) throw error;
        const extra = typeof input.grasa_pct === "number" ? ` · ${input.grasa_pct}% grasa` : "";
        return { ok: true, summary: `Peso registrado: ${peso}kg (${fecha})${extra}.` };
      }

      case "consultar_metas":
        return { ok: true, summary: await buildMetas(supabase, today) };

      case "crear_meta": {
        const titulo = String(input.titulo ?? "").trim();
        if (!titulo) return { ok: false, summary: "Falta el título de la meta." };
        const categoria = typeof input.categoria === "string" && input.categoria ? input.categoria : "other";
        const tipo = ["percentage", "numeric", "milestones"].includes(String(input.tipo_progreso)) ? String(input.tipo_progreso) : "percentage";
        const valorObj = tipo === "numeric" && typeof input.valor_objetivo === "number" ? input.valor_objetivo : null;
        const unidad = tipo === "numeric" && typeof input.unidad === "string" && input.unidad ? input.unidad : null;
        const fechaObj = typeof input.fecha_objetivo === "string" && input.fecha_objetivo ? input.fecha_objetivo : null;
        const { data: goal, error } = await supabase.from("goals").insert({
          title: titulo, category: categoria, description: typeof input.descripcion === "string" ? input.descripcion : null,
          target_date: fechaObj, started_at: today, progress_type: tipo, current_value: 0,
          target_value: valorObj, unit: unidad, image_url: null, pinned: false, status: "active",
          completed_at: null, sort_order: 0,
        }).select("id").single();
        if (error) throw error;
        const goalId = (goal as { id: string } | null)?.id;
        const hitos = Array.isArray(input.hitos) ? input.hitos : [];
        if (goalId && hitos.length) {
          const rows = hitos
            .map((h, i) => {
              const t = typeof (h as Record<string, unknown>)?.titulo === "string" ? String((h as Record<string, unknown>).titulo).trim() : "";
              if (!t) return null;
              const f = typeof (h as Record<string, unknown>)?.fecha === "string" ? String((h as Record<string, unknown>).fecha) : null;
              return { goal_id: goalId, title: t, due_date: f || null, done: false, done_at: null, sort_order: i };
            })
            .filter((r): r is NonNullable<typeof r> => !!r);
          if (rows.length) await supabase.from("goal_milestones").insert(rows);
        }
        const hitoTag = hitos.length ? ` · ${hitos.length} hito(s)` : "";
        return { ok: true, summary: `Meta creada: "${titulo}"${fechaObj ? ` (objetivo ${fechaObj})` : ""}${hitoTag}.` };
      }

      case "actualizar_progreso_meta": {
        const metaq = String(input.meta ?? "").trim();
        const valor = Number(input.valor);
        if (!isFinite(valor)) return { ok: false, summary: "Falta un valor numérico válido." };
        const { data } = await supabase.from("goals").select("id, title, progress_type, target_value").neq("status", "archived").ilike("title", `%${metaq}%`).limit(1);
        const g = data?.[0];
        if (!g) return { ok: false, summary: `No encontré una meta que coincida con "${metaq}".` };
        if (g.progress_type === "milestones") return { ok: false, summary: `"${g.title}" avanza por hitos. Usa completar_hito.` };
        const reached = (g.progress_type === "numeric" && g.target_value != null && valor >= g.target_value) || (g.progress_type !== "numeric" && valor >= 100);
        const { error } = await supabase.from("goals").update({
          current_value: valor, ...(reached ? { status: "completed", completed_at: new Date().toISOString() } : {}),
        }).eq("id", g.id);
        if (error) throw error;
        const shown = g.progress_type === "numeric" ? `${valor}${g.target_value ? `/${g.target_value}` : ""}` : `${valor}%`;
        return { ok: true, summary: `Progreso de "${g.title}": ${shown}${reached ? " · ✓ completada" : ""}.` };
      }

      case "agregar_hito": {
        const metaq = String(input.meta ?? "").trim();
        const hito = String(input.hito ?? "").trim();
        if (!hito) return { ok: false, summary: "Falta el texto del hito." };
        const { data } = await supabase.from("goals").select("id, title").neq("status", "archived").ilike("title", `%${metaq}%`).limit(1);
        const g = data?.[0];
        if (!g) return { ok: false, summary: `No encontré una meta que coincida con "${metaq}".` };
        const { data: maxRow } = await supabase.from("goal_milestones").select("sort_order").eq("goal_id", g.id).order("sort_order", { ascending: false }).limit(1);
        const sort_order = (maxRow?.[0]?.sort_order ?? -1) + 1;
        const fecha = typeof input.fecha === "string" && input.fecha ? input.fecha : null;
        const { error } = await supabase.from("goal_milestones").insert({ goal_id: g.id, title: hito, due_date: fecha, done: false, done_at: null, sort_order });
        if (error) throw error;
        return { ok: true, summary: `Hito agregado a "${g.title}": "${hito}"${fecha ? ` (${fecha})` : ""}.` };
      }

      case "completar_hito": {
        const metaq = String(input.meta ?? "").trim();
        const hitoq = String(input.hito ?? "").trim();
        const { data: gs } = await supabase.from("goals").select("id, title").neq("status", "archived").ilike("title", `%${metaq}%`).limit(1);
        const g = gs?.[0];
        if (!g) return { ok: false, summary: `No encontré una meta que coincida con "${metaq}".` };
        const { data: hs } = await supabase.from("goal_milestones").select("id, title, done").eq("goal_id", g.id).ilike("title", `%${hitoq}%`).limit(1);
        const h = hs?.[0];
        if (!h) return { ok: false, summary: `No encontré un hito en "${g.title}" que coincida con "${hitoq}".` };
        const { error } = await supabase.from("goal_milestones").update({ done: true, done_at: new Date().toISOString() }).eq("id", h.id);
        if (error) throw error;
        return { ok: true, summary: `Hito completado en "${g.title}": "${h.title}".` };
      }

      case "vincular_habito_meta": {
        const metaq = String(input.meta ?? "").trim();
        const habq = String(input.habito ?? "").trim();
        const [{ data: gs }, { data: hs }] = await Promise.all([
          supabase.from("goals").select("id, title").neq("status", "archived").ilike("title", `%${metaq}%`).limit(1),
          supabase.from("habits").select("id, name").eq("active", true).ilike("name", `%${habq}%`).limit(1),
        ]);
        const g = gs?.[0]; const h = hs?.[0];
        if (!g) return { ok: false, summary: `No encontré una meta que coincida con "${metaq}".` };
        if (!h) return { ok: false, summary: `No encontré un hábito que coincida con "${habq}".` };
        const { error } = await supabase.from("goal_habits").upsert({ goal_id: g.id, habit_id: h.id }, { onConflict: "goal_id,habit_id" });
        if (error) throw error;
        return { ok: true, summary: `Hábito "${h.name}" ahora sostiene la meta "${g.title}".` };
      }

      case "crear_evento": {
        const titulo = String(input.titulo ?? "").trim();
        const inicio = String(input.inicio ?? "");
        if (!titulo || !inicio) return { ok: false, summary: "Falta título o fecha de inicio." };
        const startDate = new Date(inicio);
        if (isNaN(startDate.getTime())) return { ok: false, summary: "Fecha de inicio inválida." };
        const fin = typeof input.fin === "string" && input.fin ? new Date(input.fin) : new Date(startDate.getTime() + 3600000);
        const descripcion = typeof input.descripcion === "string" ? input.descripcion : undefined;
        const ubicacion = typeof input.ubicacion === "string" ? input.ubicacion : undefined;
        const created = await createCalendarEvent(titulo, startDate, fin, descripcion, ubicacion);
        if (!created) return { ok: false, summary: "No pude crear el evento (calendario no configurado o error)." };
        return {
          ok: true,
          summary: `Evento creado: "${titulo}" · ${startDate.toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`,
        };
      }

      case "consultar_eventos":
        return { ok: true, summary: await listEvents(typeof input.dias === "number" ? input.dias : 7) };

      case "editar_evento": {
        const buscar = String(input.buscar ?? "").trim();
        if (!buscar) return { ok: false, summary: "Dime qué evento editar." };
        const found = await findEvent(buscar);
        if (found === "none") return { ok: false, summary: `No encontré un evento próximo que coincida con "${buscar}".` };
        if (found === "many") return { ok: false, summary: `Varios eventos coinciden con "${buscar}". Sé más específico.` };
        const body: Record<string, unknown> = {};
        if (typeof input.titulo === "string") body.summary = input.titulo;
        if (typeof input.descripcion === "string") body.description = input.descripcion;
        if (typeof input.ubicacion === "string") body.location = input.ubicacion;
        if (typeof input.inicio === "string" && input.inicio) body.start = { dateTime: new Date(input.inicio).toISOString(), timeZone: TZ };
        if (typeof input.fin === "string" && input.fin) body.end = { dateTime: new Date(input.fin).toISOString(), timeZone: TZ };
        if (Object.keys(body).length === 0) return { ok: false, summary: "No me diste ningún cambio que aplicar." };
        const ok = await patchEvent(found.id, body);
        if (!ok) return { ok: false, summary: "No pude editar el evento." };
        return { ok: true, summary: `Evento actualizado: "${typeof input.titulo === "string" && input.titulo ? input.titulo : found.title}".` };
      }

      case "eliminar_evento": {
        const buscar = String(input.buscar ?? "").trim();
        if (!buscar) return { ok: false, summary: "Dime qué evento eliminar." };
        const found = await findEvent(buscar);
        if (found === "none") return { ok: false, summary: `No encontré un evento próximo que coincida con "${buscar}".` };
        if (found === "many") return { ok: false, summary: `Varios eventos coinciden con "${buscar}". Sé más específico.` };
        const ok = await deleteEvent(found.id);
        if (!ok) return { ok: false, summary: "No pude eliminar el evento." };
        return { ok: true, summary: `Evento eliminado: "${found.title}".` };
      }

      case "crear_notificacion": {
        const titulo = String(input.titulo ?? "").trim();
        if (!titulo) return { ok: false, summary: "Falta el título de la notificación." };
        const sevRaw = String(input.severidad ?? "info");
        const severity = ["info", "warning", "error", "success"].includes(sevRaw) ? sevRaw : "info";
        const { error } = await supabase.from("notifications").insert({
          title: titulo,
          body: typeof input.cuerpo === "string" && input.cuerpo ? input.cuerpo : null,
          severity,
          module: typeof input.modulo === "string" && input.modulo ? input.modulo : null,
          href: typeof input.enlace === "string" && input.enlace ? input.enlace : null,
          read: false,
          dismissed: false,
        });
        if (error) throw error;
        return { ok: true, summary: `Notificación enviada: "${truncate(titulo)}"` };
      }

      default:
        return { ok: false, summary: `Herramienta desconocida: ${name}` };
    }
  } catch (e) {
    return { ok: false, summary: `Error ejecutando ${name}: ${(e as Error).message}` };
  }
}

const TZ = "America/Mexico_City";

function getCalendar() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.calendar({ version: "v3", auth: client });
}

function relTime(d: Date): string {
  const diff = d.getTime() - Date.now();
  if (diff < 0) return "en curso";
  const min = Math.round(diff / 60000);
  if (min < 60) return `en ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `en ${h}h`;
  return `en ${Math.round(h / 24)}d`;
}

async function createCalendarEvent(title: string, start: Date, end: Date, description?: string, location?: string): Promise<boolean> {
  try {
    const calendar = getCalendar();
    await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: title,
        description,
        location,
        start: { dateTime: start.toISOString(), timeZone: TZ },
        end: { dateTime: end.toISOString(), timeZone: TZ },
      },
    });
    return true;
  } catch (e) {
    console.error("createCalendarEvent error:", e);
    return false;
  }
}

async function listEvents(days: number): Promise<string> {
  try {
    const calendar = getCalendar();
    const now = new Date();
    const end = new Date(now.getTime() + Math.max(1, days) * 86400000);
    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 30,
    });
    const items = res.data.items ?? [];
    if (items.length === 0) return `Sin eventos en los próximos ${days} días.`;
    const lines = items.map((ev) => {
      const startIso = ev.start?.dateTime ?? ev.start?.date ?? null;
      const when = startIso ? new Date(startIso) : null;
      const t = when
        ? when.toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
        : "";
      const rel = when ? ` (${relTime(when)})` : "";
      const loc = ev.location ? ` · ${ev.location}` : "";
      return `- ${ev.summary ?? "Sin título"} · ${t}${rel}${loc}`;
    });
    return `Próximos eventos (${days}d):\n${lines.join("\n")}`;
  } catch (e) {
    return `No pude leer el calendario: ${(e as Error).message}`;
  }
}

type FoundEvent = { id: string; title: string } | "none" | "many";

async function findEvent(query: string): Promise<FoundEvent> {
  const calendar = getCalendar();
  const now = new Date();
  const end = new Date(now.getTime() + 60 * 86400000);
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: now.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 100,
  });
  const q = query.toLowerCase();
  const matches = (res.data.items ?? []).filter((ev) => (ev.summary ?? "").toLowerCase().includes(q) && ev.id);
  if (matches.length === 0) return "none";
  if (matches.length > 1) {
    const exact = matches.filter((ev) => (ev.summary ?? "").toLowerCase() === q);
    if (exact.length === 1) return { id: exact[0].id!, title: exact[0].summary ?? "" };
    return "many";
  }
  return { id: matches[0].id!, title: matches[0].summary ?? "" };
}

async function patchEvent(id: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const calendar = getCalendar();
    await calendar.events.patch({ calendarId: "primary", eventId: id, requestBody: body });
    return true;
  } catch (e) {
    console.error("patchEvent error:", e);
    return false;
  }
}

async function deleteEvent(id: string): Promise<boolean> {
  try {
    const calendar = getCalendar();
    await calendar.events.delete({ calendarId: "primary", eventId: id });
    return true;
  } catch (e) {
    console.error("deleteEvent error:", e);
    return false;
  }
}

async function buildStatus(supabase: DB, today: string): Promise<string> {
  const monthStart = today.slice(0, 7) + "-01";
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().split("T")[0];
  const [{ data: prios }, { data: habits }, { data: comps }, { data: entries }, { data: banks }, { data: gymWeek }, { data: lastGym }, { data: exams }, { data: cards }, { data: recurring }, { data: sleepWeek }, { data: lastWeight }, { data: activeGoals }, { data: nextMs }] = await Promise.all([
    supabase.from("priorities").select("text, completed").eq("date", today),
    supabase.from("habits").select("id, name").eq("active", true),
    supabase.from("habit_completions").select("habit_id").eq("date", today),
    supabase.from("financial_entries").select("category, amount").gte("date", monthStart),
    supabase.from("bank_accounts").select("current_balance, currency").eq("active", true),
    supabase.from("workout_sessions").select("id").gte("date", weekAgo).lte("date", today),
    supabase.from("workout_sessions").select("day_name, date").order("date", { ascending: false }).limit(1),
    supabase.from("grade_components").select("name, date, course_id").eq("kind", "examen").neq("status", "done").gte("date", today).order("date").limit(3),
    supabase.from("credit_cards").select("*").eq("active", true),
    supabase.from("recurring_charges").select("*").eq("active", true),
    supabase.from("health_entries").select("sleep_hours, energy").gte("date", weekAgo).lte("date", today),
    supabase.from("weight_logs").select("weight_kg, date").order("date", { ascending: false }).limit(1),
    supabase.from("goals").select("id, title, target_date").eq("status", "active"),
    supabase.from("goal_milestones").select("title, due_date").eq("done", false).not("due_date", "is", null).gte("due_date", today).order("due_date").limit(1),
  ]);

  const done = new Set((comps ?? []).map((c) => c.habit_id));
  const prioList = (prios ?? []).map((p) => `${p.completed ? "✓" : "○"} ${p.text}`).join("; ") || "ninguna";
  const habitsList = (habits ?? []).map((h) => `${done.has(h.id) ? "✓" : "○"} ${h.name}`).join(", ") || "ninguno";
  const balance = (banks ?? []).filter((b) => b.currency === "MXN").reduce((a, b) => a + b.current_balance, 0);
  const income = (entries ?? []).filter((e) => e.category === "flouvia_ingreso").reduce((a, e) => a + e.amount, 0);
  const expenses = (entries ?? [])
    .filter((e) => e.category === "gasto_personal" || e.category === "gasto_flouvia")
    .reduce((a, e) => a + e.amount, 0);

  const last = lastGym?.[0];
  const gymLine = `Gym: ${(gymWeek ?? []).length} sesiones esta semana${last ? `, última: ${last.day_name ?? "sesión"} (${last.date})` : ", sin sesiones aún"}.`;

  let calLine = "";
  try {
    const calendar = getCalendar();
    const nowD = new Date();
    const endD = new Date(nowD.getTime() + 2 * 86400000);
    const evRes = await calendar.events.list({
      calendarId: "primary", timeMin: nowD.toISOString(), timeMax: endD.toISOString(),
      singleEvents: true, orderBy: "startTime", maxResults: 6,
    });
    const evs = evRes.data.items ?? [];
    if (evs.length) {
      calLine =
        "\nAgenda (48h): " +
        evs
          .map((ev) => {
            const s = ev.start?.dateTime ?? ev.start?.date ?? null;
            const w = s ? new Date(s) : null;
            return `${ev.summary ?? "evento"}${w ? ` ${w.toLocaleString("es-MX", { weekday: "short", hour: "2-digit", minute: "2-digit" })} (${relTime(w)})` : ""}`;
          })
          .join("; ") +
        ".";
    }
  } catch {}

  const nextExam = (exams ?? [])[0];
  const examLine = nextExam
    ? `Próximo examen: ${nextExam.name} (${nextExam.date}). Usa consultar_academia para el detalle.`
    : "Sin exámenes próximos registrados.";

  const payments = buildUpcomingPayments(cards ?? [], recurring ?? []).filter((p) => p.daysUntil <= 10);
  const nextPay = payments[0];
  const payLine = nextPay
    ? `Próximo pago: ${nextPay.name}${nextPay.amount ? ` ${formatCurrency(nextPay.amount)}` : ""} en ${nextPay.daysUntil} día(s) (${nextPay.dueDate}).`
    : "Sin pagos próximos en los siguientes 10 días.";

  const sleepVals = (sleepWeek ?? []).map((e) => e.sleep_hours).filter((x): x is number => typeof x === "number");
  const avgSleep = sleepVals.length ? Math.round((sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length) * 10) / 10 : null;
  const lw = lastWeight?.[0];
  const healthLine = `Salud: ${avgSleep != null ? `sueño prom 7d ${avgSleep}h` : "sin sueño registrado"}${lw ? `, peso ${lw.weight_kg}kg (${lw.date})` : ""}.`;

  const nm = nextMs?.[0];
  const metasLine = (activeGoals ?? []).length
    ? `Metas: ${(activeGoals ?? []).length} activa(s)${nm ? `. Próximo hito: "${nm.title}" (${nm.due_date})` : ""}. Usa consultar_metas para el detalle.`
    : "Sin metas activas.";

  return `Estado de hoy (${today}):
Prioridades: ${prioList}
Hábitos (${done.size}/${(habits ?? []).length}): ${habitsList}
Finanzas del mes: saldo ${formatCurrency(balance)}, ingresos ${formatCurrency(income)}, gastos ${formatCurrency(expenses)}.
${payLine}
${gymLine}${calLine}
${examLine}
${healthLine}
${metasLine}`;
}

async function buildFinanceDetail(supabase: DB, today: string): Promise<string> {
  const monthStart = today.slice(0, 7) + "-01";
  const [{ data: banks }, { data: cards }, { data: investments }, { data: entries }, { data: recurring }] = await Promise.all([
    supabase.from("bank_accounts").select("*").eq("active", true).order("sort_order"),
    supabase.from("credit_cards").select("*").eq("active", true),
    supabase.from("investments").select("current_value").eq("active", true),
    supabase.from("financial_entries").select("category, amount, subcategory, description").gte("date", monthStart),
    supabase.from("recurring_charges").select("*").eq("active", true),
  ]);

  const totalBanks = (banks ?? []).reduce((a, b) => a + b.current_balance, 0);
  const totalCards = (cards ?? []).reduce((a, c) => a + c.current_balance, 0);
  const totalInvested = (investments ?? []).reduce((a, i) => a + i.current_value, 0);
  const netWorth = totalBanks + totalInvested - totalCards;
  const income = (entries ?? []).filter((e) => e.category === "flouvia_ingreso").reduce((a, e) => a + e.amount, 0);
  const expenses = (entries ?? []).filter((e) => e.category === "gasto_personal" || e.category === "gasto_flouvia").reduce((a, e) => a + e.amount, 0);

  const byBucket = new Map<string, number>();
  for (const e of entries ?? []) {
    if (e.category === "flouvia_ingreso") continue;
    const b = entryBucket(e.category, e.subcategory);
    byBucket.set(b, (byBucket.get(b) ?? 0) + e.amount);
  }
  const dist = [...byBucket.entries()].sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${bucketLabel(k)} ${formatCurrency(v)}`).join(", ") || "sin gastos aún";

  const accLine = (banks ?? []).map((b) => `${b.name} ${formatCurrency(b.current_balance)}`).join(", ") || "ninguna";

  const payments = buildUpcomingPayments(cards ?? [], recurring ?? []).slice(0, 6);
  const payLines = payments.length
    ? payments.map((p) => `- ${p.name}: ${p.amount ? formatCurrency(p.amount) : "monto s/d"} en ${p.daysUntil} día(s) (${p.dueDate})`).join("\n")
    : "- Sin pagos programados.";

  return `Finanzas (${today}):
Patrimonio neto: ${formatCurrency(netWorth)} (cuentas ${formatCurrency(totalBanks)}, inversiones ${formatCurrency(totalInvested)}, deuda tarjetas ${formatCurrency(totalCards)}).
Este mes: ingresos ${formatCurrency(income)}, gastos ${formatCurrency(expenses)}, balance ${formatCurrency(income - expenses)}.
Cuentas: ${accLine}.
Distribución del gasto este mes: ${dist}.
Próximos pagos:
${payLines}`;
}

async function findCourse(supabase: DB, name: string) {
  const n = name.trim();
  if (!n) return null;
  const { data } = await supabase
    .from("academic_courses").select("id, name, absences, max_absences, target_grade")
    .eq("active", true).ilike("name", `%${n}%`).limit(1);
  return data?.[0] ?? null;
}

// Recalcula la calificación ponderada de una materia y la persiste en academic_courses.grade
// (así el GPA y el ticker quedan consistentes en toda la app).
async function recomputeCourseGrade(supabase: DB, courseId: string): Promise<number | null> {
  const { data: comps } = await supabase
    .from("grade_components").select("weight, grade").eq("course_id", courseId);
  const g = computeCourseGrades(comps ?? []);
  const value = g.currentGrade !== null ? Math.round(g.currentGrade * 100) / 100 : null;
  await supabase.from("academic_courses").update({ grade: value }).eq("id", courseId);
  return value;
}

async function buildAcademia(supabase: DB, today: string): Promise<string> {
  const { data: courses } = await supabase
    .from("academic_courses").select("id, name, target_grade, absences, max_absences").eq("active", true).order("name");
  if (!courses || courses.length === 0) return "André no tiene materias activas en la Panamericana.";

  const { data: comps } = await supabase
    .from("grade_components").select("course_id, name, kind, weight, grade, date, difficulty, study_start_date, status");
  const byCourse = new Map<string, typeof comps>();
  for (const c of comps ?? []) {
    if (!byCourse.has(c.course_id)) byCourse.set(c.course_id, []);
    byCourse.get(c.course_id)!.push(c);
  }

  const lines: string[] = [];
  const examLines: string[] = [];
  for (const course of courses) {
    const cc = byCourse.get(course.id) ?? [];
    const g = computeCourseGrades(cc);
    const need = neededForTarget(g, course.target_grade);
    const parts: string[] = [];
    if (g.currentGrade !== null) parts.push(`actual ${g.currentGrade.toFixed(2)}`);
    if (g.projectedFinal !== null) parts.push(`proyectada ${g.projectedFinal.toFixed(2)}`);
    parts.push(`meta ${course.target_grade}`);
    if (need !== null && g.currentGrade !== null) {
      parts.push(need > 10 ? `necesita >10 en lo que falta (en riesgo)` : need <= 0 ? `meta asegurada` : `necesita ${need.toFixed(1)} en el ${g.remainingWeight}% restante`);
    }
    if (course.max_absences) parts.push(`faltas ${course.absences}/${course.max_absences}${course.absences >= course.max_absences ? " ⚠ límite" : ""}`);
    else if (course.absences) parts.push(`faltas ${course.absences}`);
    lines.push(`- ${course.name}: ${parts.join(", ")}.`);

    for (const c of cc) {
      if (c.kind === "examen" && c.status !== "done" && c.date) {
        const d = daysUntil(c.date, new Date(today + "T00:00:00"));
        if (d !== null && d >= 0 && d <= 30) {
          const diff = c.difficulty ? ` · ${DIFFICULTY_LABELS[c.difficulty]}` : "";
          const study = c.study_start_date ? ` · estudiar desde ${c.study_start_date}` : "";
          examLines.push(`- ${course.name} — ${c.name} en ${d} día(s)${diff}${study}.`);
        }
      }
    }
  }

  return `Estado académico (${today}):
Materias:
${lines.join("\n")}${examLines.length ? `\nExámenes próximos (≤30d):\n${examLines.join("\n")}` : "\nSin exámenes próximos registrados."}`;
}

async function buildRoutine(supabase: DB): Promise<string> {
  const { data: routines } = await supabase.from("workout_routines").select("id, name, active").order("sort_order");
  const routine = (routines ?? []).find((r) => r.active) ?? (routines ?? [])[0] ?? null;
  if (!routine) return "André no tiene una rutina de gym configurada todavía.";

  const { data: days } = await supabase
    .from("workout_days").select("id, name, day_order").eq("routine_id", routine.id).order("day_order");
  const dlist = days ?? [];

  const { data: lastSess } = await supabase
    .from("workout_sessions").select("day_id, date").not("day_id", "is", null).order("date", { ascending: false }).limit(1);

  let suggested = dlist[0] ?? null;
  if (lastSess?.[0]?.day_id && dlist.length) {
    const idx = dlist.findIndex((d) => d.id === lastSess[0].day_id);
    if (idx >= 0) suggested = dlist[(idx + 1) % dlist.length];
  }

  let exLine = "";
  if (suggested) {
    const { data: exs } = await supabase
      .from("workout_exercises").select("name, target_sets, target_reps").eq("day_id", suggested.id).order("sort_order");
    exLine = (exs ?? []).map((e) => `${e.name} ${e.target_sets}×${e.target_reps ?? "—"}`).join(", ") || "sin ejercicios";
  }

  const daysStr = dlist.map((d) => d.name).join(" → ") || "sin días";
  return `Rutina activa: ${routine.name} (${daysStr}). Hoy sugerido: ${suggested?.name ?? "—"}${suggested ? ` — ${exLine}` : ""}.`;
}

async function buildHealthDetail(supabase: DB, today: string): Promise<string> {
  const since30 = new Date(Date.now() - 29 * 86400000).toISOString().split("T")[0];
  const since180 = new Date(Date.now() - 179 * 86400000).toISOString().split("T")[0];
  const [{ data: entriesRaw }, { data: weightsRaw }] = await Promise.all([
    supabase.from("health_entries").select("*").gte("date", since30).order("date", { ascending: false }),
    supabase.from("weight_logs").select("*").gte("date", since180).order("date", { ascending: true }),
  ]);
  const entries = (entriesRaw ?? []) as HealthEntry[];
  const weights = (weightsRaw ?? []) as WeightLog[];
  if (entries.length === 0 && weights.length === 0) {
    return `Salud (${today}): aún no hay registros de salud ni de peso.`;
  }
  const last7 = entries.slice(0, 7);
  const w = weightStats(weights);
  const avgSleep = avg(last7.map((e) => e.sleep_hours));
  const avgMood = avg(last7.map((e) => e.mood));
  const avgEnergy = avg(last7.map((e) => e.energy));
  const avgSteps = avg(last7.map((e) => e.steps));
  const debt = sleepDebt(last7);
  const sleepCmp = compareWindows(entries, "sleep_hours");
  const corrSleepMood = correlate(entries, "sleep_hours", "mood");
  const corrSleepEnergy = correlate(entries, "sleep_hours", "energy");
  const d = (x: number | null, u = "") => (x == null ? "" : ` (${x > 0 ? "+" : ""}${x}${u} vs 7d previos)`);

  const weightLine = w
    ? `Peso actual ${w.current}kg (${w.currentDate})${w.count > 1 ? `, ${w.delta > 0 ? "+" : ""}${w.delta}kg en el período` : ""}${w.bodyFat ? `, ${w.bodyFat}% grasa` : ""}.`
    : "Sin registros de peso.";

  return `Salud (${today}):
${weightLine}
Sueño 7d: ${avgSleep ?? "s/d"}h${d(sleepCmp.delta, "h")}, deuda ${debt > 0 ? `−${debt}h` : debt < 0 ? `+${Math.abs(debt)}h` : "0"} vs objetivo 7.5h.
Ánimo 7d: ${avgMood ?? "s/d"}/5. Energía 7d: ${avgEnergy ?? "s/d"}/5. Pasos 7d: ${avgSteps ? Math.round(avgSteps) : "s/d"}.
Patrones: sueño↔ánimo ${corrLabel(corrSleepMood)}; sueño↔energía ${corrLabel(corrSleepEnergy)}.`;
}

async function buildMetas(supabase: DB, today: string): Promise<string> {
  const start30 = new Date(Date.now() - 29 * 86400000).toISOString().split("T")[0];
  const [{ data: goals }, { data: milestones }, { data: links }, { data: habits }, { data: comps }] = await Promise.all([
    supabase.from("goals").select("*").eq("status", "active").order("pinned", { ascending: false }).order("sort_order"),
    supabase.from("goal_milestones").select("*").order("sort_order"),
    supabase.from("goal_habits").select("*"),
    supabase.from("habits").select("id, name").eq("active", true),
    supabase.from("habit_completions").select("habit_id, date").gte("date", start30).lte("date", today),
  ]);

  const gs = (goals ?? []) as Goal[];
  if (gs.length === 0) return "André no tiene metas activas.";

  const msByGoal: Record<string, GoalMilestone[]> = {};
  for (const m of (milestones ?? []) as GoalMilestone[]) (msByGoal[m.goal_id] ??= []).push(m);

  const habitName: Record<string, string> = {};
  for (const h of habits ?? []) habitName[h.id] = h.name;
  const compCount: Record<string, number> = {};
  for (const c of comps ?? []) compCount[c.habit_id] = (compCount[c.habit_id] ?? 0) + 1;
  const linksByGoal: Record<string, string[]> = {};
  for (const l of links ?? []) (linksByGoal[l.goal_id] ??= []).push(l.habit_id);

  const lines = gs.map((g) => {
    const ms = msByGoal[g.id] ?? [];
    const pct = goalPct(g, ms);
    const pace = goalPace(g, pct, today);
    const paceTag = pace.status === "none" ? "sin fecha" : pace.label.toLowerCase();
    const parts = [`${g.title}: ${pct}% (${paceTag})`];
    if (g.target_date) parts.push(`objetivo ${g.target_date}`);

    const pending = ms.filter((m) => !m.done);
    if (ms.length) {
      const next = pending.filter((m) => m.due_date).sort((a, b) => a.due_date!.localeCompare(b.due_date!))[0] ?? pending[0];
      const nextTag = next ? `, próximo: "${next.title}"${next.due_date ? ` (${next.due_date}, ${milestoneState(next, today)})` : ""}` : "";
      parts.push(`hitos ${ms.filter((m) => m.done).length}/${ms.length}${nextTag}`);
    }

    const linked = (linksByGoal[g.id] ?? []).map((id) => `${habitName[id] ?? "?"} ${Math.round(((compCount[id] ?? 0) / 30) * 100)}%`);
    if (linked.length) parts.push(`motor: ${linked.join(", ")}`);
    else parts.push("sin hábitos vinculados");

    return `- ${parts.join(" · ")}`;
  });

  return `Metas activas (${today}):\n${lines.join("\n")}`;
}
