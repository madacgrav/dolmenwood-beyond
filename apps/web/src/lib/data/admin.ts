import { getContainer } from '@/lib/cosmos/client';
import { getCurrentAccount } from '@/lib/auth/session';
import { forbidden } from '@/lib/authz';
import type { AccountDoc, CampaignDoc, CharacterDoc } from '@/lib/cosmos/types';

/**
 * App-layer port of the get_admin_data() SECURITY DEFINER RPC: an
 * admin-gated dump of accounts, characters, and campaigns with the same
 * snake_case shape the dashboard consumes.
 */

export interface AdminData {
  accounts: {
    id: string; email: string; display_name: string; role: string;
    is_admin: boolean; created_at: string;
  }[];
  characters: {
    id: string; name: string; character_class: string; level: number; xp: number;
    kindred: string; is_active: boolean; created_at: string;
    owner_display_name: string; owner_email: string;
  }[];
  campaigns: {
    id: string; name: string; invite_code: string; created_at: string;
    referee_display_name: string; referee_email: string; member_count: number;
  }[];
  stats: {
    total_accounts: number; total_characters: number;
    active_characters: number; total_campaigns: number;
  };
}

export async function getAdminData(): Promise<AdminData> {
  const me = await getCurrentAccount();
  if (!me.isAdmin) throw forbidden();

  const [accounts, characters, campaigns] = await Promise.all([
    getContainer('accounts')
      .items.query<AccountDoc>('SELECT * FROM c ORDER BY c.createdAt DESC')
      .fetchAll()
      .then((r) => r.resources),
    getContainer('characters')
      .items.query<CharacterDoc>('SELECT * FROM c ORDER BY c.createdAt DESC')
      .fetchAll()
      .then((r) => r.resources),
    getContainer('campaigns')
      .items.query<CampaignDoc>('SELECT * FROM c ORDER BY c.createdAt DESC')
      .fetchAll()
      .then((r) => r.resources),
  ]);

  const accountById = new Map(accounts.map((a) => [a.id, a]));

  return {
    accounts: accounts.map((a) => ({
      id: a.id,
      email: a.email,
      display_name: a.displayName,
      role: a.role,
      is_admin: a.isAdmin,
      created_at: a.createdAt,
    })),
    characters: characters.map((c) => ({
      id: c.id,
      name: c.name,
      character_class: c.characterClass,
      level: c.level,
      xp: c.xp,
      kindred: c.kindred,
      is_active: c.isActive,
      created_at: c.createdAt,
      owner_display_name: accountById.get(c.ownerId)?.displayName ?? 'Unknown',
      owner_email: accountById.get(c.ownerId)?.email ?? '—',
    })),
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      invite_code: c.inviteCode,
      created_at: c.createdAt,
      referee_display_name: accountById.get(c.refereeId)?.displayName ?? 'Unknown',
      referee_email: accountById.get(c.refereeId)?.email ?? '—',
      member_count: c.members.length,
    })),
    stats: {
      total_accounts: accounts.length,
      total_characters: characters.length,
      active_characters: characters.filter((c) => c.isActive).length,
      total_campaigns: campaigns.length,
    },
  };
}
