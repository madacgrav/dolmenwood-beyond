# Research Findings

Implementation-status survey of Dolmenwood Beyond against the PRD feature set. Every
finding is grounded in a `file:line` reference. Describes what IS, not what should be.

---

## Q1: Creation wizards — real steps vs "coming soon"/skip fallbacks

### Findings

- **Mode select** (`apps/web/src/app/(app)/characters/new/page.tsx:7-32`): three modes — `auto`, `manual`, `import`. `import` routes straight to `/characters/new/import`; `auto`/`manual` call `reset()` + `setMode()` then redirect to step 1 (`page.tsx:38,77-79`).
- **Auto path is COMPLETE 1–13.** `auto/[step]/page.tsx:44-58` maps all 13 step numbers to real components (`Step1AbilityScores`…`Step13Details`). The "coming soon" fallback at `auto/[step]/page.tsx:60-68` is unreachable because every slot is populated. Step 14 redirects to `/auto/complete` (`:36-38`).
- **Manual path is PARTIAL — steps 1–7 real, 8–13 stubbed.** `manual/[step]/page.tsx:36-51` gates `if (step > 7)` and renders `"Step N: … — coming soon"` with a "Skip to next step →" link (steps 8–12) or "Finish →" link to `/manual/complete` (step 13). Steps 1–7 render via the switch at `:53-70`.
  - Manual steps 1 & 7 use dedicated `ManualStep1AbilityScores` and `ManualStep7HP`; steps 2–6 reuse the shared auto components with `basePath='/characters/new/manual'`. **No `ManualStep8`–`ManualStep13` components exist.**
- **Import path is COMPLETE & self-contained** (`import/page.tsx`, does not use the wizard store). Accepts JSON via file-upload or paste tabs (`:235-293`), validates required fields + ability-score ranges 3–18 (`validateJson` `:33-84`), saves via `createCharacter` then redirects to `/characters/{id}` (`:131-147`). Sample at `/sample-character.json`.
- **`wizard-store.ts`** (Zustand, not persisted): holds `mode`, `step`, `totalSteps:13`, `abilityScores`, `kindred`, `characterClass`, `alignment`, `hpMax`, name/sex/age/height/weight/background, `portraitUrl` (`wizard-store.ts:6-45`). `reset()` zeroes character data but keeps `mode`/`totalSteps` (`:80-85`). Step pages are server components; client Step components call `useWizardStore()` directly.
- Note: several auto step components are **display-only / don't persist to the store** — `Step8Equipment` keeps local item state only; `Step10Speed` uses a hardcoded `ESTIMATED_WEIGHT = 200` and never reads the store; `Step9AC`/`Step12LevelXP` are computed displays.

**Gap:** Manual creation steps 8–13 (equipment, AC, speed, alignment, level/XP, name & details) are not implemented.

---

## Q2: Character-sheet interactive in-play tools

### Findings

| Tool | Status | Reference |
|---|---|---|
| Skill-check roller | **IMPLEMENTED** (rolls **d6** vs target) | `stats/SkillsSection.tsx:21-25,50-56` |
| Weapon attack roller | **IMPLEMENTED** (d20 atk + damage; STR mod on melee) | `combat/AttackSection.tsx:20-27,55-83` |
| Save roller | **IMPLEMENTED in CombatTab**; StatsTab version is display-only | `combat/SavingThrowsSection.tsx:38-79` vs `stats/SavingThrowsSection.tsx:26-39` |
| Start-Battle / ammo counter | **IMPLEMENTED** (shot-decrement, half-recovery on end) | `combat/use-ammo-tracking.ts:30-67`, `BattleModal.tsx`, `AmmoSection.tsx:63-75` |
| Inventory restock tool | **IMPLEMENTED** (9 consumables, gold auto-deduct, insufficient-funds override) | `inventory/restock-data.ts:9-39`, `use-restock.ts:46-95`, `RestockSheet.tsx` |
| Coin-weight encumbrance | **NOT IMPLEMENTED** | see below |
| Spell-slot + memorization | **IMPLEMENTED** (toggle slot, cast/restore, rest) | `magic/use-spells.ts:119-167`, `SpellSlotsSection.tsx:69-84`, `PreparedSpellsSection.tsx` |

