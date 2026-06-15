import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Character,
  CharacterWithNotes,
  AbilityScores,
  SessionNote,
  PersonOfNote,
} from '@dolmenwood/types';

/**
 * Single source of truth for mapping `characters` table rows
 * (snake_case) to the camelCase domain types, and back.
 *
 * Before this module existed, four hand-copied mappers had already
 * drifted apart (one dropped extraLanguages, another dropped
 * sessionNotes/peopleOfNote). Add new columns HERE, nowhere else.
 */

export type CharacterRow = Record<string, unknown>;

export function mapCharacterRow(row: CharacterRow): Character {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    name: row.name as string,
    sex: row.sex as string | undefined,
    age: row.age as string | undefined,
    height: row.height as string | undefined,
    weight: row.weight as string | undefined,
    kindred: row.kindred as Character['kindred'],
    characterClass: row.character_class as Character['characterClass'],
    alignment: row.alignment as Character['alignment'],
    moonSign: row.moon_sign as string | undefined,
    background: row.background as string | undefined,
    level: row.level as number,
    xp: row.xp as number,
    abilityScores: row.ability_scores as AbilityScores,
    hpCurrent: row.hp_current as number,
    hpMax: row.hp_max as number,
    portraitUrl: row.portrait_url as string | undefined,
    isActive: row.is_active as boolean,
    extraLanguages: (row.extra_languages as string[] | undefined) ?? [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function mapCharacterWithNotesRow(row: CharacterRow): CharacterWithNotes {
  return {
    ...mapCharacterRow(row),
    notes: row.notes as string | undefined,
    sessionNotes: (row.session_notes as SessionNote[] | undefined) ?? [],
    peopleOfNote: (row.people_of_note as PersonOfNote[] | undefined) ?? [],
  };
}

/** camelCase field → DB column, for partial updates. */
const UPDATE_COLUMNS: Partial<Record<keyof CharacterWithNotes, string>> = {
  name: 'name',
  level: 'level',
  xp: 'xp',
  abilityScores: 'ability_scores',
  hpCurrent: 'hp_current',
  hpMax: 'hp_max',
  portraitUrl: 'portrait_url',
  isActive: 'is_active',
  extraLanguages: 'extra_languages',
  notes: 'notes',
  sessionNotes: 'session_notes',
  peopleOfNote: 'people_of_note',
};

export function characterUpdatesToRow(updates: Partial<CharacterWithNotes>): CharacterRow {
  const dbUpdates: CharacterRow = {};
  for (const [field, column] of Object.entries(UPDATE_COLUMNS)) {
    const value = updates[field as keyof CharacterWithNotes];
    if (value !== undefined) dbUpdates[column] = value;
  }
  return dbUpdates;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function listCharacters(
  supabase: SupabaseClient,
): Promise<{ characters: Character[]; error: string | null }> {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) return { characters: [], error: error.message };
  return { characters: (data ?? []).map(mapCharacterRow), error: null };
}

export async function fetchCharacter(
  supabase: SupabaseClient,
  id: string,
): Promise<Character | null> {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return mapCharacterRow(data as CharacterRow);
}

export async function fetchCharacterWithNotes(
  supabase: SupabaseClient,
  id: string,
): Promise<CharacterWithNotes | null> {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return mapCharacterWithNotesRow(data as CharacterRow);
}

export async function updateCharacter(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<CharacterWithNotes>,
): Promise<string | null> {
  const { error } = await supabase
    .from('characters')
    .update(characterUpdatesToRow(updates))
    .eq('id', id);
  return error ? error.message : null;
}

export async function deleteCharacter(
  supabase: SupabaseClient,
  id: string,
): Promise<string | null> {
  const { error } = await supabase.from('characters').delete().eq('id', id);
  return error ? error.message : null;
}

// ── Coins (live on the characters row) ────────────────────────────────────────

export interface Coins {
  gp: number;
  sp: number;
  cp: number;
}

export async function fetchCoins(
  supabase: SupabaseClient,
  characterId: string,
): Promise<Coins> {
  const { data } = await supabase
    .from('characters')
    .select('coins_gp, coins_sp, coins_cp')
    .eq('id', characterId)
    .single();
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    gp: (row.coins_gp as number) ?? 0,
    sp: (row.coins_sp as number) ?? 0,
    cp: (row.coins_cp as number) ?? 0,
  };
}

export async function saveCoins(
  supabase: SupabaseClient,
  characterId: string,
  coins: Coins,
): Promise<string | null> {
  const { error } = await supabase
    .from('characters')
    .update({ coins_gp: coins.gp, coins_sp: coins.sp, coins_cp: coins.cp })
    .eq('id', characterId);
  return error ? error.message : null;
}

// ── Creation (shared by the import page and the wizard complete page) ─────────

export interface NewCharacterInput {
  name: string;
  sex?: string | null;
  age?: string | null;
  height?: string | null;
  weight?: string | null;
  kindred: string;
  characterClass: string;
  alignment: string;
  background?: string | null;
  level?: number;
  xp?: number;
  abilityScores: AbilityScores;
  hpCurrent?: number;
  hpMax: number;
  portraitUrl?: string | null;
}

export async function createCharacter(
  supabase: SupabaseClient,
  ownerId: string,
  input: NewCharacterInput,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('characters')
    .insert({
      owner_id: ownerId,
      name: input.name,
      sex: input.sex || null,
      age: input.age || null,
      height: input.height || null,
      weight: input.weight || null,
      kindred: input.kindred,
      character_class: input.characterClass,
      alignment: input.alignment,
      background: input.background || null,
      level: input.level ?? 1,
      xp: input.xp ?? 0,
      ability_scores: input.abilityScores,
      hp_current: input.hpCurrent ?? input.hpMax,
      hp_max: input.hpMax,
      portrait_url: input.portraitUrl ?? null,
      is_active: true,
    })
    .select('id')
    .single();
  if (error) return { id: null, error: error.message };
  return { id: (data?.id as string) ?? null, error: null };
}
