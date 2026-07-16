# Structure Outline

## Approach
Four vertical slices. Flip the main role consumer (campaign page) to per-campaign DM-ship first using existing endpoints, then stop writing `role`, then delete the field/type and remaining display reads, then backfill stored docs. Server authz is untouched — it already keys on `refereeId`/`members`.

No new endpoint needed for the selector: the page merges the two existing wrappers — `loadDMCampaigns()` returns campaigns the caller runs (flag `is_dm = true`), `loadPlayerCampaigns()` returns joined ones (`is_dm = false`).

---

## Phase 1: Campaign page → hybrid, tab-appropriate DM-ship
Remove the global `account.role` gate. Overview shows both DM and Player sections; Bank tab is gated on "runs ≥1 campaign"; Schedule derives per-campaign `is_dm` from its own picker.

**Files**: `apps/web/src/app/(app)/campaign/page.tsx`, `apps/web/src/components/campaign/OverviewTab.tsx`, `apps/web/src/components/campaign/ScheduleTab.tsx`, `apps/web/src/lib/data/campaigns.ts` (`listMyCampaignNames`), `apps/web/src/lib/api/campaigns.ts` (`listMyCampaignNames` type). Reuse `overview/DungeonMasterView.tsx` + `overview/PlayerView.tsx` unchanged.

**Key changes**:
- `listMyCampaignNames()` (data + client) returns `{ id: string; name: string; is_dm: boolean }[]` — DM-run campaigns flagged `is_dm: true`, joined ones `false`.
- Page: replace `checkRole()` role read with `hasDMCampaigns` (from `loadDMCampaigns()`); keep `/api/account` fetch only for `userId`. Bank tab `dmOnly` gate uses `hasDMCampaigns`.
- `OverviewTab`: drop `isDM` prop; render `<DungeonMasterView>` and `<PlayerView>` stacked.
- `ScheduleTab`: drop `isDM` prop; store `is_dm` per campaign option; compute `isDM = selectedCampaign.is_dm` and use it where the prop was passed (ProposalsSection, SessionList).

**Verify**: `npm --prefix apps/web run test` green; manual — an account that runs campaign A and joined campaign B sees a DM card for A and a player roster for B in Overview; Bank tab appears (A run); in Schedule, DM controls show for A and not for B.

---

## Phase 2: Sign-up single step + stop writing role
Sign-up collects no role; registration path stops accepting/writing it. `AccountDoc.role` still exists (removed in Phase 3) but is no longer set on new docs.

**Files**: `apps/web/src/app/(auth)/sign-up/page.tsx`, `apps/web/src/app/api/auth/register/route.ts`, `apps/web/src/lib/data/account.ts`.

**Key changes**:
- Sign-up: drop `step: 'role'`, the `Role` alias (`page.tsx:8`), `role` state, and both `RoleCard`s; collapse to single-step form; POST body loses `role`.
- `register/route.ts`: remove role coercion (`:8`); `createAccount({ email, password, displayName })`.
- `account.ts`: `SignUpInput` loses `role` (`:31`); `createAccount` stops setting `role` (`:109`).

**Verify**: tests green; manual — sign-up is one step, submitting creates an account and auto-signs-in to `/characters`; new account doc has no `role` written.

---

## Phase 3: Delete the `role` field/type + remaining display reads
Remove every remaining reference so typecheck is clean. Deletes the field, the shared type, and the two display consumers in one slice (they must land together — the type deletion breaks the readers otherwise).

**Files**: `apps/web/src/lib/cosmos/types.ts` (`AccountDoc.role` `:15`), `packages/types/src/index.ts` (`Role` `:5`, `Account.role` `:45`), `apps/web/src/lib/data/account.ts` (`Account.role` `:20`, `docToAccount` `:42`), `apps/web/src/lib/data/admin.ts` (`AdminData.accounts[].role` `:14`, passthrough `:58`), `apps/web/src/app/(app)/admin/page.tsx` (row type `:10`, label `:188`), `apps/web/src/app/(app)/settings/components/ProfileSection.tsx` (badge `:56,95-99`), `apps/web/src/stores/auth-store.ts` (role state, or delete store if unused), plus test fixtures that seed `role` (`account.test.ts`, `campaigns.test.ts`, `bank-levelup.test.ts`, `proposals-notifications.test.ts`, `notification-whatsapp.test.ts`).

**Key changes**:
- `AccountDoc` and `Account` (both shapes) drop `role`.
- `packages/types` `Role` removed (confirm no external importers first).
- ProfileSection: remove role badge block; admin table: remove role column.
- Test seeds: drop `role` from account fixtures.

**Verify**: `pnpm -w typecheck` (or `tsc --noEmit`) clean; full vitest suite green; grep for `role` / `referee` in `apps/web/src` returns only `refereeId` and `?as=referee` (unrelated concepts).

---

## Phase 4: Backfill — strip `role` from stored account docs
One-off idempotent script that upserts existing account docs with `role` removed. Pure helper + direct unit test, mirroring `scripts/lib/transform.ts` + `migration-transform.test.ts`.

**Files**: new `scripts/strip-account-role.ts`, helper in `scripts/lib/transform.ts` (e.g. `stripRole(doc): AccountDoc`), test in `apps/web/src/test/__tests__/migration-transform.test.ts` (or a new `strip-role.test.ts`).

**Key changes**:
- `stripRole(doc: Record<string, unknown>): Record<string, unknown>` — returns doc without `role`.
- Script: read all `accounts`, upsert each stripped doc; reconcile counts; `npx tsx scripts/strip-account-role.ts` with `COSMOS_ENDPOINT`/`COSMOS_KEY` env.

**Verify**: unit test asserts `stripRole` removes `role` and preserves all other fields; script runs idempotently against a Cosmos instance (dry-run/count check) — manual, gated on env.

---

## Testing Checkpoints
- **After P1**: campaign page works with per-campaign selector; no code reads `account.role` for gating (only display reads remain). Existing campaign tests green.
- **After P2**: sign-up is one step; new accounts created without a written `role`. Register/account tests green.
- **After P3**: `role` fully gone from types and app code; typecheck clean; whole vitest suite green; only `refereeId`/`?as=referee` remain in grep.
- **After P4**: stored account docs can be stripped of `role` via a tested, idempotent script.

## Notes / Deferrals
- Phase 1 is the largest slice (UI restructure). If the selector UX proves heavy, it can split into 1a (merge-load + selector list, keep existing two-view render) and 1b (scope tabs per selection) — but both must land before `role` is removed as a gate.
- Confirm during P3 that Auth.js session/JWT does not embed `role` (research found no role logic in `lib/auth/*`).
- Confirm during P3 there are no `packages/types` `Role` importers outside `apps/web` before deleting the exported type.
