/**
 * One-time seed: copy catalog_items from Supabase Postgres into the Cosmos
 * `catalog_items` container. Idempotent (upsert by id).
 *
 * Usage:
 *   SUPABASE_DB_URL=postgresql://... COSMOS_ENDPOINT=... COSMOS_KEY=... \
 *     npx tsx scripts/seed-catalog.ts
 *
 * SUPABASE_DB_URL defaults to the local Supabase CLI database.
 */
import { Client } from 'pg';
import { CosmosClient } from '@azure/cosmos';

const DB_URL =
  process.env.SUPABASE_DB_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

interface CatalogRow {
  id: string;
  name: string;
  item_type: string;
  weight: number | null;
  cost_gp: string | number | null;
  cost_sp: string | number | null;
  cost_cp: string | number | null;
  weapon_damage_dice: string | null;
  armor_ac_bonus: number | null;
  qualities: string[] | null;
  size: string | null;
  notes: string | null;
}

const num = (v: string | number | null): number | null =>
  v == null ? null : Number(v);

async function main() {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  if (!endpoint || !key) throw new Error('COSMOS_ENDPOINT and COSMOS_KEY must be set');

  const pg = new Client({ connectionString: DB_URL });
  await pg.connect();
  // distinct on (name): local dev has each item twice (migration 000002 seeds
  // the catalog and seed.sql seeds it again on db reset with fresh UUIDs).
  const { rows } = await pg.query<CatalogRow>(
    'select distinct on (name) * from public.catalog_items order by name, id',
  );
  await pg.end();
  console.log(`read ${rows.length} catalog_items from Postgres`);

  const container = new CosmosClient({ endpoint, key })
    .database('dolmenwood')
    .container('catalog_items');

  let upserted = 0;
  for (const r of rows) {
    await container.items.upsert({
      id: r.id,
      itemType: r.item_type,
      name: r.name,
      weight: r.weight ?? 0,
      costGp: num(r.cost_gp),
      costSp: num(r.cost_sp),
      costCp: num(r.cost_cp),
      weaponDamageDice: r.weapon_damage_dice,
      armorAcBonus: r.armor_ac_bonus,
      qualities: r.qualities ?? [],
      size: r.size,
      notes: r.notes,
    });
    upserted++;
  }
  console.log(`upserted ${upserted} docs into Cosmos catalog_items`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
