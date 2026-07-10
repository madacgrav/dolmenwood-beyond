import { getContainer } from '@/lib/cosmos/client';
import type { CatalogItemDoc } from '@/lib/cosmos/types';

/** Read-only equipment catalog (reference data, seeded once). Server-only. */
export async function listCatalogItems(): Promise<CatalogItemDoc[]> {
  const { resources } = await getContainer('catalog_items')
    .items.query<CatalogItemDoc>('SELECT * FROM c ORDER BY c.name')
    .fetchAll();
  return resources;
}
