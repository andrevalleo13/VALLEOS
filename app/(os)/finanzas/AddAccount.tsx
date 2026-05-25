"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";

const TYPES = [
  { v: "checking", l: "Débito / Cheques" },
  { v: "savings", l: "Ahorro" },
  { v: "cash", l: "Efectivo" },
  { v: "digital", l: "Digital (Nu, Mercado Pago…)" },
];

export function AddAccount({ sortOrder = 0 }: { sortOrder?: number }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [type, setType] = useState("checking");
  const [currency, setCurrency] = useState("MXN");
  const [balance, setBalance] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from("bank_accounts").insert({
      name: name.trim(),
      bank: bank.trim() || null,
      type,
      currency,
      current_balance: parseFloat(balance) || 0,
      active: true,
      sort_order: sortOrder,
    });
    setSaving(false);
    setOpen(false);
    setName(""); setBank(""); setBalance("");
    router.refresh();
  }

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        <Plus size={13} /> Cuenta
      </button>
      {open && (
        <Modal title="Agregar cuenta" onClose={() => setOpen(false)}>
          <Field label="Nombre">
            <input className="input" autoFocus placeholder="ej. BBVA Nómina" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Banco">
              <input className="input" placeholder="ej. BBVA" value={bank} onChange={(e) => setBank(e.target.value)} />
            </Field>
            <Field label="Tipo">
              <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Saldo actual">
              <input className="input" type="number" inputMode="decimal" placeholder="0.00" value={balance} onChange={(e) => setBalance(e.target.value)} />
            </Field>
            <Field label="Moneda">
              <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </Field>
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !name.trim()}>
              {saving ? "Guardando…" : "Agregar"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
