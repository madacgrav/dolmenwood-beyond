import { BlobServiceClient } from '@azure/storage-blob';
import { requireAccountId } from '@/lib/auth/session';
import { assertCharacterOwner, badRequest } from '@/lib/authz';
import { mutateOwnedCharacterDoc } from './characters';

/**
 * Server-only portrait upload to Azure Blob Storage (public-read
 * `portraits` container, mirroring the old Supabase bucket). The blob
 * path is built from the session account id — the caller can't write
 * outside their own prefix, which is the port of the storage RLS
 * `(storage.foldername(name))[1] = auth.uid()` policy.
 *
 * The portraitUrl write onto the character doc is kept fire-and-forget,
 * matching the pre-migration contract (the caller also PATCHes it).
 */

const ALLOWED_EXTENSIONS = new Set(['jpg', 'png', 'webp', 'gif']);

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

function portraitsContainer() {
  const connectionString = process.env.BLOB_CONNECTION_STRING;
  if (!connectionString) throw new Error('BLOB_CONNECTION_STRING must be set');
  return BlobServiceClient.fromConnectionString(connectionString).getContainerClient('portraits');
}

export async function uploadPortrait(
  characterId: string,
  file: { bytes: Buffer; ext: string },
): Promise<{ publicUrl: string }> {
  const me = await requireAccountId();
  await assertCharacterOwner(me, characterId);
  if (!ALLOWED_EXTENSIONS.has(file.ext)) throw badRequest('unsupported image type');

  const path = `${me}/${characterId}/${Date.now()}.${file.ext}`;
  const blob = portraitsContainer().getBlockBlobClient(path);
  await blob.uploadData(file.bytes, {
    blobHTTPHeaders: { blobContentType: CONTENT_TYPES[file.ext] },
  });

  const publicUrl = blob.url;
  // Fire-and-forget, preserving the original behavior.
  mutateOwnedCharacterDoc(characterId, (doc) => {
    doc.portraitUrl = publicUrl;
  }).catch((e) => console.error('portrait url write failed:', e));

  return { publicUrl };
}
