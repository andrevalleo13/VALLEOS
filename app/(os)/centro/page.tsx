import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Calendar, CheckSquare, DollarSign, Brain, Target, Briefcase, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export const revalidate = 0;

export default async function CentroPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const [
    { data: habits },
    { data: completions },
    { data: banks },
    { data: notes },
    { data: goals },
    { data: flouviaClients },
  ] = await Promise.all([
    supabase.from("habits").select("id").eq("active", true),
    supabase.from("habit_completions").select("habit_id").eq("date", today),
    supabase.from("bank_accounts").select("current_balance").eq("active", true),
    supabase.from("brain_notes").select("id"),
    supabase.from("goals").select("id").eq("status", "active"),
    supabase.from("flouvia_clients").select("monthly_value").eq("status", "activo"),
  ]);

  const totalHabits = habits?.length ?? 0;
  const doneHabits = completions?.length ?? 0;
  const totalBanks = (banks ?? []).reduce((a, b) => a + (b.current_balance ?? 0), 0);
  const activeGoals = goals?.length ?? 0;
  const flouviaMRR = (flouviaClients ?? []).reduce((a, c) => a + (c.monthly_value ?? 0), 0);

  const dateLabel = new Date().toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long",
  });

  const WIDGETS = [
    {
      href: "/calendario",
      label: "Calendario",
      icon: Calendar,
      color: "var(--gold)",
      stat: "Ver hoy",
    },
    {
      href: "/habitos",
      label: "Hábitos",
      icon: CheckSquare,
      color: "var(--green)",
      stat: totalHabits > 0 ? `${doneHabits} / ${totalHabits} completados` : "Sin hábitos",
    },
    {
      href: "/finanzas",
      label: "Finanzas",
      icon: DollarSign,
      color: "var(--mute)",
      stat: totalBanks > 0 ? `${formatCurrency(totalBanks)} disponible` : "Ver cuentas",
    },
    {
      href: "/brain",
      label: "Brain",
      icon: Brain,
      color: "var(--violet)",
      stat: `${notes?.length ?? 0} notas`,
    },
    {
      href: "/metas",
      label: "Metas",
      icon: Target,
      color: "var(--red)",
      stat: activeGoals > 0 ? `${activeGoals} activas` : "Sin metas",
    },
    {
      href: "/flouvia",
      label: "Flouvia",
      icon: Briefcase,
      color: "var(--blue)",
      stat: flouviaMRR > 0 ? `${formatCurrency(flouviaMRR)}/mo MRR` : "Ver clientes",
    },
  ];

  return (
    <div className="page-body">
      <div className="mb-8">
        <p className="eyebrow mb-2">Cockpit</p>
        <h1 className="serif" style={{ fontSize: 36, color: "var(--bone)" }}>Centro de control</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {WIDGETS.map((w) => (
          <Link key={w.href} href={w.href} className="card hover:no-underline group">
            <div className="flex items-center justify-between mb-3">
              <w.icon size={18} style={{ color: w.color }} />
              <ArrowRight size={13} style={{ color: "var(--mute-2)" }} className="group-hover:translate-x-1 transition-transform" />
            </div>
            <p style={{ fontFamily: "var(--f-serif)", fontSize: 20, color: "var(--bone)" }}>{w.label}</p>
            <p className="tick mt-1">{w.stat}</p>
          </Link>
        ))}
      </div>

      {/* Ticker bar */}
      <div className="ticker mt-8 rounded-xl">
        {[
          { label: "HOY", val: new Date().toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" }) },
          { label: "SHADOW", val: "En línea", cls: "positive" },
          { label: "SUPABASE", val: "Conectado", cls: "positive" },
        ].map((t) => (
          <div key={t.label} className="ticker-item">
            <span className="ticker-label">{t.label}</span>
            <span className={`ticker-value ${t.cls ?? ""}`}>{t.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
