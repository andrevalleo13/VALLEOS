"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";
import { useQuickAction } from "@/lib/store";
import type { FinancialCategory } from "@/lib/supabase/types";
import { BUCKETS, SPENDING_BUCKETS, type Bucket } from "@/lib/finance/categories";

const CATS: { v: FinancialCategory; l: string; expense: boolean }[] = [
  { v: "gasto_personal", l: "Gasto personal", expense: true },
  { v: "gasto_flouvia", l: "Gasto Flouvia", expense: true },
  { v: "flouvia_ingreso", l: "Ingreso Flouvia", expense: false },
  { v: "ahorro", l: "Ahorro", expense: false },
  { v: "inversion", l: "Inversión", expense: false },
];

const PAY_METHODS = ["efectivo", "débito", "tarjeta de crédito", "transferencia"];

type Opt = { id: string; name: string };

export function AddEntry({
  variant = "ghost",
  label = "Registrar",
  accounts = [],
  cards = [],
}: {
  variant?: "ghost" | "primary";
  label?: string;
  accounts?: Opt[];
  cards?: Opt[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState<FinancialCategory>("gasto_personal");
  const [bucket, setBucket] = useState<Bucket>("comida");
  const [method, setMethod] = useState("");
  const [accountId, setAccountId] = useState("");
  const [cardId, setCardId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  useQuickAction("gasto", () => setOpen(true));

  const isExpense = CATS.find((c) => c.v === cat)?.expense ?? true;
  const usesCard = method === "tarjeta de crédito";

  async function save() {
    const amt = parseFloat(amount);
    if (!desc.trim() || !isFinite(amt) || amt <= 0) return;
    setSaving(true);
    await supabase.from("financial_entries").insert({
      category: cat,
      amount: amt,
      description: desc.trim(),
      date,
      subcategory: isExpense ? bucket : null,
      card_id: usesCard && cardId ? cardId : null,
      account_id: !usesCard && accountId ? accountId : null,
      payment_method: method || null,
    });
    setSaving(false);
    setOpen(false);
    setDesc(""); setAmount(""); setMethod(""); setAccountId(""); setCardId("");
    router.refresh();
  }

  const expenseBuckets = BUCKETS.filter((b) => SPENDING_BUCKETS.includes(b.key));

  return (
    <>
      <button className={`btn btn-${variant} btn-sm`} onClick={() => setOpen(true)}>
        <Plus size={13} /> {label}
      </button>
      {open && (
        <Modal title="Registrar movimiento" onClose={() => setOpen(false)}>
          <Field label="Descripción">
            <input className="input" autoFocus placeholder="ej. Comida con clientes" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Monto (MXN)">
              <input className="input" type="number" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Fecha">
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <Field label="Categoría">
            <select className="input" value={cat} onChange={(e) => setCat(e.target.value as FinancialCategory)}>
              {CATS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
          </Field>
          {isExpense && (
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
            <Field label="Método de pago">
              <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="">—</option>
                {PAY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            {usesCard ? (
              <Field label="Tarjeta">
                <select className="input" value={cardId} onChange={(e) => setCardId(e.target.value)}>
                  <option value="">—</option>
                  {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="Cuenta">
                <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">—</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
            )}
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !desc.trim() || !amount}>
              {saving ? "Guardando…" : "Registrar"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
