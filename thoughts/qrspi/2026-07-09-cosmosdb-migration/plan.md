# Implementation Plan — Supabase → Azure Cosmos DB

## Overview

Full cutover from Supabase (Postgres + RLS + Auth + Storage + Realtime) to Azure Cosmos DB for NoSQL with account-partitioned aggregate documents, Auth.js self-hosted auth, a server-side data tier enforcing authorization per request, app-layer transactions, Azure Blob for portraits, and Cosmos change feed → Azure SignalR for live HP. A `USE_COSMOS` env flag gates the dual-run seam so phases land incrementally.

**Commands** (run from repo root): `pnpm typecheck` (tsc), `pnpm test` (vitest), `pnpm lint`, `pnpm build`. Bicep: `az deployment group what-if --resource-group dolmenwood-beyond-rg --template-file infra/azure/main.bicep --parameters infra/azure/main.bicepparam`.

**Conventions to preserve** (from research): keep domain types in `@dolmenwood/types` persistence-agnostic; keep the single-source-of-truth mapper pattern (`lib/data/characters.ts:21-80`); port RLS predicates into shared authz helpers; keep the Resend outbox (`lib/notifications/dispatch.ts`). Do NOT reproduce browser-side DB access, silent error-swallowing, the dual inventory tables, or dead code (Google OAuth, no-op admin trigger).

**Document shapes** are defined once in Phase 1 (`lib/cosmos/types.ts`) and extended per phase; all containers use string `id` + a partition key field.

---

## Phase 1: Cosmos foundation + first read path (catalog)

### Changes

#### 1. Add dependencies
**File**: `apps/web/package.json` — **modify**. Add `"@azure/cosmos": "^4.2.0"`. Root `package.json` unchanged. Run `pnpm install`.

#### 2. Cosmos Bicep module
**File**: `infra/azure/modules/cosmos.bicep` — **create**. Provision a Cosmos DB account (API: NoSQL / `GlobalDocumentDB`), one SQL database `dolmenwood`, and containers. Serverless capacity (`capabilities: [{ name: 'EnableServerless' }]`) to match current low volume.
```bicep
param name string        // e.g. '${prefix}-cosmos'
param location string
param tags object
resource account 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: name, location: location, tags: tags, kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    capabilities: [{ name: 'EnableServerless' }]
    locations: [{ locationName: location, failoverPriority: 0 }]
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
  }
}
resource db 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: account, name: 'dolmenwood', properties: { resource: { id: 'dolmenwood' } }
}
// container helper — one resource per container with its partition key path:
//   catalog_items /itemType, accounts /id, characters /ownerId,
//   campaigns /id, notifications /accountId
output endpoint string = account.properties.documentEndpoint
output accountName string = account.name
```
Add all five containers now (cheap; serverless bills per-op) so later phases only add code.

#### 3. Wire module into main.bicep
**File**: `infra/azure/main.bicep` — **modify**. Add a `module cosmos 'modules/cosmos.bicep'` block after `acr`. Pass `cosmos.outputs.endpoint` into the `appService` module (new param).

#### 4. App Service settings + Key Vault refs
**File**: `infra/azure/modules/app-service.bicep` — **modify**. Add param `cosmosEndpoint string`. Add app settings: `COSMOS_ENDPOINT` (plaintext = `cosmosEndpoint`) and `COSMOS_KEY` as a Key Vault reference `@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/cosmos-key)`. (Key stored out-of-band via `az keyvault secret set`, documented in Phase 10 README update.)

#### 5. Cosmos client factory (server-only)
**File**: `apps/web/src/lib/cosmos/client.ts` — **create**.
```ts
import { CosmosClient, type Container } from '@azure/cosmos';
let client: CosmosClient | null = null;
function getClient(): CosmosClient {
  if (!client) {
    const endpoint = process.env.COSMOS_ENDPOINT;
    const key = process.env.COSMOS_KEY;
    if (!endpoint || !key) throw new Error('COSMOS_ENDPOINT/COSMOS_KEY not set');
    client = new CosmosClient({ endpoint, key });
  }
  return client;
}
export function getContainer(name: string): Container {
  return getClient().database('dolmenwood').container(name);
}
```

#### 6. Document types
**File**: `apps/web/src/lib/cosmos/types.ts` — **create**. Start with catalog:
```ts
export interface CatalogItemDoc {
  id: string; itemType: string; name: string; weight: number;
  costGp: number | null; costSp: number | null; costCp: number | null;
  weaponDamageDice: string | null; armorAcBonus: number | null;
  qualities: string[]; size: string | null; notes: string | null;
}
```

#### 7. Catalog data module
**File**: `apps/web/src/lib/data/catalog.ts` — **create**.
```ts
import { getContainer } from '@/lib/cosmos/client';
import type { CatalogItemDoc } from '@/lib/cosmos/types';
export async function listCatalogItems(): Promise<CatalogItemDoc[]> {
  const { resources } = await getContainer('catalog_items').items
    .query<CatalogItemDoc>('SELECT * FROM c ORDER BY c.name').fetchAll();
  return resources;
}
```

