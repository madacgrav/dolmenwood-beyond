import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CharacterDoc } from '@/lib/cosmos/types';

/** Same in-memory ETag-aware container fake as characters-data.test.ts. */
const docs = new Map<string, CharacterDoc & { _etag: string }>();
let etagCounter = 0;

vi.mock('@/lib/auth/session', () => ({
  requireAccountId: async () => 'me-1',
}));

vi.mock('@/lib/cosmos/client', () => ({
  getContainer: () => ({
    item: (id: string, partitionKey?: string) => ({
      // Point reads are partition-scoped in real Cosmos: a doc in another
      // owner's partition is invisible (404), not returned.
      // Clone on read: real Cosmos returns fresh deserialized objects, so
      // mutations on a read doc never leak into the store before replace.
      read: async () => {
        const doc = docs.get(id);
        return { resource: doc && doc.ownerId === partitionKey ? structuredClone(doc) : undefined };
      },
      replace: async (
        doc: CharacterDoc,
        opts?: { accessCondition?: { type: string; condition: string } },
      ) => {
        const stored = docs.get(doc.id);
        if (!stored) throw Object.assign(new Error('not found'), { code: 404 });
        if (opts?.accessCondition && opts.accessCondition.condition !== stored._etag) {
          throw Object.assign(new Error('precondition failed'), { code: 412 });
        }
        const next = { ...doc, _etag: `etag-${++etagCounter}` };
        docs.set(doc.id, next);
        return { resource: next };
      },
      delete: async () => {
        docs.delete(id);
      },
    }),
    items: {
      create: async (doc: CharacterDoc) => {
        const next = { ...doc, _etag: `etag-${++etagCounter}` };
        docs.set(doc.id, next);
        return { resource: next };
      },
      query: (q: { query: string; parameters: { name: string; value: unknown }[] }) => ({
        fetchAll: async () => {
          const param = (n: string) => q.parameters.find((p) => p.name === n)?.value;
          const all = [...docs.values()].map((d) => structuredClone(d));
          if (q.query.includes('c.id = @id')) {
            return { resources: all.filter((d) => d.id === param('@id')) };
          }
          if (q.query.includes('c.ownerId = @me')) {
            return { resources: all.filter((d) => d.ownerId === param('@me')) };
          }
          return { resources: all };
        },
      }),
    },
  }),
}));

import { createCharacter, listCharactersWithArmor } from '@/lib/data/characters';
import {
  listInventory,
  addInventoryItem,
  updateInventoryEntry,
  removeInventoryItem,
} from '@/lib/data/inventory';
import { fetchMagicData, applyMagicOp } from '@/lib/data/spells';
import type { DBSpellSlot, DBPreparation } from '@/lib/api/spells';

const INPUT = {
  name: 'Aldric',
  kindred: 'Human',
  characterClass: 'Magician',
  alignment: 'neutral',
  abilityScores: { str: 12, int: 16, wis: 11, dex: 13, con: 14, cha: 9 },
  hpMax: 4,
};

beforeEach(() => docs.clear());

