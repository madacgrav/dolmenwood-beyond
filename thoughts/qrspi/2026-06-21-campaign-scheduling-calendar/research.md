# Research Findings

Codebase: Dolmenwood Beyond — Next.js 15 (App Router) + Supabase monorepo. All paths relative to `apps/web/` or `supabase/` unless noted.

## Q1: Campaign membership modeling & RLS enforcement

### Findings

**Tables** (`supabase/migrations/20260425000001_initial_schema.sql`):
- `accounts` (`:8-15`): `id uuid PK → auth.users`, `email`, `role text CHECK (role IN ('player','referee'))`, `display_name`, `created_at/updated_at timestamptz`. `is_admin boolean` added later (`20260511000013_admin_role.sql:2`). `role` set at signup by `handle_new_user()` from `raw_user_meta_data->>'role'`, default `'player'` (`:382-397`).
- `campaigns` (`:34-40`): `id uuid PK default gen_random_uuid()`, `name`, `referee_id uuid NOT NULL → accounts(id) ON DELETE CASCADE`, `invite_code text UNIQUE`, `created_at`. No `updated_at`, no trigger.
- `campaign_members` (`:54-59`): pure join table — `campaign_id`, `account_id`, `joined_at`, `PRIMARY KEY (campaign_id, account_id)`. No role column; membership = row presence. Referee is identified via `campaigns.referee_id`, not a member row.

**RLS helper functions** (`20260425000005_fix_rls_recursion.sql`), both `language sql security definer stable set search_path = public`:
- `is_campaign_member(p_campaign_id uuid)` (`:14-26`): `EXISTS (SELECT 1 FROM campaign_members WHERE campaign_id=p_campaign_id AND account_id=auth.uid())`.
- `is_campaign_referee(p_campaign_id uuid)` (`:29-41`): `EXISTS (SELECT 1 FROM campaigns WHERE id=p_campaign_id AND referee_id=auth.uid())`.

**Policies referencing helpers**: `campaigns` SELECT uses `is_campaign_member(id)` (`:51-53`); `campaign_members` SELECT uses `is_campaign_referee(campaign_id)` (`:56-58`).

**Recursion fix**: original policies put inline `EXISTS(SELECT … FROM campaign_members)` in a `campaigns` policy and vice-versa (`20260425000001:86-94`, `:67-75`). Each raw table reference re-triggered the *other* table's RLS → infinite mutual recursion (diagnosed in header comment `:1-11`). Fix dropped the three cross-table policies (`:44-48`), introduced the two `SECURITY DEFINER` helpers (which bypass RLS on their internal selects), and recreated the policies calling the helpers instead of inline subselects.

**Note**: `bank_ledger` policies do NOT use the helpers — they check `accounts.role='referee'` inline or resolve through `characters.owner_id=auth.uid()` (see Q2). Helpers are specifically the campaign-scope cross-table pattern.

## Q2: Pattern for adding a new migration

### Findings

**Naming**: `YYYYMMDDNNNNNN_description.sql`, 6-digit sequence increments globally (not per-date), applied in lexicographic order. Latest is `20260612000022_bank_transaction_rpc.sql`.

**Reference migration `20260503000006_banking.sql`** (campaign-scoped append-only table `bank_ledger`):
- ALTER existing table to add columns w/ CHECK (`:6-9`).
- `CREATE TABLE public.bank_ledger` (`:14-21`): `id uuid PK default gen_random_uuid()`; FKs inline `references public.characters(id) on delete cascade` and `references public.accounts(id)` (no cascade); `amount_gp int CHECK (amount_gp <> 0)`; `created_at timestamptz not null default now()`. **No `updated_at`** — append-only tables omit it and the trigger.
- Index `idx_bank_ledger_character on bank_ledger(character_id, created_at desc)` (`:23`).
- `alter table … enable row level security` immediately after (`:25`).
- One policy per command per actor (`:28-72`): player SELECT via `characters.owner_id=auth.uid()`; player INSERT with `WITH CHECK (amount_gp>0 AND performed_by=auth.uid() AND owner check)`; referee SELECT/INSERT via `accounts.role='referee'`. No UPDATE/DELETE policies (append-only).

**`updated_at` convention**: trigger fn `handle_updated_at()` (`20260425000001:366-372`) sets `new.updated_at=now()`; wired only to `characters` (`:374-376`). `accounts` has the column but no trigger. Mutable entity tables get `updated_at`+trigger; append-only tables (`bank_ledger`, `campaign_members`, `level_up_logs`) do not.

## Q3: RPC definition & invocation pattern

### Findings

