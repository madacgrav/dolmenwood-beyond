# Implementation Plan

## Overview
Every account is a player; DM-ship is per-campaign via `CampaignDoc.refereeId` (already enforced server-side). Remove the global `role` field, drop the sign-up role choice, make the campaign page derive DM affordances per-tab, and backfill existing docs.

**Commands** (run from repo root):
- Tests: `npm --prefix apps/web run test`
- Typecheck: `npm --prefix apps/web run typecheck`
- Lint: `npm --prefix apps/web run lint`

Each phase must leave typecheck + tests green.

---

## Phase 1: Campaign page → hybrid, tab-appropriate DM-ship

### Changes

#### 1. `listMyCampaignNames` carries `is_dm` (data)
**File**: `apps/web/src/lib/data/campaigns.ts` **Action**: modify (`:215-227`)

```ts
/** Lightweight id+name+is_dm list of campaigns the caller participates in. */
export async function listMyCampaignNames(): Promise<{ id: string; name: string; is_dm: boolean }[]> {
  const me = await requireAccountId();
  const [runByMe, memberOf] = await Promise.all([
    listCampaignsRunByDM(me),
    listCampaignsWithMember(me),
  ]);
  const seen = new Map<string, { name: string; is_dm: boolean }>();
  for (const c of memberOf) seen.set(c.id, { name: c.name, is_dm: false });
  for (const c of runByMe) seen.set(c.id, { name: c.name, is_dm: true }); // DM wins on overlap
  return [...seen.entries()]
    .map(([id, { name, is_dm }]) => ({ id, name, is_dm }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
```

#### 2. Client wrapper type (api)
**File**: `apps/web/src/lib/api/campaigns.ts` **Action**: modify (`:72-77`)

```ts
export async function listMyCampaignNames(): Promise<{ id: string; name: string; is_dm: boolean }[]> {
  const res = await fetch('/api/campaigns?as=names');
  if (!res.ok) return [];
  const body = await res.json();
  return body.campaigns ?? [];
}
```
(The `?as=names` route returns `listMyCampaignNames()` output verbatim — no route change needed.)

#### 3. Campaign page: drop global role, gate Bank on run-campaigns
**File**: `apps/web/src/app/(app)/campaign/page.tsx` **Action**: modify

- Add import: `import { loadDMCampaigns } from '@/lib/api/campaigns';`
- Replace `isDM` state with `hasDMCampaigns`; replace `checkRole()`:

```tsx
const [hasDMCampaigns, setHasDMCampaigns] = useState(false);
// ...
useEffect(() => {
  async function init() {
    const res = await fetch('/api/account');
    if (res.ok) {
      const account: { id: string } = await res.json();
      setUserId(account.id);
    }
    const dm = await loadDMCampaigns();
    setHasDMCampaigns(!!dm && dm.campaigns.length > 0);
    setLoading(false);
  }
  init();
}, []);
```

- `visibleTabs`: `tabs.filter(t => !t.dmOnly || hasDMCampaigns)` (`:35`).
- Remove the `isDM && "DM view"` header caption block (`:56-60`).
- Overview render: `{activeTab === 'overview' && userId && <OverviewTab userId={userId} />}` (drop `isDM`).
- Bank render gate: `{activeTab === 'bank' && hasDMCampaigns && (...)}` (`:100`).
- Schedule render: `<ScheduleTab userId={userId} />` (drop `isDM`).

#### 4. OverviewTab: show both sections
**File**: `apps/web/src/components/campaign/OverviewTab.tsx` **Action**: modify

```tsx
'use client';
import { DungeonMasterView } from './overview/DungeonMasterView';
import { PlayerView } from './overview/PlayerView';

export function OverviewTab({ userId }: { userId: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <DungeonMasterView userId={userId} />
      <PlayerView userId={userId} />
    </div>
  );
}
```
(`DungeonMasterView`/`PlayerView` unchanged — each already loads and lists its own campaigns and renders its own empty state.)

#### 5. ScheduleTab: derive per-campaign `is_dm`
**File**: `apps/web/src/components/campaign/ScheduleTab.tsx` **Action**: modify

