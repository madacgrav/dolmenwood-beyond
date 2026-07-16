/**
 * One-time backfill (issue #38): removes the obsolete global `role` field
 * from every account document. Idempotent — upserts, and only touches docs
 * that still have the field. Run:
 *
 *   COSMOS_ENDPOINT=... COSMOS_KEY=... npx tsx scripts/strip-account-role.ts
 */
import { CosmosClient } from '@azure/cosmos';
import { stripRole } from './lib/transform';

async function main() {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  if (!endpoint || !key) throw new Error('COSMOS_ENDPOINT and COSMOS_KEY required');

  const container = new CosmosClient({ endpoint, key })
    .database('dolmenwood')
    .container('accounts');

  const { resources } = await container.items
    .query<Record<string, unknown>>('SELECT * FROM c WHERE IS_DEFINED(c.role)')
    .fetchAll();

  let updated = 0;
  for (const doc of resources) {
    await container.items.upsert(stripRole(doc));
    updated++;
  }
  console.log(`stripped role from ${updated} account doc(s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
