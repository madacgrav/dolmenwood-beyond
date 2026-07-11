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
