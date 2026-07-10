# Structure Outline

## Approach

Cut over from Supabase to Cosmos DB for NoSQL one **domain aggregate at a time**, each slice crossing infra → data tier → API/Server Action → UI, so every phase is independently testable and independently valuable. Foundations first (Cosmos client + Auth.js + one trivial entity), then the aggregates in dependency order (accounts → characters → campaigns → scheduling/notifications), then platform extras (portraits, realtime), then the one-time data migration, then teardown of Supabase. A `USE_COSMOS` seam lets phases land without a big-bang switch.

Because auth and the browser-key constraint are cross-cutting, they cannot be fully sliced away — Phase 1–2 establish them once as shared foundations that every later slice depends on. This is called out explicitly rather than pretended to be vertical.

---

## Phase 1: Cosmos foundation + first read path (catalog)

Provision Cosmos, add a server-only container-client factory, and prove the full stack end-to-end with the simplest entity: the read-only equipment catalog. No auth needed to validate connectivity.

**Files**: `infra/azure/modules/cosmos.bicep` (new), `infra/azure/main.bicep`, `infra/azure/modules/app-service.bicep`, `apps/web/src/lib/cosmos/client.ts` (new), `apps/web/src/lib/data/catalog.ts` (new), `scripts/seed-catalog.ts` (new), `apps/web/src/components/character-sheet/inventory/use-add-item.ts`
**Key changes**:
- `getContainer(name: string): Container` — new, reads `COSMOS_ENDPOINT`/`COSMOS_KEY`, server-only
- `listCatalogItems(): Promise<CatalogItem[]>` — new, replaces `catalog_items.select()` at `use-add-item.ts:32`
- Cosmos account + `catalog_items` container (pk `/itemType`) provisioned; Key Vault secrets `cosmos-endpoint`/`cosmos-key`

**Verify**: `pnpm typecheck` passes; `az deployment group what-if` shows Cosmos resources; seed script populates catalog; add-item search in the character sheet returns catalog rows from Cosmos.

---

## Phase 2: Auth.js identity + accounts container

Replace Supabase Auth with Auth.js (Credentials) backed by an `accounts` container. Establishes the session cookie + middleware + server-side `getCurrentAccount()` that every later slice needs.

**Files**: `apps/web/src/lib/auth/config.ts` (new), `apps/web/src/lib/auth/session.ts` (new), `apps/web/src/middleware.ts`, `apps/web/src/lib/data/account.ts`, `apps/web/src/app/(auth)/sign-in/page.tsx`, `sign-up/page.tsx`, `forgot-password/page.tsx`, `apps/web/src/app/api/auth/[...nextauth]/route.ts` (new), `infra/azure/modules/cosmos.bicep`
**Key changes**:
- `auth(): Promise<Session | null>` and `getCurrentAccount(): Promise<Account>` — new server helpers, replace `supabase.auth.getUser()`
- `createAccount(input: SignUpInput): Promise<Account>` — new; ports `handle_new_user()` trigger logic (invite code, default role) into app code
- Reset flow must support accounts with no credential hash (migrated users are forced through it at cutover — see Phase 9)
- `fetchAccount(accountId): Promise<Account | null>`, `updateNotificationPrefs(...)`, `updateDisplayName(...)` — rewritten against Cosmos
- `accounts` container (pk `/id`) with credential hash field; middleware validates Auth.js session

**Verify**: `pnpm test` (new auth unit tests) passes; sign-up creates an `accounts` doc with invite code; sign-in sets a session; middleware redirects unauthenticated users to `/sign-in`; password reset email sends via Resend.

---

## Phase 3a: Character document + CRUD behind server tier

Move the core character document (stats, notes, coins, portrait URL — no embedded sub-lists yet) to Cosmos, accessed only through server actions/API routes enforcing `ownerId === currentAccount.id`. First slice that closes the browser-key hole and establishes the authz-helper + mapper patterns every later slice copies.

**Files**: `apps/web/src/lib/data/characters.ts`, `apps/web/src/lib/data/mappers/character.ts` (new), `apps/web/src/app/api/characters/**` (new route handlers), `apps/web/src/hooks/use-characters.ts`, character list/creation pages, `apps/web/src/lib/authz.ts` (new)
**Key changes**:
- `docToCharacter(doc): CharacterWithNotes` / `characterToDoc(c): CharacterDoc` — new mappers (single source of truth, per design)
- `listCharacters()`, `fetchCharacter(id)`, `updateCharacter(id, patch)`, `createCharacter(input)`, `deleteCharacter(id)` — rewritten, server-only, no injected client; authz enforced inside
- `assertOwner(accountId, ownerId)` / `assertCharacterOwner(characterId)` — new authz helpers (port of RLS ownership predicate)
- `characters` container (pk `/ownerId`)

**Verify**: `pnpm test` passes; create/edit/delete a character via the wizard and sheet; a second account cannot fetch/mutate another's character (403).

