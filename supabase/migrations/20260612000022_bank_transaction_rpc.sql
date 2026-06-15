-- ============================================================
-- BANK TRANSACTION RPC — atomic ledger entry + coin purse update
-- ============================================================
-- Replaces the two-call pattern (bank_ledger.insert + characters.update)
-- used by player deposits (InventoryTab) and referee transfers
-- (BankingTab). The dual write was not atomic: if one write failed the
-- other could land, desyncing the purse from the ledger.
--
-- Semantics (matching the existing RLS policies on bank_ledger):
--   p_amount_gp > 0  = deposit: character owner or referee; takes gp
--                      from the character's purse into the bank.
--   p_amount_gp < 0  = payout: referee only; moves gp from the bank
--                      back into the character's purse.
--
-- Validation:
--   - purse cannot go negative on deposit
--   - bank balance cannot go negative on payout
--   - performed_by is always auth.uid() (server-side, not caller-supplied)

create or replace function public.bank_transaction(
  p_character_id uuid,
  p_amount_gp    integer,
  p_description  text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id    uuid;
  v_coins_gp    integer;
  v_is_referee  boolean;
  v_balance     integer;
begin
  if p_amount_gp = 0 then
    raise exception 'amount must be non-zero';
  end if;

  -- Lock the character row for the duration of the transaction
  select owner_id, coins_gp
  into   v_owner_id, v_coins_gp
  from   public.characters
  where  id = p_character_id
  for update;

  if not found then
    raise exception 'character not found: %', p_character_id;
  end if;

  select exists (
    select 1 from public.accounts
    where id = auth.uid() and role = 'referee'
  ) into v_is_referee;

  -- Authorization mirrors the bank_ledger RLS policies
  if p_amount_gp > 0 then
    if v_owner_id != auth.uid() and not v_is_referee then
      raise exception 'access denied: only the character owner or a referee may deposit';
    end if;
  else
    if not v_is_referee then
      raise exception 'access denied: only a referee may transfer out of the bank';
    end if;
  end if;

  -- Deposit: purse must cover the amount
  if p_amount_gp > 0 and v_coins_gp < p_amount_gp then
    raise exception 'insufficient coins: purse holds % gp, deposit is % gp',
      v_coins_gp, p_amount_gp;
  end if;

  -- Payout: bank balance must cover the amount
  if p_amount_gp < 0 then
    select coalesce(sum(amount_gp), 0)
    into   v_balance
    from   public.bank_ledger
    where  character_id = p_character_id;

    if v_balance < -p_amount_gp then
      raise exception 'insufficient bank balance: bank holds % gp, payout is % gp',
        v_balance, -p_amount_gp;
    end if;
  end if;

  insert into public.bank_ledger (character_id, amount_gp, description, performed_by)
  values (p_character_id, p_amount_gp, coalesce(p_description, ''), auth.uid());

  -- Deposit (positive) removes gp from the purse; payout (negative) adds it back
  update public.characters
  set    coins_gp = coins_gp - p_amount_gp
  where  id = p_character_id;
end;
$$;

revoke all on function public.bank_transaction(uuid, integer, text) from public;
grant execute on function public.bank_transaction(uuid, integer, text) to authenticated;
