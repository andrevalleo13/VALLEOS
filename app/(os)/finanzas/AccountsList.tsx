"use client";
import { useState } from "react";
import { Landmark } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { BankAccount } from "@/lib/supabase/types";
import { EditAccount } from "./EditAccount";

export function AccountsList({ accounts }: { accounts: BankAccount[] }) {
  const [editing, setEditing] = useState<BankAccount | null>(null);

  return (
    <div className="card mb-6">
      <p className="eyebrow mb-4">Cuentas</p>
      <div className="flex flex-col gap-2">
        {accounts.map((b) => (
          <button key={b.id} className="tx-row" style={{ width: "100%", textAlign: "left", cursor: "pointer" }} onClick={() => setEditing(b)}>
            <div className="tx-icon"><Landmark size={14} style={{ color: "var(--gold)" }} /></div>
            <div className="flex-1">
              <p className="tx-desc">{b.name}</p>
              <p className="tx-date">{[b.bank, b.type, b.currency].filter(Boolean).join(" · ")}</p>
            </div>
            <span style={{ fontFamily: "var(--f-mono)", fontSize: 15, color: "var(--bone)" }}>
              {formatCurrency(b.current_balance)}
            </span>
          </button>
        ))}
      </div>
      {editing && <EditAccount account={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
