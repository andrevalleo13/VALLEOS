import type { CreditCard, RecurringCharge } from "@/lib/supabase/types";

export type UpcomingPayment = {
  id: string;
  name: string;
  amount: number | null;
  dueDate: string; // YYYY-MM-DD
  daysUntil: number;
  kind: "card" | "recurring";
  detail?: string;
};

/** Next calendar date that lands on `day` of the month (clamped to month length), from `from` inclusive. */
export function nextOccurrenceOfDay(day: number, from = new Date()): Date {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < 2; i++) {
    const y = base.getFullYear();
    const m = base.getMonth() + i;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const d = Math.min(day, lastDay);
    const candidate = new Date(y, m, d);
    if (candidate >= base) return candidate;
  }
  return base;
}

export function daysUntilDate(d: Date, from = new Date()): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Builds the sorted list of upcoming payments from credit cards (due_day) and recurring charges (charge_day). */
export function buildUpcomingPayments(
  cards: Pick<CreditCard, "id" | "name" | "due_day" | "statement_day" | "statement_balance" | "current_balance" | "last_four" | "bank">[],
  recurring: Pick<RecurringCharge, "id" | "name" | "amount" | "charge_day">[],
  from = new Date()
): UpcomingPayment[] {
  const out: UpcomingPayment[] = [];

  for (const c of cards) {
    if (c.due_day == null) continue;
    const due = nextOccurrenceOfDay(c.due_day, from);
    const amount = c.statement_balance ?? (c.current_balance > 0 ? c.current_balance : null);
    out.push({
      id: c.id,
      name: c.name + (c.last_four ? ` ····${c.last_four}` : ""),
      amount,
      dueDate: iso(due),
      daysUntil: daysUntilDate(due, from),
      kind: "card",
      detail: c.statement_day != null ? `corte día ${c.statement_day}` : c.bank ?? undefined,
    });
  }

  for (const r of recurring) {
    if (r.charge_day == null) continue;
    const due = nextOccurrenceOfDay(r.charge_day, from);
    out.push({
      id: r.id,
      name: r.name,
      amount: r.amount,
      dueDate: iso(due),
      daysUntil: daysUntilDate(due, from),
      kind: "recurring",
    });
  }

  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}
