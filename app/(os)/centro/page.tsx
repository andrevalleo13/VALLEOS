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
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <p className="eyebrow mb-2">01 · COCKPIT</p>
            <h1 className="page-title">Centro.</h1>
          </div>
          <p className="tick" style={{ marginTop: 6, textTransform: "capitalize" }}>
            {dateLabel}
          </p>
        </div>
      </div>

      <div className="page-body">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {WIDGETS.map((w) => (
            <Link key={w.href} href={w.href} className="card hover:no-underline group" style={{ textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <w.icon size={16} style={{ color: w.color }} />
                <ArrowRight size={12} style={{ color: "var(--mute-2)" }} />
              </div>
              <p style={{ fontFamily: "var(--f-serif)", fontSize: 19, color: "var(--bone)", lineHeight: 1.2 }}>{w.label}</p>
              <p className="tick mt-2">{w.stat}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
