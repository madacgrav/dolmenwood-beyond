-- Function to generate unique 6-character invite codes
create or replace function public.generate_invite_code()
returns text as $$
declare
  code text;
  exists_already boolean;
begin
  loop
    -- Generate a random 6-char alphanumeric code (uppercase)
    code := upper(substring(encode(gen_random_bytes(4), 'base64') from 1 for 6));
    code := replace(replace(replace(code, '+', 'A'), '/', 'B'), '=', 'C');

    select exists(
      select 1 from public.campaigns where invite_code = code
    ) into exists_already;

    exit when not exists_already;
  end loop;

  return code;
end;
$$ language plpgsql security definer;