All RPCs are `language plpgsql security definer set search_path = public`, with `auth.uid()` as the trusted caller identity (never a client-supplied account id), and paired `revoke execute … from public; grant execute … to authenticated;`.

- **`create_campaign(p_name text) → uuid`** (`20260503000007:56-72`): generates invite code, inserts `campaigns` with `referee_id=auth.uid()`. Grants in `20260512000014:196-197`. Called `campaigns.ts:198` `supabase.rpc('create_campaign',{p_name})` ← `RefereeView.tsx:63`.
- **`join_campaign(p_invite_code text) → json`** (latest: `20260512000014:101-137`, drops earlier uuid-returning version): looks up campaign by `upper(trim(code))`, raises on invalid/duplicate, inserts member as `auth.uid()`, returns `{campaign_id, campaign_name}`. Called `campaigns.ts:206` ← `PlayerView.tsx:34`.
- **`award_xp(p_character_id uuid, p_gain int) → int`** (`20260508000008:9-47`): 3-way JOIN verifies caller is `referee_id` of a campaign containing the character AND `owner_id != auth.uid()` (blocks self-award). Called `campaigns.ts:215` ← `RefereeView.tsx:109` via `Promise.all`.
- **`bank_transaction(p_character_id uuid, p_amount_gp int, p_description text default '') → void`** (`20260612000022:20-97`): `SELECT … FOR UPDATE` row lock; positive=deposit (owner or referee), negative=payout (referee only); inserts ledger + updates character coins atomically. Called `bank.ts:59-63` ← `BankingTab.tsx:73` (always negative).
- **`get_campaign_party_data(p_campaign_id uuid) → json`** (`20260512000014:143-191`): first checks caller membership (raises otherwise), then returns nested json of members→characters, bypassing `characters` RLS so players see party members' sheets. Called `campaigns.ts:158` inside `loadPlayerCampaigns` via fan-out `Promise.all`.

**Invocation convention**: every `lib/data/*` function takes `SupabaseClient` as first arg (callers instantiate the client), returns `{data?, error}`-shaped results; errors surfaced as `error.message`.

## Q4: Data flow Supabase → UI (campaign-scoped)

### Findings

**`lib/data/campaigns.ts`** exports: `loadRefereeCampaigns` (`:66`, 4 sequential table queries → `RefereeCampaignsData`), `loadPlayerCampaigns` (`:140`, `campaign_members` + fan-out `get_campaign_party_data` RPC → `CampaignData[]`), `createCampaign`/`joinCampaign`/`awardXP` (RPC wrappers), `insertPackAnimal`/`removePackAnimal` (mounts table).

**Page bootstrap** `app/(app)/campaign/page.tsx` (`'use client'`): `checkRole()` (`:17-29`) calls `supabase.auth.getUser()` then `accounts.select('role')`; sets local `useState` `isReferee` + `userId`. **Does NOT use `useAuthStore`** — issues its own auth+role query. Tab descriptor `{id:'bank', refereeOnly:true}` (`:32-35`) filtered by `!t.refereeOnly || isReferee` (`:37`); bank also guarded `isReferee && <BankingTab/>` (`:102`).

**Branching** `OverviewTab.tsx:11-13`: pure branch, no fetching — `isReferee ? <RefereeView/> : <PlayerView/>`, passes `userId` down.

**RefereeView** (`:22`): own client via `useMemo(()=>createClient(),[])`; `loadRefereeCampaigns(supabase,userId)` on mount → splits into `campaigns` + `packAnimals` state; passes to `MemberList`/`XPAwardPanel`/`PackAnimalsSection`. `xpAwards` is local `Record<campaignId,…>` state, not a store.

**PlayerView** (`:10`): own client; `loadPlayerCampaigns` → `CampaignData[]` → renders `<PartyRoster>` per campaign.

**BankingTab** (`:29`): `Promise.all` of `characters` select + `listLedger` (`bank.ts:37`), joins client-side per character, sums balances; transfers call `recordBankTransaction` then re-run `loadData()`.

**Zustand**: `stores/auth-store.ts` defines `useAuthStore` (`user`, `role`, `isLoading`) but campaign feature does not import it — each component fetches independently and holds local `useState`.

## Q5: Realtime usage & date/time handling

### Findings

**Only Realtime subscription**: `hooks/use-characters.ts:29-36` — `supabase.channel('characters').on('postgres_changes', {event:'*', schema:'public', table:'characters'}, () => fetchCharacters()).subscribe()`. No `filter:`. Callback ignores payload and does a full refetch via `listCharacters` → `setCharacters(mapped)` (`:22`). Cleanup: `return () => supabase.removeChannel(channel)` (`:38`). Pattern = "any change → full refetch & wholesale state replace."

