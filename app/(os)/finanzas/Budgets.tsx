"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency } from "@/lib/utils";
import { BUCKETS, SPENDING_BUCKETS, bucketLabel, bucketColor } from "@/lib/finance/categories";
import type { Budget } from "@/lib/supabase/types";

const budgetBuckets = BUCKETS.filter((b) => SPENDING_BUCKETS.includes(b.key));

function BudgetModal({ budget, taken, onClose }: { budget: Budget | null; taken: string[]; onClose: () => void }) {
  const router = useRouter();
  const supabase = createClient();
  const isEdit = !!budget;
  const free = budgetBuckets.filter((b) => isEdit || !taken.includes(b.key));
  const [category, setCategory] = useState(budget?.category ?? free[0]?.key ?? "comida");
  const [limit, setLimit] = useState(budget ? String(budget.monthly_limit) : "");
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  async function save() {
    const lim = parseFloat(limit);
    if (!isFinite(lim) || lim <= 0) return;
    setSaving(true);
    if (isEdit) {
      await supabase.from("budgets").update({ monthly_limit: lim }).eq("id", budget!.id);
    } else {
      await supabase.from("budgets").insert({ category, monthly_limit: lim, alert_threshold: 80, rollover: false, active: true, subcategory: null, notes: null });
    }
    setSaving(false);
    onClose();
    router.refresh();
  }

  async function remove() {
    setSaving(true);
    await supabase.from("budgets").update({ active: false }).eq("id", budget!.id);
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <Modal title={isEdit ? "Editar presupuesto" : "Nuevo presupuesto"} onClose={onClose}>
      <Field label="Categoría">
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} disabled={isEdit}>
          {free.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
        </select>
      </Field>
      <Field label="Tope mensual (MXN)">
        <input className="input" type="number" inputMode="decimal" autoFocus placeholder="0.00" value={limit} onChange={(e) => setLimit(e.target.value)} />
      </Field>
      <div className="modal-actions" style={{ justifyContent: isEdit ? "space-between" : "flex-end" }}>
        {isEdit && (confirmDel ? (
          <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={remove} disabled={saving}>
            <Trash2 size={13} /> Confirmar
          </button>
        ) : (
          <button className="btn btn-ghost btn-sm" style={{ color: "var(--mute)" }} onClick={() => setConfirmDel(true)}>
            <Trash2 size={13} /> Eliminar
          </button>
        ))}
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !limit}>
          {saving ? "Guardando…" : isEdit ? "Guardar" : "Crear"}
        </button>
      </div>
    </Modal>
  );
}

export function Budgets({ budgets, spent }: { budgets: Budget[]; spent: Record<string, number> }) {
  const [modal, setModal] = useState<{ budget: Budget | null } | null>(null);
  const taken = budgets.map((b) => b.category);

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <p className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Target size={12} style={{ color: "var(--gold)" }} /> Presupuestos del mes
        </p>
        {budgets.length > 0 && taken.length < budgetBuckets.length && (
          <button className="btn btn-ghost btn-sm" onClick={() => setModal({ budget: null })}>
            <Plus size={13} /> Presupuesto
          </button>
        )}
      </div>

      {budgets.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Sin presupuestos"
          hint="Fija un tope mensual por categoría y mira cuánto llevas gastado."
        >
          <button className="btn btn-primary btn-sm" onClick={() => setModal({ budget: null })}>
            <Plus size={13} /> Crear presupuesto
          </button>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {budgets.map((b) => {
            const used = spent[b.category] ?? 0;
            const pct = b.monthly_limit > 0 ? (used / b.monthly_limit) * 100 : 0;
            const barPct = Math.min(100, Math.max(0, pct));
            const over = used > b.monthly_limit;
            const color = over || pct > 90 ? "var(--red)" : pct >= (b.alert_threshold || 80) ? "var(--gold)" : bucketColor(b.category);
            return (
              <button key={b.id} className="fin-budget-row" onClick={() => setModal({ budget: b })}>
                <div className="flex justify-between mb-1" style={{ width: "100%" }}>
                  <span style={{ fontSize: 14, color: "var(--bone-dim)", fontWeight: 500 }}>{bucketLabel(b.category)}</span>
                  <span className="tick" style={{ color }}>
                    {formatCurrency(used)} / {formatCurrency(b.monthly_limit)}
                  </span>
                </div>
                <div className="progress progress-lg">
                  <div className="progress-fill" style={{ width: `${barPct}%`, background: color }} />
                </div>
                <div className="flex justify-between mt-1" style={{ width: "100%" }}>
                  <span className="tick">{Math.round(pct)}% usado</span>
                  {over
                    ? <span className="tick" style={{ color: "var(--red)" }}>excedido {formatCurrency(used - b.monthly_limit)}</span>
                    : <span className="tick">quedan {formatCurrency(b.monthly_limit - used)}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {modal && <BudgetModal budget={modal.budget} taken={taken} onClose={() => setModal(null)} />}
    </div>
  );
}