- **Coin-weight encumbrance absent:** `WeightBar.tsx:11-14` sums only inventory rows' `weight_coins` and excludes coins entirely. Coins live in a separate `{gp,sp,cp}` struct (`use-inventory.ts:22`) with no weight field and no toggle. The `coinWeightEnabled` settings toggle (Q6) is never read here.
- All character-sheet feature areas (Stats/Combat/Inventory/Magic/Notes/header) have rich sub-component trees; full file inventory captured in agent report.

**Gap:** Coin-weight-toward-encumbrance (and its optional-rule toggle) is the one unbuilt in-play tool.

---

## Q3: Retainers and mounts

### Findings

- **Tables exist** (`supabase/migrations/20260425000001_initial_schema.sql`): `retainers` (`:180-213`, includes `is_promoted_to_pc` at `:197`) and `mounts` (`:219-258`, includes `has_full_stats` at `:228`). Pack-animal distinction is `owner_type='party'` + `campaign_id`, not a boolean column. Later migration adds `mounts.character_id` (`20260512000017:5-6`).
- **rules-engine `retainers.ts`** exports `getMaxRetainers` (`:3`), `getRetainerLoyaltyBase` (`:7`), `getMagicResistance` (`:11`). **No half-XP and no wage computation** anywhere in rules-engine.
- **`AddRetainerForm`** (`stats/AddRetainerForm.tsx:17-64`): name, kindred, class, level, ac, hp_max, attack_bonus, wage_type, wage_amount. Does **not** capture saves/speed/morale/loyalty (defaulted in `use-retainers.ts:18-22`). Rendered inline in StatsTab via `RetainersSection`.
- **No dedicated retainer route/sheet** — only the inline `RetainersSection` + `RetainerCard` + `AddRetainerForm` within the Stats tab. No `/retainers/[id]`.
- **Promote-to-PC IS IMPLEMENTED** (`PromoteRetainerModal.tsx`, `PromoteSuccessToast.tsx`, `use-retainers.ts:54-89`). Inserts a new `characters` row but with **default ability scores 10/10/… and `alignment:'neutral'`** — the retainer's ac/attack/saves are NOT carried over (`use-retainers.ts:63-75`). Retainer row is flagged `is_promoted_to_pc=true`, not deleted (`lib/data/retainers.ts:62-67`).
- **Knight full-stat mounts vs speed-only IS IMPLEMENTED** via `has_full_stats` checkbox (`AddMountForm.tsx:73-106`) and conditional rendering in `MountCard.tsx:45,101-105`. Caveat: mounts never surface `saves` (not in `AddMountForm`, `MountCard`, or `DBMount` interface).
- **Pack animals IS IMPLEMENTED** but referee-only: `PackAnimalsSection` rendered solely in `RefereeView` (`overview/RefereeView.tsx:246-254`); inserts `owner_type:'party', has_full_stats:false` (`lib/data/campaigns.ts:219-244`). Players' campaign view does not fetch mounts.

**Gaps:** retainer half-XP / wage calc not in engine; promote-to-PC discards the retainer's stats; mount saves never surfaced; no standalone retainer sheet (PRD S-06).

---

## Q4: Campaign / party surface

### Findings