#### 8. Catalog seed script
**File**: `scripts/seed-catalog.ts` — **create**. Read `supabase/seed.sql`'s equipment source (`extracted-data/equipment.json` if present, else parse the current `catalog_items` from a running Supabase) and `upsert` each into the `catalog_items` container with `itemType` set. Run via `npx tsx scripts/seed-catalog.ts`. (Add `tsx` as a root devDependency.)

#### 9. Repoint add-item search
**File**: `apps/web/src/components/character-sheet/inventory/use-add-item.ts` — **modify**. Replace the direct `supabase.from('catalog_items').select(...)` (line 32) with a `fetch('/api/catalog')` call; add route handler `apps/web/src/app/api/catalog/route.ts` (**create**) returning `listCatalogItems()`.

### Verification
#### Automated
- [x] `pnpm install` succeeds; `pnpm typecheck` passes
- [x] `az deployment group what-if ...` lists the Cosmos account + 5 containers
- [x] `npx tsx scripts/seed-catalog.ts` completes; `catalog_items` seeded **from prod Supabase** — 97 docs, ids verified 1:1 against prod (so `catalog_item_id` references stay valid in Phase 9). Working pooler URL stored in Key Vault as `supabase-db-url`; GitHub secrets `SUPABASE_DB_URL`/`SUPABASE_DB_PASSWORD` updated after the password reset (pooler host is `aws-1-us-west-2`, not the `aws-0-...` from the docs).
#### Manual
- [x] `/api/catalog` verified end-to-end against the deployed Cosmos account (dev server): 97 items returned; add-item hook consumes this route

---

## Phase 2: Auth.js identity + accounts container

### Changes

#### 1. Dependencies
**File**: `apps/web/package.json` — **modify**. Add `"next-auth": "^5.0.0-beta"` (Auth.js v5) and `"bcryptjs": "^2.4.3"` + `"@types/bcryptjs"` (dev).

#### 2. Account document type
**File**: `apps/web/src/lib/cosmos/types.ts` — **modify**. Add:
```ts
export interface AccountDoc {
  id: string;            // partition key /id (was auth.users.id)
  email: string;
  role: 'player' | 'referee';
  displayName: string;
  inviteCode: string;
  isAdmin: boolean;
  phone: string | null;
  emailOptIn: boolean; smsOptIn: boolean; whatsappOptIn: boolean;
  whatsappConsentAt: string | null;
  passwordHash: string | null;     // null => requiresPasswordReset
  requiresPasswordReset: boolean;
  createdAt: string; updatedAt: string;
}
```

#### 3. Account data module (rewrite)
**File**: `apps/web/src/lib/data/account.ts` — **modify** (drop `SupabaseClient` param; server-only). New signatures:
```ts
export async function fetchAccount(accountId: string): Promise<Account | null>
export async function updateDisplayName(accountId: string, displayName: string): Promise<void>
export async function updateNotificationPrefs(accountId: string, prefs: {...}): Promise<void>
export async function deleteAccount(accountId: string): Promise<void>   // delete doc + cascade (see note)
export async function createAccount(input: SignUpInput): Promise<AccountDoc>
```
`createAccount` ports `handle_new_user()` + `generate_account_invite_code()` (research Q4): generate a unique 6-char invite code (retry on 409), default `role`, `isAdmin: false`, hash password with bcrypt. Keep the narrow `Account` return shape the settings UI consumes. Cascade delete (`deleteAccount`) removes the account doc plus the user's `characters` (query by `ownerId`) and notification docs — the app-code equivalent of the FK cascade behind `delete_my_account`.

#### 4. Auth.js config
**File**: `apps/web/src/lib/auth/config.ts` — **create**. Credentials provider; `authorize()` looks up the account doc by email (query on `characters`… no — query `accounts` by email via `SELECT * FROM c WHERE c.email=@e`), verifies `bcrypt.compare`, rejects if `passwordHash === null` with an error steering the user to reset. JWT session strategy; `session.user.id = token.sub`. Export `handlers`, `auth`, `signIn`, `signOut`.
```ts
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/sign-in' },
  providers: [Credentials({ /* authorize: verify bcrypt against AccountDoc.passwordHash */ })],
  callbacks: { jwt, session },   // put accountId + isAdmin into token/session
});
```

#### 5. Route handler + session helper
**Files**: `apps/web/src/app/api/auth/[...nextauth]/route.ts` — **create** (`export const { GET, POST } = handlers`). `apps/web/src/lib/auth/session.ts` — **create**:
```ts
import { auth } from './config';
export async function getCurrentAccount(): Promise<AccountDoc> {
  const session = await auth();
  if (!session?.user?.id) throw new Response('Unauthorized', { status: 401 });
  const acct = await fetchAccountDoc(session.user.id);
  if (!acct) throw new Response('Unauthorized', { status: 401 });
  return acct;
}
export async function getCurrentAccountId(): Promise<string | null> { ... }
```

