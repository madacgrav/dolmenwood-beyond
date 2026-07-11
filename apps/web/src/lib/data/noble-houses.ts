import { getContainer } from '@/lib/cosmos/client';
import { requireAccountId } from '@/lib/auth/session';
import type { NobleHouseDoc } from '@/lib/cosmos/types';

/** Read-only Noble Houses reference data (seeded once). Signed-in only. Server-only. */
export async function listNobleHouses(): Promise<NobleHouseDoc[]> {
  await requireAccountId();
  const { resources } = await getContainer('noble_houses')
    .items.query<NobleHouseDoc>('SELECT * FROM c ORDER BY c.name')
    .fetchAll();
  return resources;
}

export async function getNobleHouse(id: string): Promise<NobleHouseDoc | null> {
  await requireAccountId();
  try {
    const { resource } = await getContainer('noble_houses')
      .item(id, id) // partition key /id === document id
      .read<NobleHouseDoc>();
    return resource ?? null;
  } catch (e) {
    if ((e as { code?: number }).code === 404) return null;
    throw e;
  }
}
