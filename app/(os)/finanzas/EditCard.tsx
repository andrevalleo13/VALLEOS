"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";
import type { CreditCard } from "@/lib/supabase/types";

export function EditCard({ card, onClose }: { card: CreditCard; onClose: () => void }) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(card.name);
  const [bank, setBank] = useState(card.bank ?? "");
  const [lastFour, setLastFour] = useState(card.last_four ?? "");
  const [limit, setLimit] = useState(card.credit_limit != null ? String(card.credit_limit) : "");
  const [balance, setBalance] = useState(String(card.current_balance));
  const [stmtBalance, setStmtBalance] = useState(card.statement_balance != null ? String(Math.max(0, card.statement_balance)) : "");
  const [statementDay, setStatementDay] = useState(card.statement_day != null ? String(card.statement_day) : "");
  const [dueDay, setDueDay] = useState(card.due_day != null ? String(card.due_day) : "");
  const [apr, setApr] = useState(card.apr != null ? String(card.apr) : "");
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const dayNum = (s: string) => {
    const n = parseInt(s, 10);
    return isFinite(n) && n >= 1 && n <= 31 ? n : null;
  };

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from("credit_cards").update({
      name: name.trim(),
      bank: bank.trim() || null,
      last_four: lastFour.trim() || null,
      credit_limit: limit ? parseFloat(limit) : null,
      current_balance: parseFloat(balance) || 0,
      statement_balance: stmtBalance ? parseFloat(stmtBalance) : null,
      statement_day: dayNum(statementDay),
      due_day: dayNum(dueDay),
      apr: apr ? parseFloat(apr) : null,
    }).eq("id", card.id);
    setSaving(false);
    onClose();
    router.refresh();
  }

  async function remove() {
    setSaving(true);
    await supabase.from("credit_cards").update({ active: false }).eq("id", card.id);
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <Modal title="Editar tarjeta" onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <Field label="Nombre">
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Últimos 4">
          <input className="input" inputMode="numeric" maxLength={4} value={lastFour} onChange={(e) => setLastFour(e.target.value.replace(/\D/g, ""))} />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Banco">
          <input className="input" value={bank} onChange={(e) => setBank(e.target.value)} />
        </Field>
        <Field label="Límite de crédito">
          <input className="input" type="number" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Saldo usado actual">
          <input className="input" type="number" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} />
        </Field>
        <Field label="Saldo al corte (a pagar)">
          <input className="input" type="number" inputMode="decimal" placeholder="opcional" value={stmtBalance} onChange={(e) => setStmtBalance(e.target.value)} />
        </Field>
      </div>
      <div className="r3">
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
