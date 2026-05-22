"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, Field } from "@/components/Modal";

const CATEGORIES = ["Flouvia", "Panamericana", "Estudio", "Deep work", "Salud", "Personal", "Descanso"];

export function LogTime({ variant = "primary", label = "Log" }: { variant?: "ghost" | "primary"; label?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [logLabel, setLogLabel] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [minutes, setMinutes] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const mins = parseInt(minutes);
    if (!logLabel.trim() || !isFinite(mins) || mins <= 0) return;
    setSaving(true);
    const ended = new Date();
    const started = new Date(ended.getTime() - mins * 60000);
    await supabase.from("time_logs").insert({
      block_id: null,
      label: logLabel.trim(),
      started_at: started.toISOString(),
      ended_at: ended.toISOString(),
      category,
    });
    setSaving(false);
    setOpen(false);
    setLogLabel(""); setMinutes("");
    router.refresh();
  }

  return (
    <>
      <button className={`btn btn-${variant} btn-sm`} onClick={() => setOpen(true)}>
        <Plus size={14} /> {label}
      </button>
      {open && (
        <Modal title="Registrar sesión" onClose={() => setOpen(false)}>
          <Field label="Qué hiciste">
            <input className="input" autoFocus placeholder="ej. Modelo DCF para cliente" value={logLabel} onChange={(e) => setLogLabel(e.target.value)} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Categoría">
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Duración (min)">
              <input className="input" type="number" inputMode="numeric" placeholder="60" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            </Field>
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !logLabel.trim() || !minutes}>
              {saving ? "Guardando…" : "Registrar"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