---

## Phase 3b: Embedded inventory + spells

Extend the character document with the embedded sub-arrays — inventory, spell slots, spell preparations — and repoint the sheet's inventory/magic tabs at the server tier.

**Files**: `apps/web/src/lib/data/inventory.ts`, `spells.ts`, `apps/web/src/lib/data/mappers/character.ts`, `apps/web/src/app/api/characters/[id]/inventory/**` (new), `.../spells/**` (new), `components/character-sheet/inventory/*`, `components/character-sheet/MagicTab.tsx` + spell hooks
**Key changes**:
- `CharacterDoc` gains `inventory: InventoryEntry[]`, `spellSlots: SpellSlotEntry[]`, `spellPreparations: SpellPrepEntry[]` — collapses the two legacy inventory tables into one embedded list
- `addInventoryItem`, `updateInventoryItem`, `removeInventoryItem`, `setSpellSlots`, `prepareSpell`, `castSpell` — server-only, ETag-guarded updates to the character doc

**Verify**: `pnpm test` passes; add/edit/remove inventory items (incl. from catalog), track spell slots and preparations — all persist inside the character doc; encumbrance/AC derived values unchanged.

---

## Phase 4: Banking + level-up (app-layer transactions)

Port the two single-character transactional RPCs to app-layer transactions on the character doc (embedded bank ledger + coins; level-up log + hp/level update via ETag/transactional batch).

**Files**: `apps/web/src/lib/data/bank.ts`, `level-up.ts`, `apps/web/src/app/api/characters/[id]/bank/route.ts` (new), `.../level-up/route.ts` (new), level-up UI under `app/(app)/characters/[id]/level-up/`, `components/campaign/BankingTab.tsx`
**Key changes**:
- `recordBankTransaction(characterId, amountGp, description): Promise<Result>` — ports `bank_transaction` auth (owner deposit / referee payout / balance check) as an ETag-guarded update
- `levelUp(characterId, input): Promise<Result>` — ports `level_up` (monotonic level check, hp update, log append) as a single-partition batch
- Both enforce authz in code; both single logical partition (`/ownerId`)

