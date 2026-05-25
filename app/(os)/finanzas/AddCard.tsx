"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";

export function AddCard({ sortOrder = 0 }: { sortOrder?: number }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [limit, setLimit] = useState("");
  const [balance, setBalance] = useState("");
  const [stmtBalance, setStmtBalance] = useState("");
  const [statementDay, setStatementDay] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [apr, setApr] = useState("");
  const [saving, setSaving] = useState(false);

  const dayNum = (s: string) => {
    const n = parseInt(s, 10);
    return isFinite(n) && n >= 1 && n <= 31 ? n : null;
  };

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from("credit_cards").insert({
      name: name.trim(),
      bank: bank.trim() || null,
      last_four: lastFour.trim() || null,
      credit_limit: parseFloat(limit) || null,
      current_balance: parseFloat(balance) || 0,
      statement_balance: stmtBalance ? parseFloat(stmtBalance) : null,
      statement_day: dayNum(statementDay),
      due_day: dayNum(dueDay),
      apr: apr ? parseFloat(apr) : null,
      active: true,
      sort_order: sortOrder,
    });
    setSaving(false);
    setOpen(false);
    setName(""); setBank(""); setLastFour(""); setLimit(""); setBalance("");
    setStmtBalance(""); setStatementDay(""); setDueDay(""); setApr("");
    router.refresh();
  }

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        <Plus size={13} /> Tarjeta
      </button>
      {open && (
        <Modal title="Agregar tarjeta de crédito" onClose={() => setOpen(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <Field label="Nombre">
              <input className="input" autoFocus placeholder="ej. Amex Gold" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Últimos 4">
              <input className="input" inputMode="numeric" maxLength={4} placeholder="1234" value={lastFour} onChange={(e) => setLastFour(e.target.value.replace(/\D/g, ""))} />
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Banco">
              <input className="input" placeholder="ej. American Express" value={bank} onChange={(e) => setBank(e.target.value)} />
            </Field>
            <Field label="Límite de crédito">
              <input className="input" type="number" inputMode="decimal" placeholder="0.00" value={limit} onChange={(e) => setLimit(e.target.value)} />
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Saldo usado actual">
              <input className="input" type="number" inputMode="decimal" placeholder="0.00" value={balance} onChange={(e) => setBalance(e.target.value)} />
            </Field>
            <Field label="Saldo al corte (a pagar)">
              <input className="input" type="number" inputMode="decimal" placeholder="opcional" value={stmtBalance} onChange={(e) => setStmtBalance(e.target.value)} />
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Field label="Día de corte">
              <input className="input" inputMode="numeric" placeholder="1-31" value={statementDay} onChange={(e) => setStatementDay(e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field label="Día de pago">
              <input className="input" inputMode="numeric" placeholder="1-31" value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field label="Tasa (APR %)">
              <input className="input" inputMode="decimal" placeholder="opcional" value={apr} onChange={(e) => setApr(e.target.value)} />
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
