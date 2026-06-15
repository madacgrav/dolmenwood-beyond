import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Single source of truth for `accounts` rows and account-level data
 * operations (display name, deletion) plus the character-export query.
 *
 * Rows are kept as the narrow shape the settings UI consumes; the
 * `supabase` client is always the first parameter, matching the rest
 * of the data layer.
 */

export type Account = {
  display_name: string;
  email: string;
  role: string;
  invite_code: string;
};

export async function fetchAccount(
  supabase: SupabaseClient,
  userId: string,
): Promise<Account | null> {
  const { data } = await supabase
    .from('accounts')
    .select('display_name, email, role, invite_code')
    .eq('id', userId)
    .single();
  return (data as Account) ?? null;
}

export async function updateDisplayName(
  supabase: SupabaseClient,
  userId: string,
  displayName: string,
): Promise<string | null> {
  const { error } = await supabase
    .from('accounts')
    .update({ display_name: displayName })
    .eq('id', userId);
  return error ? error.message : null;
}

export async function deleteAccount(
  supabase: SupabaseClient,
): Promise<string | null> {
  const { error } = await supabase.rpc('delete_my_account');
  return error ? error.message : null;
}

/** Characters plus nested inventory/spell data, for the JSON export. */
export async function fetchCharactersForExport(
  supabase: SupabaseClient,
): Promise<{ characters: unknown[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('characters')
    .select('*, character_inventory(*), spell_slots(*), spell_preparations(*)');
  if (error) return { characters: null, error: error.message };
  return { characters: data ?? null, error: null };
}
