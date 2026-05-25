import type { FinancialCategory } from "@/lib/supabase/types";

export type Bucket =
  | "ingreso"
  | "escuela"
  | "comida"
  | "salidas"
  | "transporte"
  | "suscripciones"
  | "salud"
  | "hogar"
  | "compras"
  | "servicios"
  | "ahorro"
  | "inversion"
  | "flouvia"
  | "otros";

type BucketDef = { key: Bucket; label: string; color: string; icon: string };

export const BUCKETS: BucketDef[] = [
  { key: "ingreso", label: "Ingreso", color: "#5FB97A", icon: "TrendingUp" },
  { key: "escuela", label: "Escuela", color: "#6BA8E5", icon: "GraduationCap" },
  { key: "comida", label: "Comida", color: "#E5A86B", icon: "UtensilsCrossed" },
  { key: "salidas", label: "Salidas", color: "#C77DE5", icon: "Wine" },
  { key: "transporte", label: "Transporte", color: "#6BD0E5", icon: "Car" },
  { key: "suscripciones", label: "Suscripciones", color: "#E5C76B", icon: "Repeat" },
  { key: "salud", label: "Salud", color: "#E56B8A", icon: "HeartPulse" },
  { key: "hogar", label: "Hogar", color: "#8AE56B", icon: "Home" },
  { key: "compras", label: "Compras", color: "#E5786B", icon: "ShoppingBag" },
  { key: "servicios", label: "Servicios", color: "#B0B0C0", icon: "Wifi" },
  { key: "ahorro", label: "Ahorro", color: "#C9A35F", icon: "PiggyBank" },
  { key: "inversion", label: "Inversión", color: "#9B7DE5", icon: "LineChart" },
  { key: "flouvia", label: "Flouvia", color: "#6B8AE5", icon: "Briefcase" },
  { key: "otros", label: "Otros", color: "#8A8A9A", icon: "MoreHorizontal" },
];

const BY_KEY = new Map(BUCKETS.map((b) => [b.key, b]));

export const SPENDING_BUCKETS: Bucket[] = [
  "escuela", "comida", "salidas", "transporte", "suscripciones",
  "salud", "hogar", "compras", "servicios", "ahorro", "inversion", "otros",
];

const SYNONYMS: Record<string, Bucket> = {
  ingreso: "ingreso", income: "ingreso", sueldo: "ingreso", pago: "ingreso", nomina: "ingreso", nómina: "ingreso", deposito: "ingreso", depósito: "ingreso",
  escuela: "escuela", colegiatura: "escuela", universidad: "escuela", uni: "escuela", panamericana: "escuela", libros: "escuela", materiales: "escuela", curso: "escuela", educacion: "escuela", educación: "escuela",
  comida: "comida", comidas: "comida", restaurante: "comida", restaurantes: "comida", super: "comida", supermercado: "comida", despensa: "comida", cafe: "comida", café: "comida", food: "comida", almuerzo: "comida", desayuno: "comida", cena: "comida", lunch: "comida", uber_eats: "comida", rappi: "comida", didi_food: "comida",
  salidas: "salidas", salida: "salidas", fiesta: "salidas", bar: "salidas", antro: "salidas", cine: "salidas", entretenimiento: "salidas", diversion: "salidas", diversión: "salidas", alcohol: "salidas", cervezas: "salidas", drinks: "salidas",
  transporte: "transporte", uber: "transporte", didi: "transporte", taxi: "transporte", gasolina: "transporte", gas: "transporte", metro: "transporte", camion: "transporte", camión: "transporte", estacionamiento: "transporte", parking: "transporte", caseta: "transporte", auto: "transporte", coche: "transporte",
  suscripciones: "suscripciones", suscripcion: "suscripciones", suscripción: "suscripciones", netflix: "suscripciones", spotify: "suscripciones", hbo: "suscripciones", disney: "suscripciones", youtube: "suscripciones", icloud: "suscripciones", chatgpt: "suscripciones", claude: "suscripciones", figma: "suscripciones", adobe: "suscripciones", software: "suscripciones", membresia: "suscripciones", membresía: "suscripciones",
  salud: "salud", doctor: "salud", medico: "salud", médico: "salud", farmacia: "salud", medicina: "salud", dentista: "salud", gym: "salud", gimnasio: "salud", suplementos: "salud", proteina: "salud", proteína: "salud", terapia: "salud", seguro_medico: "salud",
  hogar: "hogar", renta: "hogar", casa: "hogar", departamento: "hogar", depa: "hogar", muebles: "hogar", limpieza: "hogar", mantenimiento: "hogar",
  compras: "compras", ropa: "compras", zapatos: "compras", tenis: "compras", amazon: "compras", mercadolibre: "compras", electronicos: "compras", electrónicos: "compras", gadget: "compras", tecnologia: "compras", tecnología: "compras", regalo: "compras", regalos: "compras",
  servicios: "servicios", luz: "servicios", agua: "servicios", internet: "servicios", telefono: "servicios", teléfono: "servicios", celular: "servicios", cfe: "servicios", recibo: "servicios", servicio: "servicios", telcel: "servicios",
  ahorro: "ahorro", ahorros: "ahorro", guardar: "ahorro", reserva: "ahorro",
  inversion: "inversion", inversión: "inversion", inversiones: "inversion", acciones: "inversion", cripto: "inversion", crypto: "inversion", bitcoin: "inversion", cetes: "inversion", gbm: "inversion", etf: "inversion",
  flouvia: "flouvia", cliente: "flouvia", clientes: "flouvia", proyecto: "flouvia",
  otros: "otros", otro: "otros", varios: "otros", misc: "otros",
};

const clean = (s: string) =>
  s.toLowerCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function normalizeBucket(input?: string | null): Bucket | null {
  if (!input) return null;
  const c = clean(input);
  if (BY_KEY.has(c as Bucket)) return c as Bucket;
  if (SYNONYMS[input.toLowerCase().trim()]) return SYNONYMS[input.toLowerCase().trim()];
  for (const [syn, bucket] of Object.entries(SYNONYMS)) {
    if (clean(syn) === c) return bucket;
  }
  for (const [syn, bucket] of Object.entries(SYNONYMS)) {
    const cs = clean(syn);
    if (cs.length > 2 && (c.includes(cs) || cs.includes(c))) return bucket;
  }
  return null;
}

export function bucketLabel(key: string | null | undefined): string {
  if (!key) return "Otros";
  return BY_KEY.get(key as Bucket)?.label ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export function bucketColor(key: string | null | undefined): string {
  return BY_KEY.get((key ?? "otros") as Bucket)?.color ?? "#8A8A9A";
}

export function bucketIcon(key: string | null | undefined): string {
  return BY_KEY.get((key ?? "otros") as Bucket)?.icon ?? "MoreHorizontal";
}

export function isIncome(category: FinancialCategory): boolean {
  return category === "flouvia_ingreso";
}

/** Derives the spending/allocation bucket for an entry, unifying category + subcategory. */
export function entryBucket(category: FinancialCategory, subcategory?: string | null): Bucket {
  if (category === "flouvia_ingreso") return "ingreso";
  if (category === "ahorro") return "ahorro";
  if (category === "inversion") return "inversion";
  if (category === "gasto_flouvia") return "flouvia";
  const norm = normalizeBucket(subcategory);
  return norm ?? "otros";
}
