/**
 * One-time seed: load Noble Houses from scripts/data/noble-houses.json into the
 * Cosmos `noble_houses` container. Idempotent (upsert by id).
 *
 * Usage:
 *   COSMOS_ENDPOINT=... COSMOS_KEY=... npx tsx scripts/seed-noble-houses.ts
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CosmosClient } from '@azure/cosmos';

const here = dirname(fileURLToPath(import.meta.url));

interface NobleHouse {
  id: string;
  name: string;
  alignment: string;
  domain: string;
  seat: string;
  head: string;
}

async function main() {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  if (!endpoint || !key) throw new Error('COSMOS_ENDPOINT and COSMOS_KEY must be set');

  const houses: NobleHouse[] = JSON.parse(
    readFileSync(join(here, 'data', 'noble-houses.json'), 'utf8'),
  );
  const container = new CosmosClient({ endpoint, key })
    .database('dolmenwood')
    .container('noble_houses');

  let upserted = 0;
  for (const h of houses) {
    await container.items.upsert(h);
    upserted++;
  }
  console.log(`upserted ${upserted} docs into Cosmos noble_houses`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