- **`campaign/page.tsx`** hosts 3 tabs (`:33-37`): `overview` ("Party", all roles), `bank` (referee-only), `schedule` (all roles). Role detected by querying `accounts.role` (`:17-31`); `visibleTabs` filters referee-only (`:39`); bank double-guarded at `:100-119`.
- **Components** (all under `components/campaign/`): `OverviewTab` (router → Referee/Player view), `BankingTab` (ledger balances + referee payout), `ScheduleTab` (sessions orchestrator, list/month-grid toggle), plus `overview/` (`CampaignCreateForm`, `JoinCampaignForm`, `InviteCodePanel`, `MemberList`, `PackAnimalsSection`, `PartyRoster`, `PlayerView`, `RefereeView`, `XPAwardPanel`) and `schedule/` (`SessionForm`, `SessionList`, `SessionCalendar`, `RsvpControl`, `DeleteSessionModal`). All present and wired.
- **RPCs all implemented and wired end-to-end:** `create_campaign` (`…007:56-72`), `join_campaign` (returns JSON, `…012:1-35`), `award_xp` (`…008:9-46`), `bank_transaction` (`…022:20-94`), `get_campaign_schedule` (`…023:64-104`), `set_session_rsvp` (`…023:107-139`), `get_campaign_party_data` (`…014:143-188`). Session CRUD uses direct table DML (`lib/data/schedule.ts:31-71`).
- **`/party` route is a STUB** (`party/page.tsx:1-8`, "Campaign and party view coming soon.") and **not linked in BottomNav** (which uses `/campaign`). Effectively dead/unreachable.

**Gap:** the orphaned `/party` stub route. The campaign surface itself is substantially complete — this directly contradicts copilot-instructions.md, which still calls `campaign/` a "stub (coming soon)".

---

## Q5: Navigation & shared primitives

### Findings

- **BottomNav** (`components/layout/BottomNav.tsx:12-17`): `/characters`, `/news`, `/campaign`, `/settings`; admin-gated `/admin` appended when `isAdmin` (`:19,27`; gating from `app/(app)/layout.tsx:10-17`). Active state via `pathname.startsWith` (`:47`).
- **Routes vs nav:** every nav target exists; `/party` exists but is **not** in nav (only orphan). All `/characters/*` sub-routes (new/auto|manual|import, [id], [id]/view, [id]/level-up, [id]/level-up-log) reached from Characters tab.
- **No Dice tab/route** — PRD nav lists a "Dice" quick-roller tab; **NOT FOUND**. `dice.ts` exists in rules-engine (logic only); no UI surface for a standalone roller.
- **`packages/ui` is EMPTY** — no source files; `@dolmenwood/ui` imported nowhere. Real workspace packages are only `rules-engine` and `types`.
- **`apps/web/src/components/ui/`**: `HPBar` USED (`characters/CharacterCard.tsx:7,150`); `Button` and `Card` PRESENT but UNUSED (imported nowhere).
- **Only two `// TODO`s in the app, no FIXMEs** — both in `CharacterCard.tsx:24-25`: `armorBonus: 0` and `kindredACBonus: 0` hardcoded into `calculateAC` (`classACBonus`/`shieldBonus` at `:26-27` also 0, no comment). So roster-card AC ignores armor + kindred bonuses.

**Gaps:** PRD "Dice" tab not built; `packages/ui` empty (PRD lists it as the shared component library); `Button`/`Card` primitives unused; roster AC computation incomplete.

---

## Q6: Settings & PWA/offline layer

### Findings

- **Settings sections** (`app/(app)/settings/components/`): `ProfileSection` (display name + password reset), `InviteCodeSection` (copy code), `AppearanceSection` (theme), `OfflineModeSection` (flag only), `OptionalRulesSection` (3 toggles), `DataSection` (export only), `SignOutSection`, `DangerZoneSection` → `DeleteAccountModal` (type "DELETE" to confirm).
- **Optional rules toggles are STORED-BUT-UNUSED.** `use-optional-rules.ts:10` persists `subParReroll` (default true), `hpRerollLowRolls` (false), `coinWeightEnabled` (false) under `dolmenwood-rules`. Repo-wide search finds them consumed **nowhere** outside the hook/UI/test — creation, HP-roll, level-up, and inventory code never read them. PRD's fourth toggle ("customise thief/hunter skills") **does not exist**.
- **`OfflineModeSection`** writes `dolmenwood-offline` to localStorage and nothing reads it — flag-only, no behavior.
- **Data export IMPLEMENTED** (`DataSection.tsx:16-37` → `fetchCharactersForExport` `lib/data/account.ts:51-58`, downloads JSON). **Import NOT FOUND** in settings (import exists only via the separate character-creation Import path, Q1).
- **Account deletion IMPLEMENTED** (`deleteAccount` → `delete_my_account` RPC, `account.ts:43-48`).
- **Theme IMPLEMENTED** client-side: `data-theme` on `<html>` (`AppearanceSection.tsx:12-22`), CSS overrides at `globals.css:29,44`. No SSR persistence — `<html>` has no initial `data-theme` (`layout.tsx:42`).
- **PWA:** `manifest.json` present but **icons are an SVG placeholder only** — `/icons/icon.svg` (gold sword emoji), **no 192/512 PNGs** (`public/icons/` has only `icon.svg` + `.gitkeep`). `next-pwa` configured (`next.config.ts:2-26`, NetworkFirst, disabled in dev); generated `sw.js` + `offline.html` present.

