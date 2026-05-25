"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, AlertCircle, Calendar, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";
import { AddClient } from "./AddClient";
import { Analysis } from "./Analysis";
import { formatCurrency } from "@/lib/utils";
import type { FlouviaClient, FlouviaProject, FlouviaInvoice, FlouviaFollowup, ClientStatus } from "@/lib/supabase/types";

type ProjectWithClient = FlouviaProject & { flouvia_clients: { name: string } | null };
type FollowupWithClient = FlouviaFollowup & { flouvia_clients: { name: string } | null };

const STATUS_CONFIG: Record<ClientStatus, { label: string; color: string }> = {
  propuesta: { label: "Propuesta", color: "var(--blue)" },
  activo:    { label: "Activo",    color: "var(--green)" },
  pausado:   { label: "Pausado",   color: "var(--mute)" },
  completado:{ label: "Completado",color: "var(--gold)" },
};

const STATUSES: ClientStatus[] = ["propuesta", "activo", "pausado", "completado"];

const PROJECT_STATUS: Record<string, { label: string; color: string }> = {
  scoping:     { label: "Scoping",     color: "var(--mute)" },
  in_progress: { label: "En progreso", color: "var(--blue)" },
  review:      { label: "Revisión",    color: "var(--gold)" },
  delivered:   { label: "Entregado",   color: "var(--green)" },
  cancelled:   { label: "Cancelado",   color: "var(--red)" },
};

type Props = {
  clients: FlouviaClient[];
  projects: ProjectWithClient[];
  followups: FollowupWithClient[];
  invoices: FlouviaInvoice[];
  analysis: { content: string | null; generated_at: string | null };
};

function buildChart(invoices: FlouviaInvoice[]) {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("es-MX", { month: "short" });
    let paid = 0, pending = 0;
    for (const inv of invoices) {
      const dateKey = inv.status === "paid" && inv.paid_date
        ? inv.paid_date.slice(0, 7)
        : inv.issued_date?.slice(0, 7);
      if (dateKey !== key) continue;
      if (inv.status === "paid") paid += inv.total;
      else if (inv.status === "sent" || inv.status === "overdue") pending += inv.total;
    }
    return { key, label, paid, pending };
  });
}

