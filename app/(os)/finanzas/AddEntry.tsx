"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";
import type { FinancialCategory } from "@/lib/supabase/types";

const CATS: { v: FinancialCategory; l: string }[] = [
  { v: "flouvia_ingreso", l: "Ingreso Flouvia" },
  { v: "gasto_personal", l: "Gasto personal" },
  { v: "gasto_flouvia", l: "Gasto Flouvia" },
  { v: "ahorro", l: "Ahorro" },
  { v: "inversion", l: "Inversión" },
];

export function AddEntry({ variant = "ghost", label = "Registrar" }: { variant?: "ghost" | "primary"; label?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState<FinancialCategory>("gasto_personal");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  async function save() {
    const amt = parseFloat(amount);
    if (!desc.trim() || !isFinite(amt) || amt <= 0) return;
    setSaving(true);
    await supabase.from("financial_entries").insert({
      category: cat, amount: amt, description: desc.trim(), date,
      subcategory: null, card_id: null, payment_method: null,
    });
    setSaving(false);
    setOpen(false);
    setDesc(""); setAmount("");
    router.refresh();
  }

  return (
    <>
      <button className={`btn btn-${variant} btn-sm`} onClick={() => setOpen(true)}>
        <Plus size={13} /> {label}
      </button>
      {open && (
        <Modal title="Registrar movimiento" onClose={() => setOpen(false)}>
          <Field label="Descripción">
            <input className="input" autoFocus placeholder="ej. Suscripción Figma" value={desc} onChange={(e) => setDesc(e.target.value)} />
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
