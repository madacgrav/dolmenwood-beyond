import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Single source of truth for campaign-domain queries.
 *
 * Rows are kept snake_case (matching the DB) because the campaign overview
 * UI consumes them as-is; the shared types + queries here replace the
 * inline supabase calls that used to live in OverviewTab.
 */

export type PackAnimalType = 'Mule' | 'Donkey' | 'Pony' | 'Horse' | 'Ox' | 'Pack Dog';

export const PACK_ANIMAL_TYPES: PackAnimalType[] = ['Mule', 'Donkey', 'Pony', 'Horse', 'Ox', 'Pack Dog'];

export interface PackAnimal {
  id: string;
  name: string;
  mount_type: PackAnimalType;
  speed: number;
  campaign_id: string;
  owner_id: string;
}

export interface MemberCharacter {
  id: string;
  name: string;
  character_class: string;
  level: number;
  xp: number;
  ability_scores: Record<string, number>;
  kindred: string;
  hp_current?: number;
  hp_max?: number;
}

export interface Member {
  account_id: string;
  display_name: string;
  joined_at: string;
  characters: MemberCharacter[];
}

export interface CampaignData {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
  members: Member[];
  showMembers: boolean;
}

export interface RefereeCampaignsData {
  campaigns: CampaignData[];
  packAnimals: Record<string, PackAnimal[]>;
}

/**
 * Loads everything the referee overview needs in one call:
 * campaigns owned by the referee, their party pack animals, their
 * members (with display names), and each member's characters.
 *
 * Returns `null` when the referee owns no campaigns (so callers can
 * leave any previously-loaded pack-animal state untouched, matching
 * the original inline behavior).
 */
export async function loadRefereeCampaigns(
  supabase: SupabaseClient,
  refereeId: string,
): Promise<RefereeCampaignsData | null> {
  const { data: rawCampaigns } = await supabase
    .from('campaigns')
    .select('id, name, invite_code, created_at')
    .eq('referee_id', refereeId)
    .order('created_at', { ascending: false });

  if (!rawCampaigns || rawCampaigns.length === 0) return null;

  const campaignIds = rawCampaigns.map((c: { id: string }) => c.id);

  // Fetch pack animals (party-owned mounts) for all campaigns in one query
  const { data: mountsData } = await supabase
    .from('mounts')
    .select('id, name, mount_type, speed, campaign_id, owner_id')
    .in('campaign_id', campaignIds)
    .eq('owner_type', 'party');

  const packAnimals = (mountsData ?? []).reduce<Record<string, PackAnimal[]>>((acc, m) => {
    const cid = m.campaign_id as string | null;
    if (cid) acc[cid] = [...(acc[cid] ?? []), m as PackAnimal];
    return acc;
  }, {});

  const { data: rawMembers } = await supabase
    .from('campaign_members')
    .select('campaign_id, account_id, joined_at, accounts(display_name)')
    .in('campaign_id', campaignIds);

  const members = (rawMembers ?? []) as unknown as Array<{
    campaign_id: string;
    account_id: string;
    joined_at: string;
    accounts: { display_name: string } | null;
  }>;
  const memberAccountIds = [...new Set(members.map(m => m.account_id))];

  const { data: rawChars } = memberAccountIds.length > 0
    ? await supabase
        .from('characters')
        .select('id, name, character_class, level, xp, ability_scores, kindred, owner_id')
        .in('owner_id', memberAccountIds)
        .order('name')
    : { data: [] };

  const chars = (rawChars ?? []) as Array<MemberCharacter & { owner_id: string }>;

  const campaigns = rawCampaigns.map((c: { id: string; name: string; invite_code: string; created_at: string }) => {
    const campaignMembers = members
      .filter(m => m.campaign_id === c.id)
      .map(m => ({
        account_id: m.account_id,
        display_name: m.accounts?.display_name ?? 'Unknown',
        joined_at: m.joined_at,
        characters: chars.filter(ch => ch.owner_id === m.account_id),
      }));
    return {
      ...c,
      members: campaignMembers,
      showMembers: true,
    };
  });

  return { campaigns, packAnimals };
}

/**
 * Loads the campaigns a player belongs to, with party rosters fetched
 * via the SECURITY DEFINER `get_campaign_party_data` RPC so players can
 * see other members' characters.
 */
export async function loadPlayerCampaigns(
  supabase: SupabaseClient,
  accountId: string,
): Promise<CampaignData[]> {
  // Get campaigns the player belongs to
  const { data: memberships } = await supabase
    .from('campaign_members')
    .select('campaign_id, joined_at')
    .eq('account_id', accountId);

  if (!memberships || memberships.length === 0) return [];

  const campaignIds = memberships.map((m: { campaign_id: string }) => m.campaign_id);

  const [{ data: rawCampaigns }, ...partyResults] = await Promise.all([
    supabase.from('campaigns').select('id, name, invite_code, created_at').in('id', campaignIds),
    // Use SECURITY DEFINER RPC so players can see other members' characters
    ...campaignIds.map((id: string) =>
      supabase.rpc('get_campaign_party_data', { p_campaign_id: id })
    ),
  ]);

  return (rawCampaigns ?? []).map((c: { id: string; name: string; invite_code: string; created_at: string }, idx: number) => {
    const partyData = partyResults[idx]?.data as Array<{
      account_id: string;
      display_name: string;
      characters: Array<{
        id: string; name: string; character_class: string; level: number;
        kindred: string; hp_current: number; hp_max: number; xp: number;
      }> | null;
    }> | null;

    const campaignMembers = (partyData ?? []).map(m => ({
      account_id: m.account_id,
      display_name: m.display_name ?? 'Unknown',
      joined_at: '',
      characters: (m.characters ?? []).map(ch => ({
        id: ch.id,
        name: ch.name,
        character_class: ch.character_class,
        level: ch.level,
        kindred: ch.kindred,
        hp_current: ch.hp_current,
        hp_max: ch.hp_max,
        xp: ch.xp,
        ability_scores: {} as Record<string, number>,
        owner_id: m.account_id,
      })),
    }));

    return { ...c, members: campaignMembers, showMembers: true };
  });
}

export async function createCampaign(
  supabase: SupabaseClient,
  name: string,
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.rpc('create_campaign', { p_name: name });
  return { error };
}

export async function joinCampaign(
  supabase: SupabaseClient,
  inviteCode: string,
): Promise<{ data: unknown; error: { message: string } | null }> {
  const { data, error } = await supabase.rpc('join_campaign', { p_invite_code: inviteCode });
  return { data, error };
}

export async function awardXP(
  supabase: SupabaseClient,
  characterId: string,
  gain: number,
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.rpc('award_xp', { p_character_id: characterId, p_gain: gain });
  return { error };
}

export async function insertPackAnimal(
  supabase: SupabaseClient,
  params: {
    ownerId: string;
    campaignId: string;
    name: string;
    mountType: PackAnimalType;
    speed: number;
  },
): Promise<PackAnimal | null> {
  const { data, error } = await supabase
    .from('mounts')
    .insert({
      owner_id: params.ownerId,
      owner_type: 'party',
      campaign_id: params.campaignId,
      name: params.name,
      mount_type: params.mountType,
      speed: params.speed,
      has_full_stats: false,
    })
    .select('id, name, mount_type, speed, campaign_id, owner_id')
    .single();
  if (error || !data) return null;
  return data as PackAnimal;
}

export async function removePackAnimal(
  supabase: SupabaseClient,
  animalId: string,
): Promise<void> {
  await supabase.from('mounts').delete().eq('id', animalId);
}
