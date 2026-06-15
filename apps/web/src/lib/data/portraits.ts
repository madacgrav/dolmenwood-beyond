import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Portrait upload helper for the character sheet header.
 *
 * Owns the storage upload + getPublicUrl + characters.update steps so the
 * header hook only deals with validation and UI state.
 *
 * The characters.update is kept as a direct call here (rather than delegating
 * to updateCharacter from './characters') to preserve the original
 * fire-and-forget behavior: the portrait column write is not error-checked,
 * matching the pre-refactor component exactly.
 */

export interface PortraitUploadResult {
  publicUrl: string | null;
  error: string | null;
}

export async function uploadPortrait(
  supabase: SupabaseClient,
  userId: string,
  characterId: string,
  file: File,
  ext: string,
): Promise<PortraitUploadResult> {
  const path = `${userId}/${characterId}/${Date.now()}.${ext}`;
  const { error: storageError } = await supabase.storage
    .from('portraits')
    .upload(path, file, { upsert: true });
  if (storageError) {
    console.error('Portrait upload failed:', storageError.message);
    return { publicUrl: null, error: 'Upload failed: ' + storageError.message };
  }
  const { data: urlData } = supabase.storage.from('portraits').getPublicUrl(path);
  const publicUrl = urlData.publicUrl;
  await supabase.from('characters').update({ portrait_url: publicUrl }).eq('id', characterId);
  return { publicUrl, error: null };
}
