"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";
import type { ClientStatus } from "@/lib/supabase/types";

const STATUSES: { v: ClientStatus; l: string }[] = [
  { v: "propuesta", l: "Propuesta" },
  { v: "activo", l: "Activo" },
  { v: "pausado", l: "Pausado" },
  { v: "completado", l: "Completado" },
];

export function AddClient({
  defaultStatus = "propuesta",
  variant = "ghost",
  label = "Cliente",
  full = false,
}: {
  defaultStatus?: ClientStatus;
  variant?: "ghost" | "primary";
  label?: string;
  full?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<ClientStatus>(defaultStatus);
  const [projectValue, setProjectValue] = useState("");
  const [monthlyValue, setMonthlyValue] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from("flouvia_clients").insert({
      name: name.trim(),
      status,
      project_value: projectValue ? parseFloat(projectValue) : null,
      monthly_value: monthlyValue ? parseFloat(monthlyValue) : null,
      description: description.trim() || null,
      notes: null,
      primary_contact_id: null,
      sort_order: 0,
    });
    setSaving(false);
    setOpen(false);
    setName(""); setProjectValue(""); setMonthlyValue(""); setDescription("");
    router.refresh();
  }

  return (
    <>
      <button
        className={`btn btn-${variant} btn-sm`}
        onClick={() => { setStatus(defaultStatus); setOpen(true); }}
        style={full ? { width: "100%", justifyContent: "center" } : undefined}
      >
        <Plus size={variant === "ghost" && full ? 12 : 13} /> {label}
      </button>
      {open && (
        <Modal title="Nuevo cliente" onClose={() => setOpen(false)}>
          <Field label="Nombre">
            <input className="input" autoFocus placeholder="ej. Despacho Lerma" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Estado">
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as ClientStatus)}>
              {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Valor proyecto (MXN)">
              <input className="input" type="number" inputMode="decimal" placeholder="0" value={projectValue} onChange={(e) => setProjectValue(e.target.value)} />
            </Field>
            <Field label="Mensualidad (MRR)">
              <input className="input" type="number" inputMode="decimal" placeholder="0" value={monthlyValue} onChange={(e) => setMonthlyValue(e.target.value)} />
            </Field>
          </div>
          <Field label="Descripción">
            <input className="input" placeholder="Breve nota del cliente" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !name.trim()}>
              {saving ? "Guardando…" : "Agregar cliente"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
