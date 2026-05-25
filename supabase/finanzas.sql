-- ── Finanzas v2 — migración aditiva (no borra datos) ────────────────────────
-- Conecta movimientos con cuentas de débito, y guarda el saldo al corte de las
-- tarjetas para los recordatorios de pago. Correr en el SQL Editor de Supabase.

-- Vincular un movimiento a la cuenta de débito de la que salió/entró
alter table financial_entries
  add column if not exists account_id uuid references bank_accounts(id) on delete set null;

-- Saldo al corte de la tarjeta = lo que hay que pagar antes del día de pago
alter table credit_cards
  add column if not exists statement_balance numeric(14,2);

-- Día de pago de servicios/recibos fijos (las tarjetas ya tienen due_day)
-- recurring_charges.charge_day ya existe; nada que agregar ahí.

-- Índices para los queries del dashboard y las gráficas
create index if not exists financial_entries_date_idx on financial_entries (date desc);
create index if not exists financial_entries_account_idx on financial_entries (account_id);
create index if not exists financial_entries_card_idx on financial_entries (card_id);

-- Asegurar RLS abierto (single-user, mismo patrón que el resto del schema)
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'budgets' and policyname = 'budgets_all'
  ) then
    execute 'create policy budgets_all on budgets for all using (true) with check (true)';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'recurring_charges' and policyname = 'recurring_charges_all'
  ) then
    execute 'create policy recurring_charges_all on recurring_charges for all using (true) with check (true)';
  end if;
end $$;