**Verify**: `pnpm test` (concurrency test: two racing deposits don't double-apply) passes; deposit/payout adjusts coins + appends ledger atomically; illegal payout by a non-referee is rejected; level-up updates level/hp and writes a log.

---

## Phase 5: Campaigns aggregate (membership, party, mounts)

Move campaigns, memberships, character-campaign data, and party/character mounts to a `campaigns` container; port `create_campaign`/`join_campaign` and the party/referee cross-partition read.

**Files**: `apps/web/src/lib/data/campaigns.ts`, `mounts.ts`, `retainers.ts`, `apps/web/src/app/api/campaigns/**` (new), `app/(app)/campaign/page.tsx`, `components/campaign/*`, `apps/web/src/lib/authz.ts`
**Key changes**:
- `createCampaign(name)`, `joinCampaign(inviteCode)` — ported RPCs (invite lookup, dup-member guard) as app functions
- `loadRefereeCampaigns()` / `loadPlayerCampaigns()` — cross-partition fan-out: read campaign doc, then point-read member characters by `ownerId`
- `isCampaignMember(campaignId, accountId)` / `isCampaignReferee(...)` — new shared authz helpers (port of `is_campaign_member`/`is_campaign_referee`)
- `campaigns` container (pk `/id`) embedding members + party mounts

**Verify**: `pnpm test` passes; create a campaign (gets invite code), join from a second account, referee sees party members' characters, non-members get 403; add/remove pack animals.

---

## Phase 6: Scheduling, proposals, and notifications

Move sessions, date proposals + availability, and the notification outbox to Cosmos; port the proposal auto-confirm + notification fan-out; repoint the existing Resend dispatch at the `notifications` container.

**Files**: `apps/web/src/lib/data/schedule.ts`, `proposals.ts`, `notifications.ts`, `apps/web/src/lib/notifications/dispatch.ts`, `channels/email.ts`, `apps/web/src/app/api/notifications/drain/route.ts`, `app/api/campaigns/[id]/proposals/**` (new), scheduling/proposal UI, `components/character-sheet` notification bits
**Key changes**:
- `setProposalAvailability(proposalId, available)` — ports the confirm logic: upsert availability (in campaign doc), when all participants approve create a session and **fan out one notification per participant** (cross-partition, best-effort, idempotent by `(notificationId, channel)`)
- `getCampaignProposals`, `getCampaignSchedule`, `setSessionRsvp` — ported membership-guarded reads/writes
- `drainNotifications()` — repointed to Cosmos `notifications` container; delivery rows embedded; enqueue/send-pending preserved
- `notifications` container (pk `/accountId`)

**Verify**: `pnpm test` passes; proposing a date + all members marking available auto-confirms and creates a session; each participant gets a notification; the drain endpoint (still cron-triggered) sends emails via Resend and marks deliveries sent/failed idempotently.

---

## Phase 7: Portraits → Blob Storage

Replace the Supabase storage bucket with Azure Blob; uploads go through a server route (no client key), path `{accountId}/{characterId}/...`, ownership enforced server-side.

**Files**: `infra/azure/modules/storage.bicep` (new), `infra/azure/main.bicep`, `apps/web/src/lib/data/portraits.ts`, `apps/web/src/app/api/portraits/route.ts` (new), `components/character-sheet/header/use-portrait-upload.ts`
**Key changes**:
- `uploadPortrait(characterId, file): Promise<{ url: string }>` — rewritten against `@azure/storage-blob`, sets `characters.portraitUrl`
- Blob container `portraits` + Key Vault secret `blob-connection-string`; server route enforces `folder[0] === accountId` (port of storage RLS)

**Verify**: `pnpm typecheck` passes; upload a portrait, it renders from the Blob URL and persists on the character; another account cannot overwrite the path.

---

## Phase 8: Live HP via change feed → SignalR

Restore the single realtime feature: Cosmos change feed on `characters` → Azure Function → Azure SignalR → client subscription replacing `use-characters.ts:32-41`.

**Files**: `infra/azure/modules/signalr.bicep` (new), `infra/functions/character-feed/` (new Azure Function), `infra/azure/main.bicep`, `apps/web/src/app/api/signalr/negotiate/route.ts` (new), `apps/web/src/hooks/use-characters.ts`
**Key changes**:
- Change-feed Function forwards character updates to SignalR hub
- `negotiate()` route issues client SignalR connection info
- `use-characters` subscribes to SignalR instead of `supabase.channel(...)`

**Verify**: SignalR + Function deploy via Bicep; editing a character's HP in one browser session updates another viewer within a few seconds.

---

## Phase 9: One-time data migration script

Export all prod Supabase data and import into Cosmos as aggregate documents. Idempotent, re-runnable.

**Files**: `scripts/migrate-supabase-to-cosmos.ts` (new), `scripts/lib/transform.ts` (new)
**Key changes**:
- `migrate(): Promise<Report>` — reads via `pg`/service client, assembles character/campaign/notification aggregates (reusing Phase 3–6 mappers where possible), upserts by id via `@azure/cosmos`
- Account credentials: **not migrated** (decision: forced reset). Migrated accounts get no credential hash + a `requiresPasswordReset` flag; at cutover each user sets a new password via the existing Resend reset flow

**Verify**: dry-run against a Supabase snapshot; per-entity source-row vs Cosmos-document counts reconcile; spot-check a migrated character aggregate and a migrated login.

---

## Phase 10: Supabase teardown + CI/CD cutover

Remove all Supabase code, deps, env vars, and the migration job; flip `USE_COSMOS` permanently.

**Files**: `apps/web/src/lib/supabase/*` (delete), `supabase/` (archive/delete), `.github/workflows/deploy-azure.yml`, `docker-compose.yml`, `infra/azure/modules/app-service.bicep`, `GITHUB_SECRETS.md`, `apps/web/package.json`
**Key changes**:
- Remove `@supabase/*` deps; delete client factories; drop `run-migrations` job (`deploy-azure.yml:144-160`) and Supabase app settings/Key Vault refs
- Remove `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_SERVICE_ROLE_KEY`

**Verify**: `grep -r "@supabase" apps/web/src` empty; `pnpm build` + `pnpm test` pass; full deploy to Azure succeeds and `/api/health` is green; smoke-test every flow from Phase 2–8 in the deployed app.

---

## Testing Checkpoints

- **After P1**: Cosmos reachable; catalog reads from Cosmos.
- **After P2**: users sign up/in/out via Auth.js; `accounts` in Cosmos; no Supabase auth calls remain.
- **After P3a**: character CRUD on Cosmos; cross-account access denied — browser-key hole closed for characters; authz + mapper patterns established.
- **After P3b**: embedded inventory + spell tracking on the character doc; legacy dual-inventory collapsed.
- **After P4**: banking + level-up transactionally correct under concurrency.
- **After P5**: campaigns/membership/party work; referee/party cross-partition reads correct.
- **After P6**: scheduling + proposal auto-confirm + notification fan-out + Resend drain on Cosmos.
- **After P7**: portraits on Blob.
- **After P8**: live HP restored via SignalR.
- **After P9**: prod data reconciled into Cosmos.
- **After P10**: zero Supabase footprint; full app green on Azure.

> **Not vertically sliceable (flagged per rules)**: Auth (P2) and the Cosmos client (P1) are shared foundations, not standalone features — every later slice depends on them. The data-migration script (P9) is horizontal by nature (touches all entities) but is deferred to the end so it runs against finalized document shapes. `USE_COSMOS` dual-run seam keeps P3–P8 shippable before P9/P10.
