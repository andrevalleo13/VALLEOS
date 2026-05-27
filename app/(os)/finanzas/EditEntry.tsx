"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";
import type { FinancialCategory, FinancialEntry } from "@/lib/supabase/types";
import { BUCKETS, SPENDING_BUCKETS, type Bucket } from "@/lib/finance/categories";

type AccountOpt = { id: string; name: string };
type CardOpt = { id: string; name: string };

const ALL_CATS: { v: FinancialCategory; l: string }[] = [
  { v: "gasto_personal", l: "Gasto personal" },
  { v: "gasto_flouvia", l: "Gasto Flouvia" },
  { v: "flouvia_ingreso", l: "Ingreso Flouvia" },
  { v: "ahorro", l: "Ahorro" },
  { v: "inversion", l: "Inversión" },
  { v: "pago_tarjeta", l: "Pago de tarjeta" },
];

const PAY_METHODS = ["efectivo", "débito", "tarjeta de crédito", "transferencia", "pago de tarjeta"];

export function EditEntry({
  entry,
  accounts,
  cards,
  onClose,
}: {
  entry: FinancialEntry;
  accounts: AccountOpt[];
  cards: CardOpt[];
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [desc, setDesc] = useState(entry.description ?? "");
  const [amount, setAmount] = useState(String(entry.amount));
  const [cat, setCat] = useState<FinancialCategory>(entry.category);
  const [bucket, setBucket] = useState<Bucket>((entry.subcategory as Bucket) || "comida");
  const [method, setMethod] = useState(entry.payment_method ?? "");
  const [accountId, setAccountId] = useState(entry.account_id ?? "");
  const [cardId, setCardId] = useState(entry.card_id ?? "");
  const [date, setDate] = useState(entry.date);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const isGasto = cat === "gasto_personal" || cat === "gasto_flouvia";
  const isPago = cat === "pago_tarjeta";
  const usesCard = isPago || (isGasto && method === "tarjeta de crédito");
  const expenseBuckets = BUCKETS.filter((b) => SPENDING_BUCKETS.includes(b.key));

  async function save() {
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt <= 0) return;
    setSaving(true);
    await supabase.from("financial_entries").update({
      category: cat,
      amount: amt,
      description: desc.trim() || null,
      date,
      subcategory: isGasto ? bucket : null,
      card_id: usesCard ? (cardId || null) : null,
      account_id: !usesCard || isPago ? (accountId || null) : null,
      payment_method: isPago ? "pago de tarjeta" : (method || null),
    }).eq("id", entry.id);
    setSaving(false);
    onClose();
    router.refresh();
  }

  async function remove() {
    setSaving(true);
    await supabase.from("financial_entries").delete().eq("id", entry.id);
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <Modal title="Editar movimiento" onClose={onClose}>
      <Field label="Descripción">
        <input className="input" autoFocus value={desc} onChange={(e) => setDesc(e.target.value)} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Monto (MXN)">
          <input className="input" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Fecha">
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Categoría">
        <select className="input" value={cat} onChange={(e) => setCat(e.target.value as FinancialCategory)}>
          {ALL_CATS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
        </select>
      </Field>
      {isGasto && (
        <Field label="¿En qué fue?">
          <div className="fin-bucket-grid">
            {expenseBuckets.map((b) => (
              <button
                key={b.key}
                type="button"
                className={`fin-bucket-chip${bucket === b.key ? " on" : ""}`}
                style={bucket === b.key ? { borderColor: b.color, color: b.color } : undefined}
                onClick={() => setBucket(b.key)}
              >
                {b.label}
              </button>
            ))}
          </div>
        </Field>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {!isPago && (
          <Field label="Método de pago">
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="">—</option>
              {PAY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
        )}
        {usesCard ? (
          <Field label={isPago ? "Tarjeta a pagar" : "Tarjeta"}>
            <select className="input" value={cardId} onChange={(e) => setCardId(e.target.value)}>
              <option value="">—</option>
              {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        ) : null}
        {(!usesCard || isPago) && (
          <Field label={isPago ? "Pagar desde" : "Cuenta"}>
            <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">—</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        )}
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
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !amount}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </Modal>
  );
}
