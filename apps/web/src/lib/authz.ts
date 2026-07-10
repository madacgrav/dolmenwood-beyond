import { getContainer } from '@/lib/cosmos/client';
import type { CharacterDoc } from '@/lib/cosmos/types';

/**
 * Authorization helpers — the app-code port of the RLS predicates.
 * With Cosmos there is no row-level security: every server data function
 * must call one of these before reading or mutating on a caller's behalf.
 */

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const forbidden = () => new HttpError(403, 'Forbidden');
export const notFound = (what = 'resource') => new HttpError(404, `${what} not found`);
export const badRequest = (message: string) => new HttpError(400, message);

/** Port of the `auth.uid() = owner_id` RLS predicate. */
export function assertOwner(accountId: string, ownerId: string): void {
  if (accountId !== ownerId) throw forbidden();
}

/**
 * Characters are partitioned by /ownerId, so looking one up by id alone is
 * a cross-partition query. Callers that already know the owner should
 * point-read instead.
 */
export async function fetchCharacterDocById(characterId: string): Promise<CharacterDoc | null> {
  const { resources } = await getContainer('characters')
    .items.query<CharacterDoc>({
      query: 'SELECT * FROM c WHERE c.id = @id',
      parameters: [{ name: '@id', value: characterId }],
    })
    .fetchAll();
  return resources[0] ?? null;
}

/** 404 if the character doesn't exist, 403 if it belongs to someone else. */
export async function assertCharacterOwner(
  accountId: string,
  characterId: string,
): Promise<CharacterDoc> {
  const doc = await fetchCharacterDocById(characterId);
  if (!doc) throw notFound('character');
  assertOwner(accountId, doc.ownerId);
  return doc;
}