- `CampaignOption` gains `is_dm: boolean` (`:19-22`).
- Signature: `export function ScheduleTab({ userId }: { userId: string })` (drop `isDM` prop, `:24`).
- `listMyCampaignNames()` already returns `is_dm` now, so `setCampaigns(list)` at `:53-54` type-checks.
- Derive after `campaignId`: `const isDM = campaigns.find(c => c.id === campaignId)?.is_dm ?? false;`
- Existing `isDM` references at `:193` (`ProposalsSection`) and `:267` (`SessionList`) now use the local var — no further change.

### Verification
#### Automated
- [x] `npm --prefix apps/web run typecheck` passes
- [x] `npm --prefix apps/web run test` passes
#### Manual
- [ ] Account running campaign A and joined to B: Overview shows A's DM card (invite/XP/pack animals) and B's player roster.
- [ ] Bank tab visible (runs A); hidden for an account that runs no campaign.
- [ ] Schedule: pick A → New session + edit/delete controls present; pick B → RSVP only, no DM controls.

---

## Phase 2: Sign-up single step + stop forwarding role

### Changes

#### 1. Sign-up page → one step
**File**: `apps/web/src/app/(auth)/sign-up/page.tsx` **Action**: modify
- Delete `type Role` (`:8`), `step` state (`:12`), `role` state (`:16`), the `RoleCard` component (`:166-189`), the step-dots block (`:79-87`).
- Subtitle: always `'Create your account'` (`:75`).
- `handleSubmit`: remove the `if (step === 'details') { setStep('role'); return; }` gate; POST body drops `role`:

```tsx
body: JSON.stringify({ email, password, displayName: displayName || email.split('@')[0] }),
```

- Form body: keep only the `details` fields (displayName/email/password), replace the `Continue` button with the submit button:

```tsx
<button type="submit" disabled={loading} style={primaryButtonStyle}>
  {loading ? 'Creating account…' : 'Create Account'}
</button>
```
(Remove the `step === 'details' ? ... : ...` conditional and the Back button.)

#### 2. Register route drops role
**File**: `apps/web/src/app/api/auth/register/route.ts` **Action**: modify
- Delete the `role` line (`:8`).
- Call: `await createAccount({ email, password, displayName });` (`:19`).

#### 3. `SignUpInput` drops role; `createAccount` hardcodes `'player'`
**File**: `apps/web/src/lib/data/account.ts` **Action**: modify
- `SignUpInput`: remove `role: 'player' | 'referee';` (`:31`).
- `createAccount` doc: `role: 'player',` (replace `:109`). *(Field still written this phase so `AccountDoc` stays satisfied; removed in Phase 3.)*

### Verification
#### Automated
- [x] `npm --prefix apps/web run typecheck` passes
- [x] `npm --prefix apps/web run test` passes
#### Manual
- [ ] `/sign-up` is a single-step form; no role picker, no step dots.
- [ ] Submitting creates the account and lands on `/characters`.

---

## Phase 3: Delete the `role` field/type + display reads

Land all together — deleting the type breaks the readers otherwise.

### Changes

#### 1. `AccountDoc` drops role
**File**: `apps/web/src/lib/cosmos/types.ts` **Action**: modify — remove `role: 'player' | 'referee'` (`:15`) and its compat comment (`:13-14`).

#### 2. Shared types drop `Role`
**File**: `packages/types/src/index.ts` **Action**: modify — remove `export type Role` (`:5`) + comment (`:3-4`); remove `role: Role;` from `Account` (`:45`).
> Pre-check: `grep -rn "Role" packages/ apps/ --include=*.ts --include=*.tsx | grep -v refereeId` returns no importers of the exported `Role` type outside the removed sites.

#### 3. `account.ts` drops role
**File**: `apps/web/src/lib/data/account.ts` **Action**: modify — remove `role: string;` from `Account` (`:20`), the `role: doc.role,` line in `docToAccount` (`:42`), and the `role: 'player',` line in `createAccount` (from Phase 2).

#### 4. Admin data + page drop role
**File**: `apps/web/src/lib/data/admin.ts` **Action**: modify — remove `role: string;` from `AdminData.accounts[]` (`:14`) and `role: a.role,` (`:58`).
**File**: `apps/web/src/app/(app)/admin/page.tsx` **Action**: modify — remove `role: string;` from the row type (`:10`); remove the Role table column (header + the `acc.role === 'referee' ? 'Dungeon Master' : 'Player'` cell, `:188`).

