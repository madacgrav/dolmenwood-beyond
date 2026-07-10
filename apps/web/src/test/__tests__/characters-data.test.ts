import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CharacterDoc } from '@/lib/cosmos/types';

import { store, fakeState, resetFake } from '@/test/cosmos-fake';

const docs = store('characters') as unknown as Map<string, CharacterDoc & { _etag: string }>;

vi.mock('@/lib/auth/session', () => ({
  requireAccountId: async () => 'me-1',
}));

vi.mock('@/lib/cosmos/client', async () => await import('@/test/cosmos-fake'));
import {
  createCharacter,
  listCharacters,
  fetchCharacterWithNotes,
  updateCharacter,
  deleteCharacter,
} from '@/lib/data/characters';
import { assertOwner, HttpError } from '@/lib/authz';
import { newCharacterToDoc } from '@/lib/data/mappers/character';

const INPUT = {
  name: 'Aldric',
  kindred: 'Human',
  characterClass: 'Fighter',
  alignment: 'lawful',
  abilityScores: { str: 12, int: 10, wis: 11, dex: 13, con: 14, cha: 9 },
  hpMax: 8,
};

beforeEach(() => resetFake());

describe('assertOwner', () => {
  it('rejects a mismatched owner with 403', () => {
    expect(() => assertOwner('me-1', 'someone-else')).toThrowError(HttpError);
    try {
      assertOwner('me-1', 'someone-else');
    } catch (e) {
      expect((e as HttpError).status).toBe(403);
    }
    expect(() => assertOwner('me-1', 'me-1')).not.toThrow();
  });
});

describe('character CRUD (owner-scoped)', () => {
  it('creates with ownerId from the session and lists it back', async () => {
    const { id } = await createCharacter(INPUT);
    expect(docs.get(id)!.ownerId).toBe('me-1');
    const list = await listCharacters();
    expect(list.map((c) => c.id)).toEqual([id]);
  });

  it("404s on a missing character and 403s on someone else's", async () => {
    await expect(fetchCharacterWithNotes('nope')).rejects.toMatchObject({ status: 404 });

    const other = newCharacterToDoc('someone-else', INPUT);
    docs.set(other.id, { ...other, _etag: 'etag-x' });
    await expect(fetchCharacterWithNotes(other.id)).rejects.toMatchObject({ status: 403 });
    await expect(updateCharacter(other.id, { name: 'Hax' })).rejects.toMatchObject({ status: 403 });
    await expect(deleteCharacter(other.id)).rejects.toMatchObject({ status: 403 });
    expect(docs.get(other.id)!.name).toBe('Aldric'); // untouched
  });

  it('applies whitelisted updates and ignores non-updatable fields', async () => {
    const { id } = await createCharacter(INPUT);
    await updateCharacter(id, {
      hpCurrent: 3,
      notes: 'wounded by a crookhorn',
      ownerId: 'evil-takeover',
    } as never);
    const doc = docs.get(id)!;
    expect(doc.hpCurrent).toBe(3);
    expect(doc.notes).toBe('wounded by a crookhorn');
    expect(doc.ownerId).toBe('me-1'); // ownerId is not in the update whitelist
  });

  it('retries a stale-ETag (412) replace against a fresh read and converges', async () => {
    const { id } = await createCharacter(INPUT);
    fakeState.failNextReplaceWith412 = true;
    await updateCharacter(id, { xp: 100 });
    expect(fakeState.replaceCalls).toBe(2); // first hits 412, retry succeeds
    expect(docs.get(id)!.xp).toBe(100);
  });
});