describe('embedded inventory', () => {
  it('adds, patches, and removes entries inside the character doc', async () => {
    const { id } = await createCharacter(INPUT);

    const sword = await addInventoryItem(id, {
      item_name: 'Longsword',
      item_type: 'weapon',
      weight_coins: 30,
      location: 'equipped',
      weapon_damage_dice: '1d8',
    });
    await addInventoryItem(id, { item_name: 'Rope', item_type: 'gear', quantity: 1 });

    expect(docs.get(id)!.inventory).toHaveLength(2);

    await updateInventoryEntry(id, sword.id, { location: 'stowed' });
    await updateInventoryEntry(id, sword.id, { quantity: 2 });
    const items = await listInventory(id);
    const stored = items.find((i) => i.id === sword.id)!;
    expect(stored.location).toBe('stowed');
    expect(stored.quantity).toBe(2);
    expect(stored.character_id).toBe(id);

    await removeInventoryItem(id, sword.id);
    expect((await listInventory(id)).map((i) => i.item_name)).toEqual(['Rope']);
  });

  it('rejects unknown item ids and invalid locations', async () => {
    const { id } = await createCharacter(INPUT);
    await expect(updateInventoryEntry(id, 'nope', { quantity: 1 })).rejects.toMatchObject({ status: 404 });
    const item = await addInventoryItem(id, { item_name: 'Lantern', item_type: 'gear' });
    await expect(
      updateInventoryEntry(id, item.id, { location: 'backpack' as never }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('computes equipped armor bonuses for the roster from embedded entries', async () => {
    const { id } = await createCharacter(INPUT);
    await addInventoryItem(id, { item_name: 'Chainmail', item_type: 'armour', armor_ac_bonus: 4, location: 'equipped' });
    await addInventoryItem(id, { item_name: 'Shield', item_type: 'armour', armor_ac_bonus: 1, location: 'equipped' });
    await addInventoryItem(id, { item_name: 'Spare helm', item_type: 'armour', armor_ac_bonus: 2, location: 'stowed' });

    const { armorByCharacter } = await listCharactersWithArmor();
    expect(armorByCharacter[id]).toBe(5); // stowed helm not counted
  });
});

describe('embedded spell tracking', () => {
  it('initialises slots once; second init reports alreadyInitialized (old 23505 race)', async () => {
    const { id } = await createCharacter(INPUT);
    const first = (await applyMagicOp(id, {
      op: 'initSlots',
      slots: [{ spell_rank: 1, slots_total: 2 }, { spell_rank: 2, slots_total: 1 }],
    })) as { slots: DBSpellSlot[] };
    expect(first.slots).toHaveLength(2);

    const second = (await applyMagicOp(id, {
      op: 'initSlots',
      slots: [{ spell_rank: 1, slots_total: 99 }],
    })) as { alreadyInitialized?: boolean; slots: DBSpellSlot[] };
    expect(second.alreadyInitialized).toBe(true);
    expect(second.slots).toHaveLength(2); // untouched
  });

  it('tracks preparations, casting, and rest', async () => {
    const { id } = await createCharacter(INPUT);
    const { slots } = (await applyMagicOp(id, {
      op: 'initSlots',
      slots: [{ spell_rank: 1, slots_total: 2 }],
    })) as { slots: DBSpellSlot[] };

    const prep = (await applyMagicOp(id, {
      op: 'addPreparation',
      slot_rank: 1,
      spell_name: 'Sleep',
    })) as DBPreparation;
    await applyMagicOp(id, { op: 'setPreparationCast', prepId: prep.id, is_cast: true });
    await applyMagicOp(id, { op: 'updateSlotUsage', slotId: slots[0]!.id, slots_used: 1 });

    let magic = await fetchMagicData(id);
    expect(magic.preparations[0]!.is_cast).toBe(true);
    expect(magic.slots[0]!.slots_used).toBe(1);

    await applyMagicOp(id, { op: 'rest' });
    magic = await fetchMagicData(id);
    expect(magic.preparations).toHaveLength(0);
    expect(magic.slots[0]!.slots_used).toBe(0);
  });

  it('slot usage clamps to the total; spellbook add/memorize/delete works', async () => {
    const { id } = await createCharacter(INPUT);
    const { slots } = (await applyMagicOp(id, {
      op: 'initSlots',
      slots: [{ spell_rank: 1, slots_total: 2 }],
    })) as { slots: DBSpellSlot[] };

    await applyMagicOp(id, { op: 'updateSlotUsage', slotId: slots[0]!.id, slots_used: 99 });
    expect((await fetchMagicData(id)).slots[0]!.slots_used).toBe(2); // clamped

    const spell = (await applyMagicOp(id, {
      op: 'addSpell',
      spell_name: 'Magic Missile',
      spell_level: 1,
    })) as { id: string };
    await applyMagicOp(id, { op: 'setSpellMemorized', spellId: spell.id, is_memorized: true });
    expect((await fetchMagicData(id)).spells[0]!.is_memorized).toBe(true);

    await applyMagicOp(id, { op: 'deleteSpell', spellId: spell.id });
    expect((await fetchMagicData(id)).spells).toHaveLength(0);
  });
});