#### 6. Middleware
**File**: `apps/web/src/middleware.ts` — **modify**. Replace the entire Supabase block with Auth.js. Keep `PUBLIC_ROUTES` (add `/reset-password`; drop `/auth/callback`).
```ts
import { auth } from '@/lib/auth/config';
export default auth((req) => {
  const isPublic = PUBLIC_ROUTES.some(r => req.nextUrl.pathname.startsWith(r));
  if (!req.auth && !isPublic) return NextResponse.redirect(new URL('/sign-in', req.url));
  if (req.auth && isPublic) return NextResponse.redirect(new URL('/characters', req.url));
});
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|api/).*)'] };
```

#### 7. Auth pages + password reset
**Files**: `apps/web/src/app/(auth)/sign-in/page.tsx`, `sign-up/page.tsx`, `forgot-password/page.tsx`, `reset-password/page.tsx` — **modify**. Sign-in: call `signIn('credentials', {...})`. Sign-up: POST to a new `apps/web/src/app/api/auth/register/route.ts` (**create**) that calls `createAccount`. Forgot/reset: new server routes issuing a signed reset token, emailing the link via existing `sendEmail` (`lib/notifications/channels/email.ts`), and setting a new `passwordHash` + clearing `requiresPasswordReset`. The reset flow MUST accept accounts with `passwordHash === null` (migrated users, Phase 9).
**Delete** dead server actions: `apps/web/src/app/(auth)/actions.ts` and `apps/web/src/app/auth/callback/route.ts` — **delete** (Supabase-only; Google OAuth is dead code per research Q4).

#### 8. Auth store + direct getUser sites
**File**: `apps/web/src/stores/auth-store.ts` — **modify**. Replace Supabase `User` type with `{ id: string; email: string } | null`. The ~25 client sites calling `supabase.auth.getUser()` (research Q1/Q4) are migrated as their owning phase touches them; for Phase 2, update `app/(app)/layout.tsx` and `app/(app)/settings/*` to read the session via a new `/api/auth/me` route or `useSession()` from `next-auth/react` (add `<SessionProvider>` in `app/(app)/layout.tsx`).

#### 9. Key Vault secret
**File**: `infra/azure/modules/app-service.bicep` — **modify**. Add app setting `AUTH_SECRET` = KV ref `auth-secret`, and `NEXTAUTH_URL`/`AUTH_URL` = the web app URL.

### Verification
#### Automated
- [x] `pnpm test` passes (54 web tests incl. 12 new: createAccount/verifyPassword/setPassword/deleteAccount cascade + reset-token roundtrip/forgery/expiry)
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm build` pass (middleware edge bundle compiles via the shared/full config split)
#### Manual
- [x] Sign up → `accounts` doc in Cosmos with 6-char `inviteCode` + bcrypt hash (verified via curl against live Cosmos)
- [x] Sign in: wrong password → CredentialsSignin; correct → session; `/api/account` 401 without session; middleware 307s `/characters` → `/sign-in`; DELETE cascades and the deleted account can no longer sign in
- [ ] Forgot-password email via Resend + reset link (needs `RESEND_API_KEY` locally or the deployed app — not exercised yet; token create/verify covered by unit tests)

---

## Phase 3a: Character document + CRUD behind server tier

### Changes

#### 1. Character document type + mapper
**File**: `apps/web/src/lib/cosmos/types.ts` — **modify**. Add `CharacterDoc` (core fields only in 3a; sub-arrays added in 3b):
```ts
export interface CharacterDoc {
  id: string; ownerId: string;            // partition key /ownerId
  name: string; sex: string | null; age: string | null;
  height: string | null; weight: string | null;
  kindred: string; characterClass: string; alignment: string;
  moonSign: string | null; background: string | null;
  level: number; xp: number; abilityScores: AbilityScores;
  hpCurrent: number; hpMax: number; portraitUrl: string | null;
  isActive: boolean; extraLanguages: string[];
  notes: string | null; sessionNotes: SessionNote[]; peopleOfNote: PersonOfNote[];
  coinsGp: number; coinsSp: number; coinsCp: number;
  createdAt: string; updatedAt: string;
}
```
**File**: `apps/web/src/lib/data/mappers/character.ts` — **create**. `docToCharacter(doc): Character`, `docToCharacterWithNotes(doc): CharacterWithNotes`, `characterToDoc(...)`, `applyCharacterUpdates(doc, patch): CharacterDoc`. This replaces the snake_case mappers in `characters.ts:21-80` (camelCase in the doc means mapping is now near-identity, but keep the module as the single source of truth per design).

#### 2. Authz helpers
**File**: `apps/web/src/lib/authz.ts` — **create**.
```ts
export function assertOwner(accountId: string, ownerId: string): void {
  if (accountId !== ownerId) throw new Response('Forbidden', { status: 403 });
}
export async function assertCharacterOwner(accountId: string, characterId: string): Promise<CharacterDoc> {
  // characters are partitioned by /ownerId, so a point read needs the owner;
  // use a cross-partition query by id, then assert ownership.
  const doc = await fetchCharacterDocById(characterId);
  if (!doc) throw new Response('Not found', { status: 404 });
  assertOwner(accountId, doc.ownerId); return doc;
}
```

#### 3. Character data module (rewrite)
**File**: `apps/web/src/lib/data/characters.ts` — **modify**. Drop `SupabaseClient`; server-only; resolve current account internally. New signatures:
```ts
export async function listCharacters(): Promise<Character[]>              // query WHERE c.ownerId=@me ORDER BY updatedAt DESC
export async function fetchCharacterWithNotes(id: string): Promise<CharacterWithNotes | null>  // + assertOwner
export async function createCharacter(input: NewCharacterInput): Promise<{ id: string }>       // ownerId = me
export async function updateCharacter(id: string, patch: Partial<CharacterWithNotes>): Promise<void>  // ETag replace
export async function deleteCharacter(id: string): Promise<void>
export async function fetchCoins(id: string): Promise<Coins>
export async function saveCoins(id: string, coins: Coins): Promise<void>
```
Writes use `container.item(id, ownerId).replace(doc, { accessCondition: { type: 'IfMatch', condition: doc._etag } })`.

#### 4. API routes
**Files** — **create**: `apps/web/src/app/api/characters/route.ts` (GET list, POST create), `apps/web/src/app/api/characters/[id]/route.ts` (GET/PATCH/DELETE). Each calls `getCurrentAccount()` then the data function; maps thrown `Response` to the HTTP status.

#### 5. Client call sites
**Files** — **modify**: `apps/web/src/hooks/use-characters.ts` (replace `createClient()` + `listCharacters(supabase)` with `fetch('/api/characters')`; remove the realtime `channel` block — restored in Phase 8, leave a `// TODO(phase8): live updates` and a manual refetch), character list/creation/import/level-up pages that call `createCharacter`/`fetchCharacterWithNotes`/`updateCharacter` (`app/(app)/characters/**`).

