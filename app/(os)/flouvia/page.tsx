import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { Plus, Users, FileText, Calendar, AlertCircle } from "lucide-react";
import type { FlouviaClient, FlouviaProject, FlouviaInvoice } from "@/lib/supabase/types";

export const revalidate = 0;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  propuesta: { label: "Propuesta", color: "var(--blue)", bg: "rgba(91,141,184,0.15)" },
  activo: { label: "Activo", color: "var(--green)", bg: "rgba(127,169,140,0.15)" },
  pausado: { label: "Pausado", color: "var(--mute)", bg: "var(--glass-bg)" },
  completado: { label: "Completado", color: "var(--gold)", bg: "var(--gold-glow)" },
};

const PROJECT_STATUS: Record<string, { label: string; color: string }> = {
  planning: { label: "Planeación", color: "var(--mute)" },
  in_progress: { label: "En progreso", color: "var(--blue)" },
  review: { label: "Revisión", color: "var(--gold)" },
  delivered: { label: "Entregado", color: "var(--green)" },
  archived: { label: "Archivado", color: "var(--mute-2)" },
};

export default async function FlouviaPage() {
  const supabase = await createClient();

  const [
    { data: clients },
    { data: projects },
    { data: invoices },
    { data: followups },
  ] = await Promise.all([
    supabase.from("flouvia_clients").select("*").order("sort_order").order("created_at"),
    supabase.from("flouvia_projects").select("*, flouvia_clients(name)").neq("status", "archived").order("created_at", { ascending: false }),
    supabase.from("flouvia_invoices").select("*").neq("status", "cancelled").order("issued_date", { ascending: false }),
    supabase.from("flouvia_followups").select("*, flouvia_clients(name)").eq("done", false).order("due_date").limit(5),
  ]);

  const totalPipeline = (clients ?? [])
    .filter((c) => c.status === "propuesta" || c.status === "activo")
    .reduce((a, c) => a + (c.project_value ?? 0), 0);

  const totalInvoiced = (invoices ?? [])
    .filter((i) => i.status === "paid")
    .reduce((a, i) => a + i.total, 0);

  const pendingInvoices = (invoices ?? []).filter((i) => i.status === "sent" || i.status === "overdue");
  const pendingAmount = pendingInvoices.reduce((a, i) => a + i.total, 0);

  const activeClients = (clients ?? []).filter((c) => c.status === "activo").length;
  const proposalClients = (clients ?? []).filter((c) => c.status === "propuesta").length;

  return (
    <div>
      <div className="page-header">
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow mb-2">SaaS · CRM</p>
            <h1 className="page-title">Flouvia</h1>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm"><Plus size={13} /> Cliente</button>
            <button className="btn btn-primary btn-sm"><Plus size={13} /> Proyecto</button>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 mb-8 md:grid-cols-4">
          {[
            { label: "Pipeline activo", val: totalPipeline > 0 ? formatCurrency(totalPipeline) : "—", color: "var(--bone)" },
            { label: "Clientes activos", val: String(activeClients), color: "var(--green)" },
            { label: "En propuesta", val: String(proposalClients), color: "var(--blue)" },
            { label: "Por cobrar", val: pendingAmount > 0 ? formatCurrency(pendingAmount) : "—", color: pendingAmount > 0 ? "var(--gold)" : "var(--mute)" },
          ].map((k) => (
            <div key={k.label} className="card">
              <p className="metric-label mb-1">{k.label}</p>
              <p style={{ fontFamily: "var(--f-mono)", fontSize: 22, color: k.color }}>{k.val}</p>
            </div>
          ))}
        </div>

        {/* Follow-ups pendientes */}
        {(followups ?? []).length > 0 && (
          <div className="card mb-6" style={{ borderColor: "var(--gold)" }}>
            <p className="eyebrow-gold mb-3">Follow-ups pendientes</p>
            <div className="flex flex-col gap-2">
              {(followups ?? []).map((f) => {
                const client = f.flouvia_clients as unknown as { name: string } | null;
                const isOverdue = f.due_date && f.due_date < new Date().toISOString().split("T")[0];
                return (
                  <div key={f.id} className="flex items-center gap-3">
                    {isOverdue
                      ? <AlertCircle size={14} style={{ color: "var(--red)", flexShrink: 0 }} />
                      : <Calendar size={14} style={{ color: "var(--mute)", flexShrink: 0 }} />}
                    <div className="flex-1">
                      <span style={{ fontSize: 13, color: "var(--bone-dim)" }}>{f.title}</span>
                      {client && <span className="tick ml-2">· {client.name}</span>}
                    </div>
                    {f.due_date && (
                      <span className="tick" style={{ color: isOverdue ? "var(--red)" : "var(--mute)" }}>
                        {f.due_date}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Clients kanban */}
        {(clients ?? []).length === 0 ? (
          <div className="card text-center py-12">
            <p style={{ color: "var(--mute)", fontSize: 15 }}>Sin clientes registrados.</p>
            <button className="btn btn-primary btn-sm mt-4"><Plus size={13} /> Agregar primer cliente</button>
          </div>
        ) : (
          <>
            <p className="eyebrow mb-4">Pipeline de clientes</p>
            <div className="kanban mb-8">
              {["propuesta", "activo", "pausado", "completado"].map((stage) => {
                const stageClients = (clients ?? []).filter((c) => c.status === stage);
                const cfg = STATUS_CONFIG[stage];
                return (
                  <div key={stage} className="kanban-col">
                    <div className="kanban-col-header">
                      <div className="flex items-center gap-2">
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color }} />
                        <span style={{ fontFamily: "var(--f-mono)", fontSize: 11, color: cfg.color }}>
                          {cfg.label} ({stageClients.length})
                        </span>
                      </div>
                      {stageClients.length > 0 && (
                        <span className="tick">
                          {formatCurrency(stageClients.reduce((a, c) => a + (c.project_value ?? 0), 0))}
                        </span>
                      )}
                    </div>

                    {stageClients.map((c) => (
                      <div key={c.id} className="kanban-card">
                        <p style={{ fontWeight: 500, color: "var(--bone)", fontSize: 14, marginBottom: 4 }}>{c.name}</p>
                        {c.project_value && (
                          <p style={{ fontFamily: "var(--f-mono)", fontSize: 15, color: cfg.color, marginBottom: 6 }}>
                            {formatCurrency(c.project_value)}
                          </p>
                        )}
                        {c.description && (
                          <p className="tick" style={{ fontSize: 11, lineHeight: 1.4 }}>{c.description}</p>
                        )}
                      </div>
                    ))}

                    <button className="btn btn-ghost btn-sm w-full mt-2" style={{ width: "100%", justifyContent: "center" }}>
                      <Plus size={12} /> Agregar
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Active projects */}
        {(projects ?? []).length > 0 && (
          <div>
            <p className="eyebrow mb-4">Proyectos activos</p>
            <div className="flex flex-col gap-3">
              {(projects ?? []).map((p) => {
                const client = p.flouvia_clients as unknown as { name: string } | null;
                const status = PROJECT_STATUS[p.status] ?? { label: p.status, color: "var(--mute)" };
                return (
                  <div key={p.id} className="card">
                    <div className="flex items-start gap-4">
                      <div style={{ flex: 1 }}>
                        <div className="flex items-center gap-2 mb-1">
                          <p style={{ fontWeight: 500, color: "var(--bone)", fontSize: 14 }}>{p.name}</p>
                          {client && <span className="tick">· {client.name}</span>}
                          <span
                            className="tag ml-auto"
                            style={{ borderColor: status.color, color: status.color, background: `${status.color}15`, fontSize: 10 }}
                          >
                            {status.label}
                          </span>
                        </div>
                        {p.description && (
                          <p style={{ color: "var(--mute)", fontSize: 12, marginBottom: 8 }}>{p.description}</p>
                        )}
                        <div className="flex gap-4">
                          {p.total_value && (
                            <span className="tick">💰 {formatCurrency(p.total_value)}</span>
                          )}
                          {p.deadline && (
                            <span className="tick">📅 {p.deadline}</span>
                          )}
                          {p.estimated_hours && (
                            <span className="tick">⏱ {p.actual_hours}/{p.estimated_hours}h</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
