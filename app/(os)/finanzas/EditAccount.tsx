"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";
import type { BankAccount } from "@/lib/supabase/types";

const TYPES = [
  { v: "checking", l: "Débito / Cheques" },
  { v: "savings", l: "Ahorro" },
  { v: "cash", l: "Efectivo" },
  { v: "digital", l: "Digital (Nu, Mercado Pago…)" },
];

export function EditAccount({ account, onClose }: { account: BankAccount; onClose: () => void }) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(account.name);
  const [bank, setBank] = useState(account.bank ?? "");
  const [type, setType] = useState(account.type);
  const [currency, setCurrency] = useState(account.currency);
  const [balance, setBalance] = useState(String(account.current_balance));
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from("bank_accounts").update({
      name: name.trim(),
      bank: bank.trim() || null,
      type,
      currency,
      current_balance: parseFloat(balance) || 0,
    }).eq("id", account.id);
    setSaving(false);
    onClose();
    router.refresh();
  }

  async function remove() {
    setSaving(true);
    await supabase.from("bank_accounts").update({ active: false }).eq("id", account.id);
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <Modal title="Editar cuenta" onClose={onClose}>
      <Field label="Nombre">
        <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Banco">
          <input className="input" value={bank} onChange={(e) => setBank(e.target.value)} />
        </Field>
        <Field label="Tipo">
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Saldo actual">
          <input className="input" type="number" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} />
        </Field>
        <Field label="Moneda">
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
          </select>
        </Field>
      </div>
      <div className="modal-actions" style={{ justifyContent: "space-between" }}>
        {confirmDel ? (
          <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={remove} disabled={saving}>
            <Trash2 size={13} /> Confirmar
          </button>
        ) : (
          <button className="btn btn-ghost btn-sm" style={{ color: "var(--mute)" }} onClick={() => setConfirmDel(true)}>
            <Trash2 size={13} /> Eliminar
          </button>
        )}
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !name.trim()}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </Modal>
  );
}
