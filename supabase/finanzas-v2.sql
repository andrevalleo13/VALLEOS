-- Finanzas v2 — pago de tarjeta + saldos automáticos
-- Aditiva. Correr una vez en Supabase SQL Editor.
--
-- Qué hace:
--   1. Agrega la categoría 'pago_tarjeta' a financial_entries (pago a una tarjeta:
--      baja la deuda de la tarjeta y sale de una cuenta).
--   2. Triggers que mantienen los saldos al día automáticamente en cada
--      insert / update / delete de financial_entries (desde la app o desde Shadow).
--
-- NOTA: no hace backfill. Los saldos actuales se toman como punto de partida y de
-- aquí en adelante cada movimiento los ajusta. Editar/borrar movimientos creados
-- ANTES de esta migración revierte un efecto que nunca se aplicó; ajusta el saldo a
-- mano si eso pasa (raro).

-- 1) Categoría pago_tarjeta
alter table financial_entries drop constraint if exists financial_entries_category_check;
alter table financial_entries add constraint financial_entries_category_check
  check (category in ('flouvia_ingreso','gasto_personal','gasto_flouvia','ahorro','inversion','pago_tarjeta'));

-- 2) Motor de saldos
-- sgn = +1 para aplicar el efecto de un movimiento, -1 para revertirlo.
create or replace function fin_apply_balances(e financial_entries, sgn int)
returns void language plpgsql as $$
begin
  if e.category = 'flouvia_ingreso' then
    -- ingreso: entra a la cuenta
    if e.account_id is not null then
      update bank_accounts set current_balance = current_balance + sgn * e.amount where id = e.account_id;
    end if;

  elsif e.category in ('gasto_personal','gasto_flouvia') then
    -- gasto: si fue a crédito sube la deuda de la tarjeta; si no, sale de la cuenta
    if e.card_id is not null then
      update credit_cards set current_balance = current_balance + sgn * e.amount where id = e.card_id;
    elsif e.account_id is not null then
      update bank_accounts set current_balance = current_balance - sgn * e.amount where id = e.account_id;
    end if;

  elsif e.category in ('ahorro','inversion') then
    -- ahorro/inversión: sale de la cuenta de origen
    if e.account_id is not null then
      update bank_accounts set current_balance = current_balance - sgn * e.amount where id = e.account_id;
    end if;

  elsif e.category = 'pago_tarjeta' then
    -- pago de tarjeta: baja la deuda (y el saldo al corte, si está definido) y sale de la cuenta de origen
    if e.card_id is not null then
      update credit_cards set
        current_balance = current_balance - sgn * e.amount,
        statement_balance = case when statement_balance is not null
          then statement_balance - sgn * e.amount else null end
      where id = e.card_id;
    end if;
    if e.account_id is not null then
      update bank_accounts set current_balance = current_balance - sgn * e.amount where id = e.account_id;
    end if;
  end if;
end;
$$;

create or replace function fin_entry_balance_trigger()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    perform fin_apply_balances(NEW, 1);
    return NEW;
  elsif tg_op = 'DELETE' then
    perform fin_apply_balances(OLD, -1);
    return OLD;
  elsif tg_op = 'UPDATE' then
    perform fin_apply_balances(OLD, -1);
    perform fin_apply_balances(NEW, 1);
    return NEW;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_fin_entry_balance on financial_entries;
create trigger trg_fin_entry_balance
  after insert or update or delete on financial_entries
  for each row execute function fin_entry_balance_trigger();