### Verification
#### Automated
- [x] `pnpm test` passes (59 web tests incl. 5 new: ETag-412 retry converges, assertOwner 403, cross-owner update/delete rejected, update whitelist ignores `ownerId`)
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm build` pass
#### Manual
- [x] Character created via `POST /api/characters` → doc with `ownerId = me` (live Cosmos, two-account curl E2E)
- [x] PATCH hp/notes + PUT coins persist; owner list shows them; delete-account cascade removes the character
- [x] Account B: GET/PATCH on A's character → 403; unauthenticated → 401; B's list is empty

---

## Phase 3b: Embedded inventory + spells

### Changes

#### 1. Extend CharacterDoc
**File**: `apps/web/src/lib/cosmos/types.ts` — **modify**. Add to `CharacterDoc`:
```ts
inventory: InventoryEntry[];        // collapses inventory_items + character_inventory
spellSlots: SpellSlotEntry[];       // { rank, slotsTotal, slotsUsed }
spellPreparations: SpellPrepEntry[];// { slotRank, spellName, isCast }
```
Define `InventoryEntry` = the union of the two legacy inventory shapes, keeping the fields the sheet reads (name, itemType, quantity, weight, location, weaponDamageDice, armorAcBonus, catalogItemId, isConsumable).

#### 2. Data modules (rewrite, server-only)
**Files** — **modify**: `apps/web/src/lib/data/inventory.ts`, `apps/web/src/lib/data/spells.ts`. All ops read the character doc (via `assertCharacterOwner`), mutate the embedded array, and `replace` with ETag guard.
```ts
export async function addInventoryItem(characterId: string, item: NewInventoryEntry): Promise<void>
export async function updateInventoryItem(characterId: string, itemId: string, patch: ...): Promise<void>
export async function removeInventoryItem(characterId: string, itemId: string): Promise<void>
export async function fetchEquippedArmorBonuses(characterIds: string[]): Promise<Record<string, number>> // point reads
export async function setSpellSlots(characterId: string, slots: SpellSlotEntry[]): Promise<void>
export async function prepareSpell(characterId: string, prep: SpellPrepEntry): Promise<void>
export async function castSpell(characterId: string, prepId: string): Promise<void>
```

#### 3. API routes + UI
**Files** — **create**: `apps/web/src/app/api/characters/[id]/inventory/route.ts` (+ `[itemId]`), `.../spells/route.ts`. **Modify** `components/character-sheet/inventory/*` (incl. `use-add-item.ts`, `use-inventory.ts`, `use-restock.ts`), `components/character-sheet/MagicTab.tsx` + spell hooks to call the routes instead of a Supabase client. Update `use-characters.ts` `fetchEquippedArmorBonuses` call.

### Verification
#### Automated
- [x] `pnpm test` passes (65 web tests incl. 6 new: embedded add/patch/remove, invalid location 400, roster armor rollup excludes stowed, initSlots race → alreadyInitialized, prep/cast/rest lifecycle, slot-usage clamp)
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm build` pass
#### Manual
- [x] Live-Cosmos E2E: add equipped chainmail → roster `armorByCharacter` +4 (computed from the embedded array, no second query); stow it → 0; patch/delete persist inside the doc
- [x] Magic E2E: initSlots → prepare Sleep → cast → rest zeroes usage + clears preps; second initSlots returns `alreadyInitialized` (old 23505 race semantics preserved)

---

## Phase 4: Banking + level-up (app-layer transactions)

### Changes

#### 1. Embed bank ledger
**File**: `apps/web/src/lib/cosmos/types.ts` — **modify**. Add `bankLedger: BankLedgerEntry[]` to `CharacterDoc` (`{ id, amountGp, description, performedBy, createdAt }`). Add `LevelUpLogEntry[]` (`levelUpLogs`).

#### 2. Bank transaction (port `bank_transaction`)
**File**: `apps/web/src/lib/data/bank.ts` — **modify**, server-only.
```ts
export async function recordBankTransaction(
  characterId: string, amountGp: number, description = '',
): Promise<void> {
  const me = await getCurrentAccount();
  const doc = await fetchCharacterDocById(characterId);           // cross-partition by id
  const isReferee = await isCampaignRefereeOfCharacter(me.id, doc); // Phase 5 helper; in P4 use owner-only + role check
  // Authorization mirrors bank_ledger RLS (research Q3):
  //   deposit (amount>0): owner or referee; payout (amount<0): referee only
  if (amountGp > 0 && doc.ownerId !== me.id && !isReferee) throw forbidden();
  if (amountGp < 0 && !isReferee) throw forbidden();
  const balance = doc.bankLedger.reduce((s, e) => s + e.amountGp, 0);
  if (amountGp < 0 && balance + amountGp < 0) throw badRequest('insufficient bank balance');
  if (amountGp > 0 && doc.coinsGp < amountGp) throw badRequest('insufficient purse');
  doc.bankLedger.push({ id: newId(), amountGp, description, performedBy: me.id, createdAt: nowIso() });
  doc.coinsGp -= amountGp;
  await replaceWithEtag(doc);   // single partition /ownerId, ETag retry on 412
}
export async function fetchBankBalance(characterId: string): Promise<number>
export async function listLedger(characterId: string): Promise<BankLedgerEntry[]>
```
Note: in Phase 4 the referee check can be a simple `accounts.role === 'referee'` (matching the pre-campaign RLS on `bank_ledger`); tighten to campaign-scoped in Phase 5.

#### 3. Level-up (port `level_up`)
**File**: `apps/web/src/lib/data/level-up.ts` — **modify**, server-only.
```ts
export async function levelUp(characterId: string, input: LevelUpInput): Promise<void> {
  const doc = await assertCharacterOwner((await getCurrentAccount()).id, characterId);
  if (input.newLevel < 2 || input.newLevel > 15) throw badRequest('level out of range');
  if (doc.level !== input.newLevel - 1) throw badRequest('non-monotonic level');   // research Q2
  doc.level = input.newLevel; doc.hpMax = input.hpMax; doc.hpCurrent = input.hpMax;
  doc.levelUpLogs.push({ ...input.log, createdAt: nowIso() });
  await replaceWithEtag(doc);   // level + hp + log in one replace (single doc = atomic)
}
```

#### 4. API routes + UI
**Files** — **create**: `apps/web/src/app/api/characters/[id]/bank/route.ts`, `.../level-up/route.ts`. **Modify** `components/campaign/BankingTab.tsx`, `components/character-sheet/inventory/BankPanel.tsx`, and level-up UI under `app/(app)/characters/[id]/level-up/*` + `level-up-log/page.tsx` to call the routes.

### Verification
#### Automated
- [x] `pnpm test` passes (74 web tests incl. 9 new; racing-deposits 412-retry test nets exactly one entry each — also exposed and fixed a fake-fidelity bug: reads must clone, not share references)
- [x] payout by non-referee → 403; over-balance payout → 400; deposit over purse → 400; non-monotonic/out-of-range/XP-gated level-up → 400; referee overview forbidden for players
#### Manual
- [x] Live-Cosmos E2E: player deposit 40gp → purse 60/balance 40; player payout 403; referee overdraw 400; referee payout 30 → purse 90/balance 10; referee overview lists it; player denied `/api/bank`
- [x] Level-up (xp 2100 ≥ threshold 2000) → level 2, hp 13/13, log entry (1→2, hp_roll_final 5); level-skip attempt → 400

---

## Phase 5: Campaigns aggregate (membership, party, mounts)

### Changes

#### 1. Campaign document type
**File**: `apps/web/src/lib/cosmos/types.ts` — **modify**.
```ts
export interface CampaignDoc {
  id: string;                       // partition key /id
  name: string; refereeId: string; inviteCode: string;
  members: { accountId: string; joinedAt: string }[];
  partyMounts: MountEntry[];
  characterCampaignData: { characterId: string; xpEarned: number; notes: string | null; affiliation: string | null }[];
  createdAt: string;
}
```
Character-owned mounts + retainers stay embedded in `CharacterDoc` (add `mounts: MountEntry[]`, `retainers: RetainerEntry[]` in this phase).

#### 2. Authz helpers (port RLS helpers)
**File**: `apps/web/src/lib/authz.ts` — **modify**. Add:
```ts
export async function isCampaignMember(campaignId: string, accountId: string): Promise<boolean>
export async function isCampaignReferee(campaignId: string, accountId: string): Promise<boolean>
export async function assertCampaignParticipant(campaignId: string, accountId: string): Promise<CampaignDoc>
```
These read the campaign doc and check `refereeId` / `members` — the app port of `is_campaign_member`/`is_campaign_referee` (research Q3).

#### 3. Campaign data module (rewrite)
**File**: `apps/web/src/lib/data/campaigns.ts` — **modify**, server-only.
```ts
export async function createCampaign(name: string): Promise<{ id: string }>        // refereeId = me, gen inviteCode
export async function joinCampaign(inviteCode: string): Promise<{ campaignId: string; campaignName: string }> // dup-member guard → 409
export async function loadRefereeCampaigns(): Promise<RefereeCampaignsData | null>
export async function loadPlayerCampaigns(): Promise<CampaignData[]>
export async function insertPackAnimal(campaignId: string, animal: NewMount): Promise<MountEntry>
export async function removePackAnimal(campaignId: string, mountId: string): Promise<void>
```
`loadRefereeCampaigns`/`loadPlayerCampaigns` do the cross-partition fan-out (research Q1): read campaign doc(s), then for each member `accountId` query their `characters` (`WHERE c.ownerId=@id`). This replaces the `get_campaign_party_data` RPC.

#### 4. Mounts + retainers modules
**Files** — **modify**: `apps/web/src/lib/data/mounts.ts`, `apps/web/src/lib/data/retainers.ts` (character-owned → embedded in `CharacterDoc`; party → `CampaignDoc.partyMounts`). Fix the direct insert in `components/character-sheet/stats/use-retainers.ts:63` to call the data module.

#### 5. API routes + UI
**Files** — **create** `apps/web/src/app/api/campaigns/route.ts`, `.../[id]/route.ts`, `.../join/route.ts`, `.../[id]/mounts/route.ts`. **Modify** `app/(app)/campaign/page.tsx` (replace direct `accounts.select('role')` and party queries), `components/campaign/*` (`ScheduleTab.tsx`, `BankingTab.tsx` character list). Repoint the Phase-4 referee check to `isCampaignReferee`.

### Verification
#### Automated
- [ ] `pnpm test` passes (join dup-member → 409; `isCampaignReferee` true only for referee)
- [ ] `pnpm typecheck` passes
#### Manual
- [ ] Create campaign → invite code; join from account B; referee sees B's characters (cross-partition read); a non-member gets 403
- [ ] Add/remove pack animals (party) and character mounts/retainers

---

## Phase 6: Scheduling, proposals, and notifications

### Changes

#### 1. Extend CampaignDoc + notification doc
**File**: `apps/web/src/lib/cosmos/types.ts` — **modify**. Add to `CampaignDoc`: `sessions: SessionEntry[]`, `proposals: ProposalEntry[]` (each proposal embeds `availability: { accountId; available; updatedAt }[]`, `status`, `confirmedSessionId`). Add:
```ts
export interface NotificationDoc {
  id: string; accountId: string;    // partition key /accountId
  campaignId: string | null; kind: string; body: string;
  relatedSessionId: string | null; read: boolean; createdAt: string;
  deliveries: { channel: 'email'|'sms'|'whatsapp'; status: 'pending'|'sent'|'failed';
                sentAt: string | null; error: string | null; attempts: number }[];
}
```

#### 2. Scheduling + proposals modules
**Files** — **modify**: `apps/web/src/lib/data/schedule.ts`, `apps/web/src/lib/data/proposals.ts`, server-only, all `assertCampaignParticipant`-guarded.
```ts
export async function getCampaignSchedule(campaignId: string): Promise<SessionEntry[]>
export async function setSessionRsvp(sessionId: string, status: 'yes'|'no'|'maybe'): Promise<void>
export async function getCampaignProposals(campaignId: string): Promise<ProposalView[]>
export async function createProposal(campaignId: string, input: NewProposal): Promise<void>
export async function deleteProposal(campaignId: string, proposalId: string): Promise<void>
export async function setProposalAvailability(campaignId: string, proposalId: string, available: boolean): Promise<void>
```
`setProposalAvailability` ports the confirm chain (research Q2, `20260624000026`–`028`): upsert availability in the campaign doc; if all participants (`members ∪ refereeId`) are available and status is `open`, set `status='confirmed'`, append a `SessionEntry`, set `confirmedSessionId` — all in one campaign-doc `replace` (single partition, atomic, replaces the GUC-guarded trigger). Then **fan out** one `NotificationDoc` per participant into the `notifications` container (cross-partition, best-effort; the guard trigger is unnecessary because writes go only through this function).

#### 3. Notifications module + dispatch repoint
**File**: `apps/web/src/lib/data/notifications.ts` — **modify**:
```ts
export async function loadNotifications(): Promise<NotificationDoc[]>   // WHERE c.accountId=@me ORDER BY createdAt DESC
export async function markNotificationRead(id: string): Promise<void>
```
**File**: `apps/web/src/lib/notifications/dispatch.ts` — **modify**. Replace the `SupabaseClient` param with Cosmos access. `enqueue`: query `notifications` created within `ENQUEUE_WINDOW_HOURS`, and for each, add a pending `deliveries` entry per opted-in channel (read opt-ins from the account doc), idempotent by `(id, channel)` — now an in-document check instead of the unique constraint. `sendPending`: iterate notifications with a pending email delivery, `sendEmail(...)`, mark the embedded delivery `sent`/`failed`. Keep `channelsFor`, `subjectFor`, `ENQUEUE_WINDOW_HOURS`.
**File**: `apps/web/src/app/api/notifications/drain/route.ts` — **modify**. Replace `createServiceClient()` with the Cosmos-backed `drainNotifications()`; keep the `x-drain-secret` header check.

#### 4. API routes + UI
**Files** — **create**: `apps/web/src/app/api/campaigns/[id]/schedule/route.ts`, `.../proposals/route.ts` (+ `[proposalId]/availability`). **Modify** scheduling/proposal UI (`components/campaign/ScheduleTab.tsx`, proposal components) and the notifications bell/section to call routes instead of Supabase.

### Verification
#### Automated
- [ ] `pnpm test` passes: all-available → proposal auto-confirms, creates a session, and writes N participant notifications; delivery enqueue is idempotent on re-run
- [ ] `pnpm typecheck` passes
#### Manual
- [ ] Propose a date; each member marks available; on the last one it auto-confirms + a session appears
- [ ] Each participant sees a notification; hitting `/api/notifications/drain` (with the secret) emails via Resend and marks deliveries sent, and a second call sends nothing new

---

## Phase 7: Portraits → Blob Storage

### Changes

#### 1. Storage Bicep module
**File**: `infra/azure/modules/storage.bicep` — **create**. `Microsoft.Storage/storageAccounts` (Standard_LRS) + a blob container `portraits` (public read blob access, matching the current public bucket). Output the account name + blob endpoint.
**File**: `infra/azure/main.bicep` — **modify**. Add the module; pass the connection string into App Service.
**File**: `infra/azure/modules/app-service.bicep` — **modify**. Add app setting `BLOB_CONNECTION_STRING` = KV ref `blob-connection-string`.

#### 2. Portrait module (rewrite)
**File**: `apps/web/src/lib/data/portraits.ts` — **modify**. Use `@azure/storage-blob` (add dep). Server-only; path `${accountId}/${characterId}/${Date.now()}.${ext}`; enforce `folder[0] === accountId` (port of storage RLS, research Q5); upload, then set `characters.portraitUrl` (still fire-and-forget per the file's existing contract). Return the blob URL.

#### 3. Upload route + UI
**File** — **create**: `apps/web/src/app/api/portraits/route.ts` (POST multipart → `uploadPortrait`, guarded by `getCurrentAccount`). **Modify** `components/character-sheet/header/use-portrait-upload.ts` to POST the file to the route (no client storage key).

### Verification
#### Automated
- [ ] `pnpm typecheck` passes; `az deployment group what-if` shows the storage account + `portraits` container
#### Manual
- [ ] Upload a portrait → renders from the Blob URL and persists on the character
- [ ] A request writing to another account's path prefix is rejected (403)

---

## Phase 8: Live HP via change feed → SignalR

### Changes

#### 1. SignalR Bicep + Function
**Files** — **create**: `infra/azure/modules/signalr.bicep` (`Microsoft.SignalRService/signalR`, Serverless mode), `infra/functions/character-feed/` (Azure Function: Cosmos change-feed trigger on the `characters` container + SignalR output binding, broadcasting `{ characterId, ownerId, hpCurrent }`). **Modify** `infra/azure/main.bicep` to add SignalR; add `SIGNALR_CONNECTION_STRING` KV ref to `app-service.bicep`.

#### 2. Negotiate route + client hook
**File** — **create**: `apps/web/src/app/api/signalr/negotiate/route.ts` (returns client connection info scoped to the user). **Modify** `apps/web/src/hooks/use-characters.ts` — replace the Phase-3a TODO with a SignalR client subscription (add `@microsoft/signalr` dep) that refetches on a character-change message.

### Verification
#### Automated
- [ ] `pnpm typecheck` passes; SignalR + Function templates validate (`az deployment group what-if`)
#### Manual
- [ ] Edit a character's HP in one browser session; a second viewer of the same character updates within a few seconds

---

## Phase 9: One-time data migration script

### Changes

#### 1. Transform helpers
**File**: `scripts/lib/transform.ts` — **create**. Pure functions turning Supabase result sets into aggregate docs: `toAccountDoc(row)`, `toCharacterDoc(charRow, inventoryRows, spellSlotRows, spellPrepRows, ledgerRows, levelLogRows, mountRows, retainerRows)`, `toCampaignDoc(campaignRow, members, sessions, proposals, availability, partyMounts, ccData)`, `toNotificationDocs(notificationRows, deliveryRows)`. Reuse the Phase 2–6 mapper logic where importable.

#### 2. Migration runner
**File**: `scripts/migrate-supabase-to-cosmos.ts` — **create**.
```ts
// reads via pg (SUPABASE_DB_URL) or the service client; writes via @azure/cosmos.
export async function migrate(): Promise<Report> {
  // accounts: passwordHash = null, requiresPasswordReset = true (DECISION: forced reset)
  // characters: assemble embedded arrays by owner_id
  // campaigns: assemble members/sessions/proposals/availability
  // notifications: assemble deliveries
  // upsert by id (idempotent, re-runnable); collect per-entity counts
}
```
Run: `npx tsx scripts/migrate-supabase-to-cosmos.ts`. **No credential migration** — accounts land with `passwordHash: null` + `requiresPasswordReset: true`; users set a password via the Phase-2 reset flow at cutover.

### Verification
#### Automated
- [ ] `pnpm test` passes for `scripts/lib/transform.ts` unit tests (a sample character row set → expected embedded doc)
#### Manual
- [ ] Dry-run against a Supabase snapshot; per-entity source-row vs Cosmos-document counts reconcile (accounts, characters, campaigns, notifications)
- [ ] Spot-check one migrated character aggregate (inventory + ledger + logs embedded) and confirm a migrated account can complete a password reset and log in

---

## Phase 10: Supabase teardown + CI/CD cutover

### Changes

#### 1. Delete Supabase code
**Files** — **delete**: `apps/web/src/lib/supabase/{client,server,service}.ts`; archive/remove `supabase/` (migrations, config, seed). Remove `@supabase/ssr` + `@supabase/supabase-js` from `apps/web/package.json`; `pnpm install`.

#### 2. CI/CD
**File**: `.github/workflows/deploy-azure.yml` — **modify**. Remove the `run-migrations` job (`:144-160`, `supabase db push`) and its `needs` references in `deploy-app`. Remove `NEXT_PUBLIC_SUPABASE_*` Docker build-args (`:138-140`) — no longer needed (data is server-side; Cosmos uses runtime env). Add container provisioning is already handled by the `deploy-infra` Bicep step.
**File**: `docker-compose.yml` — **modify**. Remove the `supabase-db` service + Supabase env; optionally add a Cosmos emulator note.

#### 3. Infra + docs
**File**: `infra/azure/modules/app-service.bicep` — **modify**. Remove `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` app settings + their KV refs. Remove the `supabaseUrl` param threading in `main.bicep` + `deploy-azure.yml`.
**Files** — **modify**: `GITHUB_SECRETS.md`, `infra/azure/README.md` — replace Supabase secrets/vars with the new set (`COSMOS_KEY`, `AUTH_SECRET`, `BLOB_CONNECTION_STRING`, `SIGNALR_CONNECTION_STRING`; keep `RESEND_*`, `NOTIFICATIONS_DRAIN_SECRET`, `WP_*`) and the `az keyvault secret set` commands for the new secrets.

### Verification
#### Automated
- [ ] `grep -r "@supabase" apps/web/src` returns nothing; `grep -rn "SUPABASE" apps/web infra .github` only matches removed/renamed references intentionally left in docs history (none in code)
- [ ] `pnpm build` + `pnpm test` + `pnpm lint` pass
- [ ] `deploy-azure.yml` has no `supabase` job; a full deploy succeeds and `/api/health` returns green
#### Manual
- [ ] In the deployed app, smoke-test every flow from Phases 2–8: sign in (post-reset), character CRUD + inventory + spells, banking, level-up, join campaign, scheduling + proposal confirm + notification email, portrait upload, live HP

---

## Testing Checkpoints (resume aid)

- **P1**: Cosmos reachable; catalog served from Cosmos.
- **P2**: Auth.js signup/login/reset; `accounts` in Cosmos; middleware enforces auth.
- **P3a**: character CRUD on Cosmos; cross-account denied; authz + mapper patterns established.
- **P3b**: embedded inventory + spells; dual-inventory collapsed.
- **P4**: banking + level-up transactionally correct under ETag concurrency.
- **P5**: campaigns/membership/party; referee cross-partition reads.
- **P6**: scheduling + proposal auto-confirm + notification fan-out + Resend drain on Cosmos.
- **P7**: portraits on Blob.
- **P8**: live HP via SignalR.
- **P9**: prod data reconciled into Cosmos; forced-reset accounts can log in.
- **P10**: zero Supabase footprint; full app green on Azure.
