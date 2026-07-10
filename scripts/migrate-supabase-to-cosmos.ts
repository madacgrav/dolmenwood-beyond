/**
 * One-time Supabase → Cosmos data migration. Idempotent (upserts by id) —
 * safe to re-run. Also copies portrait binaries from the public Supabase
 * bucket into Azure Blob Storage, rewriting portraitUrl (skipped with a
 * warning if BLOB_CONNECTION_STRING is unset or a download fails).
 *
 * Usage:
 *   SUPABASE_DB_URL=postgresql://... COSMOS_ENDPOINT=... COSMOS_KEY=... \
 *   [BLOB_CONNECTION_STRING=...] npx tsx scripts/migrate-supabase-to-cosmos.ts
 *
 * Credentials are NOT migrated (design decision #8): every account lands
 * with passwordHash=null + requiresPasswordReset=true and goes through
 * the password-reset flow at cutover.
 */
import { Client } from 'pg';
import { CosmosClient } from '@azure/cosmos';
import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob';
import {
  toAccountDoc,
  toCharacterDoc,
  toCampaignDoc,
  toNotificationDoc,
} from './lib/transform';

type Row = Record<string, unknown>;

const byKey = (rows: Row[], key: string): Map<string, Row[]> => {
  const map = new Map<string, Row[]>();
  for (const r of rows) {
    const k = String(r[key]);
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return map;
};

async function migratePortrait(
  blob: ContainerClient,
  ownerId: string,
  characterId: string,
  url: string,
): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    const path = `${ownerId}/${characterId}/migrated-${Date.now()}.${ext}`;
    const client = blob.getBlockBlobClient(path);
    await client.uploadData(bytes, { blobHTTPHeaders: { blobContentType: contentType } });
    return client.url;
  } catch (e) {
    console.warn(`  ⚠ portrait copy failed for ${characterId}: ${e} — keeping old URL`);
    return null;
  }
}

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  if (!dbUrl || !endpoint || !key) {
    throw new Error('SUPABASE_DB_URL, COSMOS_ENDPOINT, and COSMOS_KEY must be set');
  }
  const blobConn = process.env.BLOB_CONNECTION_STRING;
  const portraitsBlob = blobConn
    ? BlobServiceClient.fromConnectionString(blobConn).getContainerClient('portraits')
    : null;
  if (!portraitsBlob) console.warn('⚠ BLOB_CONNECTION_STRING unset — portrait binaries not copied');

  const pg = new Client({ connectionString: dbUrl });
  await pg.connect();
  const q = async (sql: string): Promise<Row[]> => (await pg.query(sql)).rows;

  console.log('reading Supabase…');
  const [
    accounts, characters, characterInventory, spellSlots, spellPreparations,
    bankLedger, levelUpLogs, mounts, retainers,
    campaigns, campaignMembers, campaignSessions, sessionRsvps,
    dateProposals, proposalAvailability,
    notifications, notificationDeliveries,
    legacyInventoryItems, characterCampaignData,
  ] = await Promise.all([
    q('select * from public.accounts'),
    q('select * from public.characters'),
    q('select * from public.character_inventory'),
    q('select * from public.spell_slots'),
    q('select * from public.spell_preparations'),
    q('select * from public.bank_ledger'),
    q('select * from public.level_up_logs'),
    q('select * from public.mounts'),
    q('select * from public.retainers'),
    q('select * from public.campaigns'),
    q('select * from public.campaign_members'),
    q('select * from public.campaign_sessions'),
    q('select * from public.session_rsvps'),
    q('select * from public.date_proposals'),
    q('select * from public.proposal_availability'),
    q('select * from public.notifications'),
    q('select * from public.notification_deliveries'),
    q('select * from public.inventory_items'),
    q('select * from public.character_campaign_data'),
  ]);
  await pg.end();

  // Not migrated: the app reads neither table (inventory_items was
  // superseded by character_inventory; character_campaign_data is dead).
  if (legacyInventoryItems.length > 0) {
    console.warn(`⚠ skipping ${legacyInventoryItems.length} legacy inventory_items row(s)`);
  }
  if (characterCampaignData.length > 0) {
    console.warn(`⚠ skipping ${characterCampaignData.length} character_campaign_data row(s)`);
  }

  const db = new CosmosClient({ endpoint, key }).database('dolmenwood');

  // ── accounts ────────────────────────────────────────────────────────────────
  console.log(`accounts: ${accounts.length}`);
  for (const row of accounts) {
    await db.container('accounts').items.upsert(toAccountDoc(row));
  }

  // ── characters (assemble the aggregate) ─────────────────────────────────────
  const invByChar = byKey(characterInventory, 'character_id');
  const slotsByChar = byKey(spellSlots, 'character_id');
  const prepsByChar = byKey(spellPreparations, 'character_id');
  const ledgerByChar = byKey(bankLedger, 'character_id');
  const logsByChar = byKey(levelUpLogs, 'character_id');
  const retainersByChar = byKey(retainers, 'owner_character_id');
  const charMounts = mounts.filter((m) => m.owner_type === 'character');
  // character mounts link via character_id (added migration 017) with
  // owner_id as the legacy fallback (the app wrote both as the character id)
  const mountsByChar = new Map<string, Row[]>();
  for (const m of charMounts) {
    const k = String(m.character_id ?? m.owner_id);
    mountsByChar.set(k, [...(mountsByChar.get(k) ?? []), m]);
  }

  console.log(`characters: ${characters.length}`);
  let portraitsCopied = 0;
  for (const row of characters) {
    const id = String(row.id);
    const doc = toCharacterDoc(row, {
      inventory: invByChar.get(id) ?? [],
      spellSlots: slotsByChar.get(id) ?? [],
      spellPreparations: prepsByChar.get(id) ?? [],
      bankLedger: ledgerByChar.get(id) ?? [],
      levelUpLogs: logsByChar.get(id) ?? [],
      mounts: mountsByChar.get(id) ?? [],
      retainers: retainersByChar.get(id) ?? [],
    });
    if (portraitsBlob && doc.portraitUrl && doc.portraitUrl.includes('supabase')) {
      const migrated = await migratePortrait(portraitsBlob, doc.ownerId, doc.id, doc.portraitUrl);
      if (migrated) {
        doc.portraitUrl = migrated;
        portraitsCopied++;
      }
    }
    await db.container('characters').items.upsert(doc);
  }

  // ── campaigns ────────────────────────────────────────────────────────────────
  const membersByCampaign = byKey(campaignMembers, 'campaign_id');
  const sessionsByCampaign = byKey(campaignSessions, 'campaign_id');
  const proposalsByCampaign = byKey(dateProposals, 'campaign_id');
  const partyMounts = mounts.filter((m) => m.owner_type === 'party');
  const partyMountsByCampaign = byKey(partyMounts, 'campaign_id');

  console.log(`campaigns: ${campaigns.length}`);
  for (const row of campaigns) {
    const id = String(row.id);
    const doc = toCampaignDoc(row, {
      members: membersByCampaign.get(id) ?? [],
      sessions: sessionsByCampaign.get(id) ?? [],
      rsvps: sessionRsvps,
      proposals: proposalsByCampaign.get(id) ?? [],
      availability: proposalAvailability,
      partyMounts: partyMountsByCampaign.get(id) ?? [],
    });
    await db.container('campaigns').items.upsert(doc);
  }

  // ── notifications ────────────────────────────────────────────────────────────
  const deliveriesByNotification = byKey(notificationDeliveries, 'notification_id');
  console.log(`notifications: ${notifications.length}`);
  for (const row of notifications) {
    const doc = toNotificationDoc(row, deliveriesByNotification.get(String(row.id)) ?? []);
    await db.container('notifications').items.upsert(doc);
  }

  // ── reconcile ────────────────────────────────────────────────────────────────
  console.log('\nreconciling…');
  const count = async (name: string): Promise<number> => {
    const { resources } = await db
      .container(name)
      .items.query('SELECT VALUE COUNT(1) FROM c')
      .fetchAll();
    return resources[0] as number;
  };
  const report = [
    ['accounts', accounts.length, await count('accounts')],
    ['characters', characters.length, await count('characters')],
    ['campaigns', campaigns.length, await count('campaigns')],
    ['notifications', notifications.length, await count('notifications')],
  ] as const;
  let ok = true;
  for (const [name, source, cosmos] of report) {
    const match = cosmos >= source; // ≥: containers may hold post-migration app writes
    if (!match) ok = false;
    console.log(`  ${name}: source ${source} → cosmos ${cosmos} ${match ? '✓' : '✗ MISMATCH'}`);
  }
  console.log(`  embedded: inventory ${characterInventory.length}, slots ${spellSlots.length}, preps ${spellPreparations.length}, ledger ${bankLedger.length}, logs ${levelUpLogs.length}, mounts ${mounts.length}, retainers ${retainers.length}`);
  console.log(`  sessions ${campaignSessions.length} (+${sessionRsvps.length} rsvps), proposals ${dateProposals.length} (+${proposalAvailability.length} availability), deliveries ${notificationDeliveries.length}`);
  if (portraitsBlob) console.log(`  portraits copied to Blob: ${portraitsCopied}`);

  if (!ok) {
    console.error('\nRECONCILIATION FAILED');
    process.exit(1);
  }
  console.log('\nmigration complete ✓ (all accounts require a password reset)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