**Gaps:** all 3 optional-rule toggles wired to nothing; offline-mode toggle is a no-op; no settings JSON import; PWA icons still placeholder SVG (no real PNGs).

---

## Q7: rules-engine coverage vs PRD Section 6

### Findings

- **11 modules, all exported via `index.ts`, all with test files** (`__tests__/` 1:1 coverage): ability-modifiers, ac, advancement, combat, dice, kindreds, retainers, skills, speed, spells, xp.
- **All 11 PRD §6.1 derived stats are IMPLEMENTED:** Ability Modifier (`ability-modifiers.ts:11`), AC (`ac.ts:11`), XP Modifier (`xp.ts:4,14`), Max Retainers (`retainers.ts:3`), Retainer Loyalty (`retainers.ts:7`), Speed (`speed.ts:1`), Attack Bonus (`advancement.ts:38`), Save Targets (`advancement.ts:42`), **Magic Resistance** (`retainers.ts:11`, tested `__tests__/retainers.test.ts:10-12`), Skill Targets (`skills.ts:39-68`), Spell Slots (`spells.ts:50`).
- **Data JSON** exceeds PRD spec: `class-advancement.json` covers all 9 classes to **level 15** (PRD said 1–10); `spell-slots.json` 5 caster classes; `spells.json`, `skills.json` (4 classes w/ class skills), `kindreds.json` (6, with `magicResistance:2` for Elf/Grimalkin), `equipment.json` (~101 items), `name-tables.json` (6 kindreds).
- Minor: no `getKindredMagicResistance()` accessor — callers read `getKindredData(k)?.magicResistance` directly.

**Gap:** none material. Rules-engine is the most complete area; coverage meets or exceeds PRD §6.

---

## Cross-Cutting Observations

- **copilot-instructions.md is stale:** it labels `campaign/` "stub (coming soon)" (line 31), but the campaign surface (overview/bank/schedule + 7 RPCs) is fully wired. The genuine stub is the orphaned `/party` route, which the doc doesn't mention.
- **The end-to-end pattern is consistent:** UI component → `lib/data/*` helper → Supabase RPC or table DML. Campaign, banking, scheduling, XP, promote-to-PC, spells, ammo, restock all follow it.
- **"Stored but unused" is a recurring shape:** optional-rules toggles and offline-mode toggle both persist to localStorage with no consumer. The PRD intends these to feed creation/level-up/encumbrance.
- **Auto-vs-manual asymmetry:** auto wizard complete; manual stops at step 7. Import is a complete third path the PRD treats as a peer mode.

## Open Areas

- **Whether the unbuilt items are intentionally descoped** cannot be determined from code alone — `/party` stub, manual steps 8–13, dice tab, and `packages/ui` may be deliberate cuts vs pending work. PRD §10 ("V1 Out of Scope") lists a dice-related "track day/skill reset" but NOT the quick dice roller, which §5.2 keeps in-nav — an apparent spec tension.
- **Promote-to-PC stat loss** (defaults instead of carrying retainer ac/attack/saves) reads as a gap but may be an intentional simplification; not resolvable from code.
- The `weight_coins` naming on inventory rows vs the separate coin purse suggests coin-weight was anticipated in the schema but never wired.
