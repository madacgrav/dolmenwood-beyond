-- Add is_admin flag to accounts
alter table public.accounts add column if not exists is_admin boolean not null default false;

-- Auto-set admin for the owner's email via trigger
create or replace function public.set_admin_on_signup()
returns trigger language plpgsql security definer as $$
begin
  if new.email = 'madacgrav@gmail.com' then
    new.is_admin := true;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_set_admin_on_signup on public.accounts;
create trigger tr_set_admin_on_signup
  before insert on public.accounts
  for each row execute function public.set_admin_on_signup();

-- Also update existing account if already exists
update public.accounts set is_admin = true where email = 'madacgrav@gmail.com';

-- Admin data RPC
create or replace function public.get_admin_data()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from public.accounts where id = auth.uid();

  if not coalesce(v_is_admin, false) then
    raise exception 'Access denied';
  end if;

  return json_build_object(
    'accounts', (
      select json_agg(row_to_json(a))
      from (select id, email, display_name, role, is_admin, created_at from public.accounts order by created_at desc) a
    ),
    'characters', (
      select json_agg(row_to_json(c))
      from (
        select ch.id, ch.name, ch.character_class, ch.level, ch.xp, ch.kindred, ch.is_active, ch.created_at,
               ac.display_name as owner_display_name, ac.email as owner_email
        from public.characters ch
        join public.accounts ac on ch.owner_id = ac.id
        order by ch.created_at desc
      ) c
    ),
    'campaigns', (
      select json_agg(row_to_json(camp))
      from (
        select ca.id, ca.name, ca.invite_code, ca.created_at,
               ac.display_name as referee_display_name, ac.email as referee_email,
               (select count(*) from public.campaign_members cm where cm.campaign_id = ca.id) as member_count
        from public.campaigns ca
        join public.accounts ac on ca.referee_id = ac.id
        order by ca.created_at desc
      ) camp
    ),
    'stats', json_build_object(
      'total_accounts', (select count(*) from public.accounts),
      'total_characters', (select count(*) from public.characters),
      'active_characters', (select count(*) from public.characters where is_active = true),
      'total_campaigns', (select count(*) from public.campaigns)
    )
  );
end;
$$;

revoke execute on function public.get_admin_data() from public;
grant execute on function public.get_admin_data() to authenticated;