**Timestamps**: all `timestamptz`; `created_at … default now()` universal; `updated_at … default now()` only on `accounts` & `characters`; `campaign_members.joined_at` (`20260425000001:58`); `level_up_logs.timestamp` (`:343`).

**Date formatting**: only utility is `formatWPDate` (`lib/wordpress.ts:50-56`) — `new Date(str).toLocaleDateString('en-US',{year,month:'long',day})`.

**No date/calendar library**: `apps/web/package.json:14-26` deps are rules-engine, types, @supabase/ssr, supabase-js, clsx, next, next-pwa, react, react-dom, tailwind-merge, zustand. No date-fns/dayjs/react-datepicker/etc.

## Q6: Routing, navigation & shared-UI conventions

### Findings

**Route group `app/(app)/`** wrapped by `layout.tsx:6-26` (server component; reads `accounts.is_admin`, passes `isAdmin` to `<BottomNav>`; `main` has `paddingBottom:80px`). Folders: `characters/` (+ nested `new/auto|manual|import`, `[id]/view|level-up|level-up-log`), `news/` + `[slug]`, `campaign/`, `party/` (stub), `admin/`, `settings/`.

**BottomNav** (`components/layout/BottomNav.tsx`): `BASE_NAV_ITEMS` array (`:12-17`) of `{href,label,icon}` — Characters/News/Campaign/Settings; `ADMIN_NAV_ITEM` (`:19`) appended when `isAdmin` (`:27`). Active state `pathname.startsWith(item.href)` (`:47`) → `var(--color-primary)` + weight 600. **`/party` has no nav entry.**

**Tabbed page** `campaign/page.tsx`: `TabId = 'overview'|'bank'` (`:8`), `useState<TabId>('overview')` (`:11`); `tabs` array with optional `refereeOnly` (`:32-35`); `visibleTabs` filter (`:37`); tab bar rendered only if `visibleTabs.length>1` (`:66-95`), inline `borderBottom:2px solid var(--color-primary)` active style; content via `{activeTab==='x' && <Tab/>}`.

**Party stub** `party/page.tsx:1-8`: static "coming soon" placeholder, no logic, not nav-linked.

**Shared UI primitives** (`components/ui/`, Tailwind + `cn()` from `@/lib/utils`):
- `Button.tsx:4-7`: props `variant?:'primary'|'secondary'|'danger'|'ghost'`, `size?:'sm'|'md'|'lg'`, spreads native button attrs.
- `Card.tsx:4-6`: props `elevated?:boolean`, `rounded-lg bg-[var(--color-surface)] border`, adds `shadow-md` when elevated.

**Feature forms/modals use raw inline styles, NOT the primitives**:
- `CampaignCreateForm.tsx:3-10`: fully controlled — parent owns `name`/`error`/`loading` + `onNameChange`/`onCreate`/`onCancel`; Enter-key submits (`:30`).
- `DeleteAccountModal.tsx:3-10`: fixed fullscreen overlay (`inset:0, zIndex:200`), confirm disabled until typed text `==='DELETE'` (`:53`); parent owns state.

## Cross-Cutting Observations

- **Two authorization layers**: DB-level RLS + `SECURITY DEFINER` RPCs that re-check `auth.uid()` membership/role. Cross-campaign-table checks must use the `is_campaign_member`/`is_campaign_referee` helpers to avoid RLS recursion; same-actor checks use inline `accounts.role` or `characters.owner_id`.
- **Client instantiation is per-component** (`useMemo(()=>createClient(),[])`); `lib/data/*` functions are stateless and receive the client. Return shape is consistently `{data?, error}` with `error.message` strings.
- **Role determination is duplicated**, not centralized: the campaign page re-queries `accounts.role` rather than reading `useAuthStore`.
- **Styling is split**: reusable `ui/` primitives use Tailwind+`cn()`; feature components use inline `style={{}}` with `var(--color-*)` / `var(--font-display)` CSS custom properties.
- **Append-only ledger pattern** (`bank_ledger`): timestamped, indexed `(fk, created_at desc)`, no `updated_at`, no UPDATE/DELETE policies, mutations via atomic `SECURITY DEFINER` RPC with `FOR UPDATE` locking.
- **Realtime is coarse**: single channel, no row filter, full-refetch callback.

## Open Areas

- No existing scheduling, calendar, RSVP, availability, or notification tables/UI exist — there is no in-codebase precedent for those specific concerns (only the patterns above to model against).
- No push-notification or email-dispatch mechanism observed in migrations or `lib/`; the WordPress news feed is read-only ISR, unrelated to user-generated events.
- `party/page.tsx` is an unused stub not wired into navigation; its intended relationship to `/campaign` is not defined in code.