export function FlouviaClient({ clients, projects, followups, invoices, analysis }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [editingClient, setEditingClient] = useState<FlouviaClient | null>(null);
  const [editingProject, setEditingProject] = useState<ProjectWithClient | null>(null);
  const [addingProject, setAddingProject] = useState(false);
  const [saving, setSaving] = useState(false);

  // Client edit fields
  const [eName, setEName] = useState("");
  const [eStatus, setEStatus] = useState<ClientStatus>("propuesta");
  const [eProjectValue, setEProjectValue] = useState("");
  const [eMonthlyValue, setEMonthlyValue] = useState("");
  const [eDescription, setEDescription] = useState("");
  const [eNotes, setENotes] = useState("");

  // Project edit fields
  const [ePName, setEPName] = useState("");
  const [ePClientId, setEPClientId] = useState("");
  const [ePStatus, setEPStatus] = useState("scoping");
  const [ePValue, setEPValue] = useState("");
  const [ePHours, setEPHours] = useState("");
  const [ePDeadline, setEPDeadline] = useState("");
  const [ePDescription, setEPDescription] = useState("");

  function openEditClient(c: FlouviaClient) {
    setEditingClient(c);
    setEName(c.name);
    setEStatus(c.status as ClientStatus);
    setEProjectValue(c.project_value != null ? String(c.project_value) : "");
    setEMonthlyValue(c.monthly_value != null ? String(c.monthly_value) : "");
    setEDescription(c.description ?? "");
    setENotes(c.notes ?? "");
  }

  async function saveClient() {
    if (!editingClient || !eName.trim()) return;
    setSaving(true);
    await supabase.from("flouvia_clients").update({
      name: eName.trim(),
      status: eStatus,
      project_value: eProjectValue ? parseFloat(eProjectValue) : null,
      monthly_value: eMonthlyValue ? parseFloat(eMonthlyValue) : null,
      description: eDescription.trim() || null,
      notes: eNotes.trim() || null,
    }).eq("id", editingClient.id);
    setSaving(false);
    setEditingClient(null);
    router.refresh();
  }

  async function deleteClient() {
    if (!editingClient) return;
    if (!confirm(`¿Eliminar a "${editingClient.name}"?`)) return;
    await supabase.from("flouvia_clients").delete().eq("id", editingClient.id);
    setEditingClient(null);
    router.refresh();
  }

  function openEditProject(p: ProjectWithClient) {
    setAddingProject(false);
    setEditingProject(p);
    setEPName(p.name);
    setEPClientId(p.client_id);
    setEPStatus(p.status);
    setEPValue(p.total_value != null ? String(p.total_value) : "");
    setEPHours(p.estimated_hours != null ? String(p.estimated_hours) : "");
    setEPDeadline(p.deadline ?? "");
    setEPDescription(p.description ?? "");
  }

  function openAddProject() {
    setEditingProject(null);
    setAddingProject(true);
    setEPName("");
    setEPClientId(clients[0]?.id ?? "");
    setEPStatus("scoping");
    setEPValue("");
    setEPHours("");
    setEPDeadline("");
    setEPDescription("");
  }

  async function saveProject() {
    if (!ePName.trim()) return;
    setSaving(true);
    if (editingProject) {
      await supabase.from("flouvia_projects").update({
        client_id: ePClientId,
        name: ePName.trim(),
        status: ePStatus as FlouviaProject["status"],
        description: ePDescription.trim() || null,
        total_value: ePValue ? parseFloat(ePValue) : null,
        estimated_hours: ePHours ? parseFloat(ePHours) : null,
        deadline: ePDeadline || null,
      }).eq("id", editingProject.id);
      setEditingProject(null);
    } else {
      await supabase.from("flouvia_projects").insert({
        client_id: ePClientId,
        name: ePName.trim(),
        status: ePStatus as FlouviaProject["status"],
        description: ePDescription.trim() || null,
        total_value: ePValue ? parseFloat(ePValue) : null,
        estimated_hours: ePHours ? parseFloat(ePHours) : null,
        deadline: ePDeadline || null,
        actual_hours: 0,
      });
      setAddingProject(false);
    }
    setSaving(false);
    router.refresh();
  }

  async function deleteProject() {
    if (!editingProject) return;
    if (!confirm(`¿Eliminar proyecto "${editingProject.name}"?`)) return;
    await supabase.from("flouvia_projects").delete().eq("id", editingProject.id);
    setEditingProject(null);
    router.refresh();
  }

  async function doneFollowup(id: string) {
    await supabase.from("flouvia_followups").update({ done: true, done_at: new Date().toISOString() }).eq("id", id);
    router.refresh();
  }

  // Computed KPIs
  const pipeline = clients.filter((c) => c.status === "propuesta" || c.status === "activo")
    .reduce((a, c) => a + (c.project_value ?? 0), 0);
  const mrr = clients.filter((c) => c.status === "activo")
    .reduce((a, c) => a + (c.monthly_value ?? 0), 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const paidThisMonth = invoices
    .filter((i) => i.status === "paid" && (i.paid_date ?? i.issued_date)?.startsWith(thisMonth))
    .reduce((a, i) => a + i.total, 0);
  const pendingTotal = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((a, i) => a + i.total, 0);

  // Chart
  const chartData = buildChart(invoices);
  const chartMax = Math.max(...chartData.map((m) => m.paid + m.pending), 1);

  return (
    <>
      {/* Action buttons */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 24 }}>
        <AddClient variant="ghost" label="Cliente" />
        {clients.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={openAddProject}>
            <Plus size={13} /> Proyecto
          </button>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Pipeline activo", val: pipeline > 0 ? formatCurrency(pipeline) : "—", color: "var(--bone)" },
          { label: "MRR", val: mrr > 0 ? formatCurrency(mrr) : "—", color: "var(--green)" },
          { label: "Cobrado este mes", val: paidThisMonth > 0 ? formatCurrency(paidThisMonth) : "—", color: "var(--gold)" },
          { label: "Por cobrar", val: pendingTotal > 0 ? formatCurrency(pendingTotal) : "—", color: pendingTotal > 0 ? "var(--red)" : "var(--mute)" },
        ].map((k) => (
          <div key={k.label} className="card">
            <p className="metric-label mb-1">{k.label}</p>
            <p style={{ fontFamily: "var(--f-mono)", fontSize: 22, color: k.color }}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* Monthly revenue chart */}
      <div className="card mb-6">
        <p className="eyebrow mb-4">Ingresos por mes</p>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 88 }}>
          {chartData.map((m) => {
            const paidH = Math.round((m.paid / chartMax) * 72);
            const pendH = Math.round((m.pending / chartMax) * 72);
            const isCurrent = m.key === thisMonth;
            return (
              <div key={m.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 72, gap: 2 }}>
                  {pendH > 0 && (
                    <div
                      style={{ height: pendH, background: "var(--blue)", opacity: 0.4, borderRadius: "3px 3px 0 0" }}
                      title={`Pendiente: ${formatCurrency(m.pending)}`}
                    />
                  )}
                  {paidH > 0 ? (
                    <div
                      style={{ height: paidH, background: isCurrent ? "var(--gold)" : "var(--green)", borderRadius: pendH > 0 ? 0 : "3px 3px 0 0" }}
                      title={`Cobrado: ${formatCurrency(m.paid)}`}
                    />
                  ) : (
                    <div style={{ height: 2, background: "var(--line)", borderRadius: 2, marginTop: "auto" }} />
                  )}
                </div>
                <span style={{
                  fontFamily: "var(--f-mono)", fontSize: 10,
                  color: isCurrent ? "var(--gold)" : "var(--mute-2)",
                  textTransform: "capitalize",
                }}>
                  {m.label}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: "var(--green)" }} />
            <span style={{ fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--mute)" }}>Cobrado</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: "var(--blue)", opacity: 0.5 }} />
            <span style={{ fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--mute)" }}>Pendiente</span>
          </div>
        </div>
      </div>

      {/* Shadow analysis */}
      <Analysis initial={analysis.content} generatedAt={analysis.generated_at} />

      {/* Follow-ups */}
      {followups.length > 0 && (
        <div className="card mb-6" style={{ borderColor: "var(--gold)" }}>
          <p className="eyebrow-gold mb-3">Follow-ups pendientes</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {followups.map((f) => {
              const client = f.flouvia_clients as unknown as { name: string } | null;
              const isOverdue = f.due_date && f.due_date < new Date().toISOString().split("T")[0];
              return (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {isOverdue
                    ? <AlertCircle size={14} style={{ color: "var(--red)", flexShrink: 0 }} />
                    : <Calendar size={14} style={{ color: "var(--mute)", flexShrink: 0 }} />
                  }
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, color: "var(--bone-dim)" }}>{f.title}</span>
                    {client && <span className="tick" style={{ marginLeft: 8 }}>· {client.name}</span>}
                  </div>
                  {f.due_date && (
                    <span className="tick" style={{ color: isOverdue ? "var(--red)" : "var(--mute)" }}>{f.due_date}</span>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: "2px 8px", gap: 4 }}
                    onClick={() => doneFollowup(f.id)}
                  >
                    <Check size={12} /> Listo
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Kanban */}
      {clients.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <p style={{ color: "var(--mute)", fontSize: 15, marginBottom: 16 }}>Sin clientes registrados.</p>
          <AddClient variant="primary" label="Agregar primer cliente" />
        </div>
      ) : (
        <>
          <p className="eyebrow mb-4">Pipeline de clientes</p>
          <div className="kanban mb-8">
            {STATUSES.map((stage) => {
              const cfg = STATUS_CONFIG[stage];
              const stageClients = clients.filter((c) => c.status === stage);
              return (
                <div key={stage} className="kanban-col">
                  <div className="kanban-col-header">
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
                    <div
                      key={c.id}
                      className="kanban-card"
                      style={{ cursor: "pointer" }}
                      onClick={() => openEditClient(c)}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
                        <p style={{ fontWeight: 500, color: "var(--bone)", fontSize: 14 }}>{c.name}</p>
                        <Pencil size={11} style={{ color: "var(--mute-2)", flexShrink: 0, marginTop: 2 }} />
                      </div>
                      {c.project_value != null && c.project_value > 0 && (
                        <p style={{ fontFamily: "var(--f-mono)", fontSize: 15, color: cfg.color, marginBottom: 2 }}>
                          {formatCurrency(c.project_value)}
                        </p>
                      )}
                      {c.monthly_value != null && c.monthly_value > 0 && (
                        <p style={{ fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--green)", marginBottom: 4 }}>
                          {formatCurrency(c.monthly_value)}/mes
                        </p>
                      )}
                      {c.description && (
                        <p className="tick" style={{ fontSize: 11, lineHeight: 1.4 }}>{c.description}</p>
                      )}
                    </div>
                  ))}

                  <div style={{ marginTop: 8 }}>
                    <AddClient defaultStatus={stage} label="Agregar" full />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Projects */}
      {projects.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <p className="eyebrow mb-4">Proyectos</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {projects.map((p) => {
              const client = p.flouvia_clients as unknown as { name: string } | null;
              const status = PROJECT_STATUS[p.status] ?? { label: p.status, color: "var(--mute)" };
              return (
                <div key={p.id} className="card" style={{ cursor: "pointer" }} onClick={() => openEditProject(p)}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <p style={{ fontWeight: 500, color: "var(--bone)", fontSize: 14 }}>{p.name}</p>
                        {client && <span className="tick">· {client.name}</span>}
                        <span
                          className="tag"
                          style={{ marginLeft: "auto", borderColor: status.color, color: status.color, background: `${status.color}15`, fontSize: 10 }}
                        >
                          {status.label}
                        </span>
                        <Pencil size={11} style={{ color: "var(--mute-2)", flexShrink: 0 }} />
                      </div>
                      {p.description && (
                        <p style={{ color: "var(--mute)", fontSize: 12, marginBottom: 6 }}>{p.description}</p>
                      )}
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                        {p.total_value != null && <span className="tick">{formatCurrency(p.total_value)}</span>}
                        {p.deadline && <span className="tick">📅 {p.deadline}</span>}
                        {p.estimated_hours != null && (
                          <span className="tick">⏱ {p.actual_hours ?? 0}/{p.estimated_hours}h</span>
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

      {/* Edit client modal */}
      {editingClient && (
        <Modal title="Editar cliente" onClose={() => setEditingClient(null)}>
          <Field label="Nombre">
            <input className="input" autoFocus value={eName} onChange={(e) => setEName(e.target.value)} />
          </Field>
          <Field label="Estado">
            <select className="input" value={eStatus} onChange={(e) => setEStatus(e.target.value as ClientStatus)}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
            </select>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Valor proyecto (MXN)">
              <input className="input" type="number" inputMode="decimal" placeholder="0" value={eProjectValue} onChange={(e) => setEProjectValue(e.target.value)} />
            </Field>
            <Field label="Mensualidad (MRR)">
              <input className="input" type="number" inputMode="decimal" placeholder="0" value={eMonthlyValue} onChange={(e) => setEMonthlyValue(e.target.value)} />
            </Field>
          </div>
          <Field label="Descripción">
            <input className="input" value={eDescription} onChange={(e) => setEDescription(e.target.value)} placeholder="Breve nota del cliente" />
          </Field>
          <Field label="Notas internas">
            <textarea
              className="input"
              rows={2}
              value={eNotes}
              onChange={(e) => setENotes(e.target.value)}
              placeholder="Detalles, contexto, acuerdos…"
              style={{ resize: "none" }}
            />
          </Field>
          <div className="modal-actions" style={{ justifyContent: "space-between" }}>
            <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={deleteClient}>
              <Trash2 size={12} /> Eliminar
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingClient(null)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={saveClient} disabled={saving || !eName.trim()}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add/Edit project modal */}
      {(editingProject || addingProject) && (
        <Modal title={editingProject ? "Editar proyecto" : "Nuevo proyecto"} onClose={() => { setEditingProject(null); setAddingProject(false); }}>
          <Field label="Nombre del proyecto">
            <input className="input" autoFocus value={ePName} onChange={(e) => setEPName(e.target.value)} />
          </Field>
          <Field label="Cliente">
            <select className="input" value={ePClientId} onChange={(e) => setEPClientId(e.target.value)}>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Estado">
            <select className="input" value={ePStatus} onChange={(e) => setEPStatus(e.target.value)}>
              {Object.entries(PROJECT_STATUS).map(([v, cfg]) => (
                <option key={v} value={v}>{cfg.label}</option>
              ))}
            </select>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Valor total (MXN)">
              <input className="input" type="number" inputMode="decimal" placeholder="0" value={ePValue} onChange={(e) => setEPValue(e.target.value)} />
            </Field>
            <Field label="Horas estimadas">
              <input className="input" type="number" inputMode="decimal" placeholder="0" value={ePHours} onChange={(e) => setEPHours(e.target.value)} />
            </Field>
          </div>
          <Field label="Deadline">
            <input className="input" type="date" value={ePDeadline} onChange={(e) => setEPDeadline(e.target.value)} />
          </Field>
          <Field label="Descripción">
            <textarea
              className="input"
              rows={2}
              value={ePDescription}
              onChange={(e) => setEPDescription(e.target.value)}
              placeholder="Alcance, entregables…"
              style={{ resize: "none" }}
            />
          </Field>
          <div className="modal-actions" style={{ justifyContent: "space-between" }}>
            {editingProject ? (
              <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={deleteProject}>
                <Trash2 size={12} /> Eliminar
              </button>
            ) : <span />}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setEditingProject(null); setAddingProject(false); }}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={saveProject} disabled={saving || !ePName.trim()}>
                {saving ? "Guardando…" : editingProject ? "Guardar" : "Agregar proyecto"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
