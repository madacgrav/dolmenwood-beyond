import { describe, it, expect, vi, beforeEach } from 'vitest';

import { resetFake } from '@/test/cosmos-fake';

vi.mock('@/lib/auth/session', () => ({
  requireAccountId: async () => 'me-1',
}));

vi.mock('@/lib/cosmos/client', async () => await import('@/test/cosmos-fake'));
import { createCharacter } from '@/lib/data/characters';
import { addInventoryItem, listInventory } from '@/lib/data/inventory';
import { listLights, lightSource, burnTurn, extinguish } from '@/lib/data/light';

const INPUT = {
  name: 'Wyn',
  kindred: 'Breggle',
  characterClass: 'Hunter',
  alignment: 'neutral',
  abilityScores: { str: 13, int: 10, wis: 12, dex: 14, con: 12, cha: 9 },
  hpMax: 6,
};

beforeEach(() => resetFake());

describe('light tracker', () => {
  it('lighting consumes one item and starts a burn tracker', async () => {
    const { id } = await createCharacter(INPUT);
    const torch = await addInventoryItem(id, { item_name: 'Torch', item_type: 'gear', quantity: 2 });

    const lights = await lightSource(id, torch.id);
    expect(lights).toHaveLength(1);
    expect(lights[0]!.itemName).toBe('Torch');
    expect(lights[0]!.turnsRemaining).toBe(6);
    expect(lights[0]!.totalTurns).toBe(6);

    const items = await listInventory(id);
    expect(items.find(i => i.id === torch.id)!.quantity).toBe(1);
  });

  it('burns down turn by turn and floors at zero', async () => {
    const { id } = await createCharacter(INPUT);
    const torch = await addInventoryItem(id, { item_name: 'Torch', item_type: 'gear', quantity: 1 });
    const [light] = await lightSource(id, torch.id);

    await burnTurn(id, light!.id, 5);
    let lights = await listLights(id);
    expect(lights[0]!.turnsRemaining).toBe(1);

    await burnTurn(id, light!.id);
    await burnTurn(id, light!.id); // extra tap past zero
    lights = await listLights(id);
    expect(lights[0]!.turnsRemaining).toBe(0);
  });

  it('rejects lighting with none left, non-light items, and unknown ids', async () => {
    const { id } = await createCharacter(INPUT);
    const torch = await addInventoryItem(id, { item_name: 'Torch', item_type: 'gear', quantity: 1 });
    await lightSource(id, torch.id); // uses the last one
    await expect(lightSource(id, torch.id)).rejects.toMatchObject({ status: 400 });

    const rope = await addInventoryItem(id, { item_name: 'Rope', item_type: 'gear', quantity: 1 });
    await expect(lightSource(id, rope.id)).rejects.toMatchObject({ status: 400 });
    await expect(lightSource(id, 'nope')).rejects.toMatchObject({ status: 404 });
    await expect(burnTurn(id, 'nope')).rejects.toMatchObject({ status: 404 });
  });

  it('extinguish removes the light', async () => {
    const { id } = await createCharacter(INPUT);
    const oil = await addInventoryItem(id, { item_name: 'Oil Flask', item_type: 'gear', quantity: 1 });
    const [light] = await lightSource(id, oil.id);
    expect(light!.turnsRemaining).toBe(24);

    expect(await extinguish(id, light!.id)).toHaveLength(0);
    expect(await listLights(id)).toHaveLength(0);
  });
});
