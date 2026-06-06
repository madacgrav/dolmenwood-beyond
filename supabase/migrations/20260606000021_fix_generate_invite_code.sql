-- Fix gen_random_bytes search path in generate_invite_code()
-- The original function (migration 003) used the unqualified gen_random_bytes(4),
-- which fails when called from security definer functions with search_path = public.
-- Fixed by schema-qualifying to extensions.gen_random_bytes(4) (same fix applied
-- to generate_account_invite_code() in migration 004).
create or replace function public.generate_invite_code()
returns text as $$
declare
  code text;
  exists_already boolean;
  attempts int := 0;
begin
  loop
    attempts := attempts + 1;
    if attempts > 20 then
      raise exception 'Could not generate unique campaign invite code after 20 attempts';
    end if;

    code := upper(substring(encode(extensions.gen_random_bytes(4), 'base64') from 1 for 6));
    code := replace(replace(replace(code, '+', 'A'), '/', 'B'), '=', 'C');

    select exists(
      select 1 from public.campaigns where invite_code = code
    ) into exists_already;

    exit when not exists_already;
  end loop;

  return code;
end;
$$ language plpgsql security definer;
