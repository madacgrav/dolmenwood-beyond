-- ============================================================
-- BANKING: coin columns on characters + bank_ledger table
-- ============================================================

-- Persist carried coins on the character record
alter table public.characters
  add column coins_gp integer not null default 0 check (coins_gp >= 0),
  add column coins_sp integer not null default 0 check (coins_sp >= 0),
  add column coins_cp integer not null default 0 check (coins_cp >= 0);

-- Bank ledger: every deposit or DM transfer is a row.
-- Positive amount_gp  = deposit (player puts money in the bank).
-- Negative amount_gp  = transfer back to character (DM pays out).
create table public.bank_ledger (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  amount_gp integer not null check (amount_gp <> 0),
  description text not null default '',
  performed_by uuid not null references public.accounts(id),
  created_at timestamptz not null default now()
);

create index idx_bank_ledger_character on public.bank_ledger(character_id, created_at desc);

alter table public.bank_ledger enable row level security;

-- Players can read their own character's ledger entries.
create policy "Players can view own bank entries"
  on public.bank_ledger for select
  using (
    exists (
      select 1 from public.characters
      where id = bank_ledger.character_id
        and owner_id = auth.uid()
    )
  );

-- Players can deposit (insert positive rows) for their own characters.
create policy "Players can deposit to bank"
  on public.bank_ledger for insert
  with check (
    amount_gp > 0
    and performed_by = auth.uid()
    and exists (
      select 1 from public.characters
      where id = bank_ledger.character_id
        and owner_id = auth.uid()
    )
  );

-- Referees can view all bank entries.
create policy "Referees can view all bank entries"
  on public.bank_ledger for select
  using (
    exists (
      select 1 from public.accounts
      where id = auth.uid()
        and role = 'referee'
    )
  );

-- Referees can insert any entry (deposits on behalf of player, or transfers back).
create policy "Referees can manage bank entries"
  on public.bank_ledger for insert
  with check (
    performed_by = auth.uid()
    and exists (
      select 1 from public.accounts
      where id = auth.uid()
        and role = 'referee'
    )
  );
