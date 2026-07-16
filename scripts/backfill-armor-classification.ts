/**
 * One-time backfill: stamp isShield/armorBulk onto existing armour items —
 * both `catalog_items` docs and the inventory entries embedded in every
 * `characters` doc. Classification comes from a name→bulk map derived from
 * the rules-engine equipment.json armour table.
 *
 * Dry-run by default: prints the proposed assignments (plus UNMATCHED names
 * and SUSPECT armorAcBonus >= 10, likely absolute-AC values) and writes
 * nothing. Re-running after --apply reports zero pending. Usage:
 *
 *   COSMOS_ENDPOINT=... COSMOS_KEY=... npx tsx scripts/backfill-armor-classification.ts [--apply]
 */
import { CosmosClient } from '@azure/cosmos';
import equipment from '../packages/rules-engine/src/data/equipment.json';

type ArmorBulk = 'none' | 'light' | 'medium' | 'heavy';
interface Classification {
  isShield: boolean;
  armorBulk: ArmorBulk | null;
}

// Catalog names drift from equipment.json ("Chain mail armour" vs "Chainmail",
// "Plate armour" vs "Plate mail") — normalise by dropping armour/mail filler.
const normalise = (name: string): string =>
  name
    .toLowerCase()
    .replace(/armour|armor|mail/g, '') // substring, not word-bounded: "Chainmail" ≡ "Chain mail"
    .replace(/[^a-z]/g, '');

const BULK_BY_NAME = new Map<string, ArmorBulk>(
  (equipment.armour as { name: string; bulk: string }[]).map((a) => [
    normalise(a.name),
    a.bulk.toLowerCase() as ArmorBulk,
  ]),
);

function classify(name: string): Classification {
  if (name.toLowerCase().includes('shield')) return { isShield: true, armorBulk: 'none' };
  return { isShield: false, armorBulk: BULK_BY_NAME.get(normalise(name)) ?? null };
}

const isArmorish = (itemType: string | null | undefined, acBonus: number | null | undefined) =>
  itemType === 'armor' || itemType === 'armour' || acBonus != null;

interface Row {
  source: string;
  name: string;
  acBonus: number | null;
  proposed: Classification;
  pending: boolean;
  flags: string;
}

function buildRow(
  source: string,
  name: string,
  acBonus: number | null,
  current: { isShield?: boolean | null; armorBulk?: ArmorBulk | null },
): Row {
  const proposed = classify(name);
  const pending =
    (current.isShield ?? false) !== proposed.isShield ||
    (current.armorBulk ?? null) !== proposed.armorBulk;
  const flags = [
    !proposed.isShield && proposed.armorBulk === null ? 'UNMATCHED' : '',
    (acBonus ?? 0) >= 10 ? 'SUSPECT-AC' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return { source, name, acBonus, proposed, pending, flags };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  if (!endpoint || !key) throw new Error('COSMOS_ENDPOINT and COSMOS_KEY must be set');

  const db = new CosmosClient({ endpoint, key }).database('dolmenwood');
  const rows: Row[] = [];

  // ── catalog_items ────────────────────────────────────────────────────────
  const catalog = db.container('catalog_items');
  const { resources: catDocs } = await catalog.items
    .query<{
      id: string;
      itemType: string;
      name: string;
      armorAcBonus: number | null;
      isShield?: boolean;
      armorBulk?: ArmorBulk | null;
    }>('SELECT * FROM c')
    .fetchAll();

  for (const doc of catDocs) {
    if (!isArmorish(doc.itemType, doc.armorAcBonus)) continue;
    const row = buildRow('catalog', doc.name, doc.armorAcBonus, doc);
    rows.push(row);
    if (apply && row.pending) {
      await catalog.items.upsert({ ...doc, ...row.proposed });
    }
  }

  // ── characters (embedded inventory) ──────────────────────────────────────
  const characters = db.container('characters');
  const { resources: charDocs } = await characters.items
    .query<{
      id: string;
      ownerId: string;
      name: string;
      inventory?: {
        itemName: string;
        itemType: string;
        armorAcBonus: number | null;
        isShield?: boolean;
        armorBulk?: ArmorBulk | null;
      }[];
    }>('SELECT * FROM c')
    .fetchAll();

  for (const doc of charDocs) {
    let docPending = false;
    for (const entry of doc.inventory ?? []) {
      if (!isArmorish(entry.itemType, entry.armorAcBonus)) continue;
      const row = buildRow(`character:${doc.name}`, entry.itemName, entry.armorAcBonus, entry);
      rows.push(row);
      if (row.pending) {
        docPending = true;
        entry.isShield = row.proposed.isShield;
        entry.armorBulk = row.proposed.armorBulk;
      }
    }
    if (apply && docPending) {
      await characters.item(doc.id, doc.ownerId).replace(doc);
    }
  }

  // ── report ────────────────────────────────────────────────────────────────
  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(
    pad('SOURCE', 28) + pad('NAME', 24) + pad('AC', 5) + pad('BULK', 8) + pad('SHIELD', 8) + 'FLAGS',
  );
  for (const r of rows) {
    console.log(
      pad(r.source, 28) +
        pad(r.name, 24) +
        pad(String(r.acBonus ?? '-'), 5) +
        pad(String(r.proposed.armorBulk ?? 'null'), 8) +
        pad(r.proposed.isShield ? 'yes' : 'no', 8) +
        (r.flags || (r.pending ? 'pending' : 'ok')),
    );
  }
  const pending = rows.filter((r) => r.pending).length;
  const unmatched = rows.filter((r) => r.flags.includes('UNMATCHED')).length;
  const suspect = rows.filter((r) => r.flags.includes('SUSPECT-AC')).length;
  console.log(
    `\n${rows.length} armour items — ${pending} pending, ${unmatched} unmatched, ${suspect} suspect` +
      (apply ? ' (applied)' : ' (dry-run; pass --apply to write)'),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