#### 5. Settings badge removed
**File**: `apps/web/src/app/(app)/settings/components/ProfileSection.tsx` **Action**: modify — remove `roleBadgeColor` (`:56`) and the badge `<span>` block (`:95-99`); keep the surrounding flex row and the Change Password button.

#### 6. Delete dead auth store
**File**: `apps/web/src/stores/auth-store.ts` **Action**: delete.
> Pre-check: `grep -rn "auth-store\|useAuthStore" apps/web/src` returns only the file itself. If any importer exists, instead remove just `role`/`setRole` and the `role: null` reset.

#### 7. Test fixtures drop role
**Files**: `apps/web/src/test/__tests__/account.test.ts`, `campaigns.test.ts`, `bank-levelup.test.ts`, `proposals-notifications.test.ts`, `notification-whatsapp.test.ts` **Action**: modify
- Remove `role` from seeded account casts (e.g. `campaigns.test.ts:5-7`: `{ id: 'ref-1', displayName: 'The Referee' } as AccountDoc`).
- `account.test.ts`: remove `role` from `createAccount` inputs and drop the role assertions (`:24,33,39`) and the `role: 'referee'` expectation in the `fetchAccount` test (`:77`).

### Verification
#### Automated
- [ ] `npm --prefix apps/web run typecheck` passes
- [ ] `npm --prefix apps/web run test` passes
- [ ] `grep -rn "\.role\|'referee'\|\"referee\"" apps/web/src packages/types/src` returns only `refereeId` and the `?as=referee` param (no account-role references)
#### Manual
- [ ] Settings shows no role badge; admin table has no Role column.

---

## Phase 4: Backfill — strip `role` from stored account docs

### Changes

#### 1. Pure helper + test
**File**: `scripts/lib/transform.ts` **Action**: modify (add export)

```ts
/** Drop the removed global `role` field from a stored account doc (issue #38). */
export function stripRole<T extends Record<string, unknown>>(doc: T): Omit<T, 'role'> {
  const { role: _role, ...rest } = doc;
  return rest;
}
```

**File**: `apps/web/src/test/__tests__/migration-transform.test.ts` **Action**: modify — add:

```ts
import { stripRole } from '../../../../../scripts/lib/transform';

describe('stripRole', () => {
  it('removes role and preserves other fields', () => {
    const out = stripRole({ id: 'a1', role: 'referee', email: 'x@y.z', isAdmin: false });
    expect('role' in out).toBe(false);
    expect(out).toEqual({ id: 'a1', email: 'x@y.z', isAdmin: false });
  });
});
```

#### 2. Backfill script
**File**: `scripts/strip-account-role.ts` **Action**: create — mirror `scripts/migrate-supabase-to-cosmos.ts` client setup; idempotent upsert.

```ts
/**
 * One-time backfill (issue #38): removes the obsolete `role` field from every
 * account doc. Idempotent (upsert). Run:
 *   COSMOS_ENDPOINT=... COSMOS_KEY=... npx tsx scripts/strip-account-role.ts
 */
import { CosmosClient } from '@azure/cosmos';
import { stripRole } from './lib/transform';

async function main() {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  if (!endpoint || !key) throw new Error('COSMOS_ENDPOINT and COSMOS_KEY required');

  const container = new CosmosClient({ endpoint, key })
    .database(process.env.COSMOS_DATABASE ?? 'dolmenwood')
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

main().catch((e) => { console.error(e); process.exit(1); });
```
> Confirm the Cosmos database name against `apps/web/src/lib/cosmos/client.ts` before running (adjust the `COSMOS_DATABASE` default if needed).

### Verification
#### Automated
- [ ] `npm --prefix apps/web run test` passes (includes the `stripRole` test)
#### Manual
- [ ] Dry check: `SELECT VALUE COUNT(1) FROM c WHERE IS_DEFINED(c.role)` on the `accounts` container is 0 after running the script (env-gated; run against a non-prod instance first).

---

## Deviations from structure.md
- **Phase 2 hardcodes `role: 'player'`** in `createAccount` rather than dropping the write immediately, so each phase stays typecheck-green; the field write is removed in Phase 3 along with the type. (Structure implied Phase 2 stops writing role; splitting the write-removal into Phase 3 avoids a red typecheck between phases.)
- No other deviations. Phase order unchanged.
