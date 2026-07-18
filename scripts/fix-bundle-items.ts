/**
 * One-time cleanup: convert bundle-shaped items ("Arrows (quiver of 20)",
 * "Quarrels (case of 20)") into per-unit rows.
 *
 * - catalog_items: where the name carries a bundle/numeric count, rename to
 *                  the canonical singular and divide weight by the count.
 * - characters:    for each embedded inventory entry with a counted name,
 *                  canonicalize the name, multiply quantity by the count and
 *                  divide weightCoins by it. Entries whose name only needs
 *                  alias-canonicalizing ("Arrows" -> "Arrow") are renamed so
 *                  restock merges find them.
 *
 * Dry-run by default; pass --apply to write.
 *
 * Usage:
 *   COSMOS_ENDPOINT=... COSMOS_KEY=... npx tsx --tsconfig apps/web/tsconfig.json scripts/fix-bundle-items.ts [--apply]
 *   (the tsconfig flag resolves the "@/..." path aliases consumables.ts uses)
 */
import { CosmosClient } from '@azure/cosmos';
import { parseCountSuffix } from '../apps/web/src/lib/inventory/parse-count';
import { canonicalName } from '../apps/web/src/lib/inventory/consumables';

interface CatalogDoc { id: string; itemType: string; name: string; weight: number; [k: string]: unknown }
interface InventoryEntry { itemName: string; quantity: number; weightCoins: number; [k: string]: unknown }
interface CharacterDoc { id: string; ownerId: string; name?: string; inventory?: InventoryEntry[]; [k: string]: unknown }

const round2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  if (!endpoint || !key) throw new Error('COSMOS_ENDPOINT and COSMOS_KEY must be set');
  const apply = process.argv.includes('--apply');

  const db = new CosmosClient({ endpoint, key }).database('dolmenwood');

  // --- catalog_items: rename bundles and divide weight down to per-unit ---
  const catalog = db.container('catalog_items');
  const { resources: catDocs } = await catalog.items
    .query<CatalogDoc>('SELECT * FROM c')
    .fetchAll();
  let catChanged = 0;
  for (const doc of catDocs) {
    const parsed = parseCountSuffix(doc.name);
    if (parsed.quantity === null) continue;
    const newName = canonicalName(doc.name);
    const newWeight = round2((doc.weight || 0) / parsed.quantity);
    console.log(
      `catalog: "${doc.name}" weight ${doc.weight} -> "${newName}" weight ${newWeight} (bundle of ${parsed.quantity})`,
    );
    catChanged++;
    if (apply) await catalog.items.upsert({ ...doc, name: newName, weight: newWeight });
  }

  // --- characters: split bundles into per-unit qty/weight; canonicalize names ---
  const characters = db.container('characters');
  const { resources: charDocs } = await characters.items
    .query<CharacterDoc>('SELECT * FROM c')
    .fetchAll();
  let invChanged = 0;
  for (const doc of charDocs) {
    let docDirty = false;
    for (const entry of doc.inventory ?? []) {
      const parsed = parseCountSuffix(entry.itemName);
      const canonical = canonicalName(entry.itemName);
      if (parsed.quantity !== null) {
        const newQty = Math.max(1, entry.quantity || 1) * parsed.quantity;
        const newWeight = round2((entry.weightCoins || 0) / parsed.quantity);
        console.log(
          `character ${doc.name ?? doc.id}: "${entry.itemName}" qty ${entry.quantity} weight ${entry.weightCoins} -> "${canonical}" qty ${newQty} weight ${newWeight}`,
        );
        entry.itemName = canonical;
        entry.quantity = newQty;
        entry.weightCoins = newWeight;
        docDirty = true;
        invChanged++;
      } else if (canonical !== entry.itemName) {
        console.log(
          `character ${doc.name ?? doc.id}: "${entry.itemName}" -> "${canonical}" (rename only)`,
        );
        entry.itemName = canonical;
        docDirty = true;
        invChanged++;
      }
    }
    if (docDirty && apply) {
      await characters.item(doc.id, doc.ownerId).replace(doc);
    }
  }

  const verb = apply ? 'changed' : 'would change';
  console.log(`\n${verb}: ${catChanged} catalog docs, ${invChanged} inventory rows${apply ? '' : ' (dry-run — pass --apply to write)'}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
