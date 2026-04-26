-- Add invite_code to accounts and update the new-user trigger to generate one

-- 1. Dedicated function for account invite codes (checks accounts table for uniqueness)
create or replace function public.generate_account_invite_code()
returns text as $$
declare
  code text;
  exists_already boolean;
  attempts int := 0;
begin
  loop
    attempts := attempts + 1;
    if attempts > 20 then
      raise exception 'Could not generate unique invite code after 20 attempts';
    end if;

    code := upper(substring(encode(extensions.gen_random_bytes(4), 'base64') from 1 for 6));
    code := replace(replace(replace(code, '+', 'A'), '/', 'B'), '=', 'C');

    select exists(
      select 1 from public.accounts where invite_code = code
    ) into exists_already;

    exit when not exists_already;
  end loop;

  return code;
end;
$$ language plpgsql security definer;

-- 2. Add invite_code column to accounts
alter table public.accounts
  add column if not exists invite_code text unique default null;

-- 3. Backfill invite codes for any existing accounts
do $$
declare
  rec record;
begin
  for rec in select id from public.accounts where invite_code is null loop
    update public.accounts
    set invite_code = public.generate_account_invite_code()
    where id = rec.id;
  end loop;
end;
$$;

-- 4. Now make invite_code not null (all rows have a value)
alter table public.accounts
  alter column invite_code set not null;

-- 5. Replace the handle_new_user trigger to include invite code
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.accounts (id, email, role, display_name, invite_code)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'player'),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    public.generate_account_invite_code()
  );
  return new;
end;
$$ language plpgsql security definer;
