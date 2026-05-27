"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowDownLeft, ArrowUpRight, CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";
import { useQuickAction } from "@/lib/store";
import type { FinancialCategory } from "@/lib/supabase/types";
import { BUCKETS, SPENDING_BUCKETS, type Bucket } from "@/lib/finance/categories";

type Tipo = "egreso" | "ingreso" | "pago";

const EGRESO_CATS: { v: FinancialCategory; l: string; isGasto: boolean }[] = [
  { v: "gasto_personal", l: "Gasto personal", isGasto: true },
  { v: "gasto_flouvia", l: "Gasto Flouvia", isGasto: true },
  { v: "ahorro", l: "Ahorro", isGasto: false },
  { v: "inversion", l: "Inversión", isGasto: false },
];

const PAY_METHODS = ["efectivo", "débito", "tarjeta de crédito", "transferencia"];

type AccountOpt = { id: string; name: string; balance: number };
type CardOpt = { id: string; name: string; currentBalance: number; statementBalance: number | null };

export function AddEntry({
  variant = "ghost",
  label = "Registrar",
  accounts = [],
  cards = [],
}: {
  variant?: "ghost" | "primary";
  label?: string;
  accounts?: AccountOpt[];
  cards?: CardOpt[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<Tipo>("egreso");
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

  const isGasto = tipo === "egreso" && (EGRESO_CATS.find((c) => c.v === cat)?.isGasto ?? false);
  const usesCard = tipo === "egreso" && method === "tarjeta de crédito";
  const selectedCard = cards.find((c) => c.id === cardId);

  function pickTipo(t: Tipo) {
    setTipo(t);
    if (t === "egreso") setCat("gasto_personal");
    else if (t === "ingreso") setCat("flouvia_ingreso");
    else setCat("pago_tarjeta");
    setCardId(""); setAccountId(""); setMethod("");
  }

  function reset() {
    setDesc(""); setAmount(""); setMethod(""); setAccountId(""); setCardId("");
    setTipo("egreso"); setCat("gasto_personal"); setBucket("comida");
  }

  async function save() {
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt <= 0) return;
    if (tipo === "pago" && !cardId) return;
    if (tipo !== "pago" && !desc.trim()) return;

    const description =
      tipo === "pago"
        ? `Pago ${cards.find((c) => c.id === cardId)?.name ?? "tarjeta"}`
        : desc.trim();

    setSaving(true);
    await supabase.from("financial_entries").insert({
      category: cat,
      amount: amt,
      description,
      date,
      subcategory: isGasto ? bucket : null,
      card_id: tipo === "pago" || usesCard ? (cardId || null) : null,
      account_id: tipo === "pago" ? (accountId || null) : (!usesCard ? (accountId || null) : null),
      payment_method: tipo === "pago" ? "pago de tarjeta" : (method || null),
    });
    setSaving(false);
    setOpen(false);
    reset();
    router.refresh();
  }

  const expenseBuckets = BUCKETS.filter((b) => SPENDING_BUCKETS.includes(b.key));
  const accentColor = tipo === "ingreso" ? "var(--green)" : "var(--red)";

  return (
    <>
      <button className={`btn btn-${variant} btn-sm`} onClick={() => setOpen(true)}>
        <Plus size={13} /> {label}
      </button>
      {open && (
        <Modal title="Registrar movimiento" onClose={() => setOpen(false)}>
          {/* Tipo */}
          <div className="seg" style={{ marginBottom: 14, display: "flex", width: "100%" }}>
            {([
              ["egreso", "Egreso", ArrowUpRight],
              ["ingreso", "Ingreso", ArrowDownLeft],
              ["pago", "Pago tarjeta", CreditCard],
            ] as const).map(([t, l, Icon]) => (
              <button
                key={t}
                type="button"
                className={`seg-btn${tipo === t ? " on" : ""}`}
                style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                onClick={() => pickTipo(t)}
              >
                <Icon size={13} /> {l}
              </button>
            ))}
          </div>

          {tipo !== "pago" && (
            <Field label="Descripción">
              <input className="input" autoFocus placeholder={tipo === "ingreso" ? "ej. Pago de cliente Acme" : "ej. Comida con clientes"} value={desc} onChange={(e) => setDesc(e.target.value)} />
            </Field>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Monto (MXN)">
              <input className="input" type="number" inputMode="decimal" placeholder="0.00" value={amount} style={{ color: accentColor }} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Fecha">
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>

          {/* EGRESO */}
          {tipo === "egreso" && (
            <>
              <Field label="Categoría">
                <select className="input" value={cat} onChange={(e) => setCat(e.target.value as FinancialCategory)}>
                  {EGRESO_CATS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
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
            </>
          )}

          {/* INGRESO */}
          {tipo === "ingreso" && (
            <Field label="Entra a la cuenta">
              <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">—</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          )}

          {/* PAGO DE TARJETA */}
          {tipo === "pago" && (
            <>
              <Field label="Tarjeta a pagar">
                <select className="input" value={cardId} onChange={(e) => setCardId(e.target.value)}>
                  <option value="">—</option>
                  {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              {selectedCard && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: -6, marginBottom: 12 }}>
                  {selectedCard.statementBalance != null && selectedCard.statementBalance > 0 && (
                    <button type="button" className="fin-bucket-chip" onClick={() => setAmount(String(selectedCard.statementBalance))}>
                      Saldo al corte ${selectedCard.statementBalance.toLocaleString("es-MX")}
                    </button>
                  )}
                  {selectedCard.currentBalance > 0 && (
                    <button type="button" className="fin-bucket-chip" onClick={() => setAmount(String(selectedCard.currentBalance))}>
                      Saldo total ${selectedCard.currentBalance.toLocaleString("es-MX")}
                    </button>
                  )}
                </div>
              )}
              <Field label="Pagar desde">
                <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">—</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
              <p className="tick" style={{ marginTop: -4 }}>
                Baja la deuda de la tarjeta{accountId ? " y el saldo de la cuenta" : ""}.
              </p>
            </>
          )}

          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={save}
              disabled={saving || !amount || (tipo === "pago" ? !cardId : !desc.trim())}
            >
              {saving ? "Guardando…" : "Registrar"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
