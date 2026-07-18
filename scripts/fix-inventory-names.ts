/**
 * One-time cleanup: split counts baked into item names ("Torches (3)",
 * "Bag of marbles x 2") into a clean name + quantity.
 *
 * - catalog_items: cleans the name only (the catalog has no quantity field).
 * - characters:    cleans each embedded inventory entry's itemName and
 *                  multiplies its quantity by the parsed count.
 *
 * Dry-run by default; pass --apply to write.
 *
 * Usage:
 *   COSMOS_ENDPOINT=... COSMOS_KEY=... npx tsx scripts/fix-inventory-names.ts [--apply]
 */
import { CosmosClient } from '@azure/cosmos';
import { parseCountSuffix } from '../apps/web/src/lib/inventory/parse-count';

interface CatalogDoc { id: string; itemType: string; name: string; [k: string]: unknown }
interface InventoryEntry { itemName: string; quantity: number; [k: string]: unknown }
interface CharacterDoc { id: string; ownerId: string; name?: string; inventory?: InventoryEntry[]; [k: string]: unknown }

async function main() {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  if (!endpoint || !key) throw new Error('COSMOS_ENDPOINT and COSMOS_KEY must be set');
  const apply = process.argv.includes('--apply');

  const db = new CosmosClient({ endpoint, key }).database('dolmenwood');

  // --- catalog_items: clean baked counts out of names ---
  const catalog = db.container('catalog_items');
  const { resources: catDocs } = await catalog.items
    .query<CatalogDoc>('SELECT * FROM c')
    .fetchAll();
  let catChanged = 0;
  for (const doc of catDocs) {
    const parsed = parseCountSuffix(doc.name);
    if (parsed.quantity === null || parsed.name === doc.name) continue;
    console.log(`catalog: "${doc.name}" -> "${parsed.name}" (count ${parsed.quantity} dropped from name)`);
    catChanged++;
    if (apply) await catalog.items.upsert({ ...doc, name: parsed.name });
  }

  // --- characters: clean embedded inventory entries, folding count into quantity ---
  const characters = db.container('characters');
  const { resources: charDocs } = await characters.items
    .query<CharacterDoc>('SELECT * FROM c')
    .fetchAll();
  let invChanged = 0;
  for (const doc of charDocs) {
    let docDirty = false;
    for (const entry of doc.inventory ?? []) {
      const parsed = parseCountSuffix(entry.itemName);
      if (parsed.quantity === null || parsed.name === entry.itemName) continue;
      const newQty = Math.max(1, entry.quantity || 1) * parsed.quantity;
      console.log(
        `character ${doc.name ?? doc.id}: "${entry.itemName}" qty ${entry.quantity} -> "${parsed.name}" qty ${newQty}`,
      );
      entry.itemName = parsed.name;
      entry.quantity = newQty;
      docDirty = true;
      invChanged++;
    }
    if (docDirty && apply) {
      await characters.item(doc.id, doc.ownerId).replace(doc);
    }
  }

  const verb = apply ? 'changed' : 'would change';
  console.log(`\n${verb}: ${catChanged} catalog names, ${invChanged} inventory rows${apply ? '' : ' (dry-run — pass --apply to write)'}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
