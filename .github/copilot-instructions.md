# GitHub Copilot Instructions — Dolmenwood Beyond

This file provides context for AI-assisted development on the Dolmenwood Beyond project.
Read this before making any changes.

---

## Project Overview

**Dolmenwood Beyond** is a cross-platform PWA for managing characters in the [Dolmenwood](https://necroticgnome.com/products/dolmenwood-campaign-book) tabletop RPG. It is a personal-use tool for a small friend group — not a commercial product.

- **Stack**: Next.js 15 (App Router) · Supabase · Tailwind v4 · Turborepo · TypeScript
- **Deployment**: Azure App Service via Docker + Bicep IaC
- **Auth**: Supabase Auth (email/password + Google OAuth)
- **Monorepo**: `apps/web`, `packages/rules-engine`, `packages/types`, `packages/ui`

---

## Repository Structure

```
dolmenwood-beyond/
├── apps/web/                  # Next.js 15 PWA
│   ├── src/
│   │   ├── app/               # App Router pages
│   │   │   ├── (auth)/        # sign-in, sign-up (no layout chrome)
│   │   │   ├── (app)/         # authenticated app shell
│   │   │   │   ├── characters/    # roster + [id] sheet + [id]/level-up
│   │   │   │   ├── characters/new/    # mode-select, auto/[step], manual/[step]
│   │   │   │   ├── news/          # WordPress blog feed + [slug]
│   │   │   │   ├── campaign/      # stub (coming soon)
│   │   │   │   └── settings/
│   │   │   └── api/health/    # health check endpoint
│   │   ├── components/
│   │   │   ├── character-sheet/  # Header, StatsTab, CombatTab, InventoryTab, MagicTab, NotesTab
│   │   │   ├── characters/       # CharacterCard, HPBar
│   │   │   ├── layout/           # BottomNav
│   │   │   ├── ui/               # shared primitives
│   │   │   └── wizard/           # WizardProgress, AnimatedDie, steps/Step*.tsx
│   │   ├── hooks/             # custom React hooks
│   │   ├── lib/
│   │   │   ├── supabase/      # client.ts (browser), server.ts (SSR)
│   │   │   └── wordpress.ts   # WP REST API client
│   │   ├── middleware.ts       # auth guard
│   │   └── stores/
│   │       ├── auth-store.ts  # Zustand auth state
│   │       └── wizard-store.ts # Zustand 13-step wizard state
├── packages/
│   ├── rules-engine/          # Pure TS — all Dolmenwood game rules
│   │   └── src/
│   │       ├── data/          # JSON data files extracted from PDF
│   │       ├── ability-modifiers.ts
│   │       ├── ac.ts
│   │       ├── advancement.ts
│   │       ├── dice.ts
│   │       ├── kindreds.ts
│   │       ├── retainers.ts
│   │       ├── skills.ts
│   │       ├── speed.ts
│   │       ├── spells.ts
│   │       └── xp.ts
│   ├── types/src/index.ts     # All shared TypeScript interfaces
│   └── ui/                    # Shared component stubs (peer deps only)
├── supabase/
│   ├── migrations/            # 3 migration files (schema, equipment, invite codes)
│   └── seed.sql
├── infra/azure/               # Bicep IaC (main.bicep + 4 modules)
├── extracted-data/            # JSON files extracted from Dolmenwood Player's Book PDF
└── .github/workflows/         # ci.yml, deploy-azure.yml, deploy-prod.yml
```

---

## Critical Conventions

### Styling — Tailwind v4

**Do NOT use `tailwind.config.js` or `@apply` with arbitrary values.**

All design tokens are defined as CSS custom properties in `apps/web/src/app/globals.css` inside `@theme {}`:

```css
--color-bg: #1a1510;
--color-surface: #2a2118;
--color-primary: #8b6914;      /* Dolmenwood gold */
--color-text: #d4c5a9;
--color-text-muted: #9e9689;
--color-gold: #d4a017;
--color-danger: #c0392b;
--color-border: #3d3020;
```

Use them in inline styles or Tailwind utilities via CSS vars:
```tsx
style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)' }}
```

**Dark mode**: toggled via `data-theme="dark"` on `<html>`. The CSS already has `[data-theme="dark"]` overrides.

**Display font**: `var(--font-display)` (Cinzel). Use for headings and UI headers.
```tsx
style={{ fontFamily: 'var(--font-display), Georgia, serif' }}
```

### Supabase

Always use the correct client for the context:
- **Browser / Client Components**: `import { createClient } from '@/lib/supabase/client'`
- **Server Components / API routes / middleware**: `import { createClient } from '@/lib/supabase/server'`

The schema uses **snake_case** in the DB but **camelCase** in TypeScript types. Cast Supabase rows:
```typescript
const scores = row.ability_scores as AbilityScores;
```

RLS is enabled on all tables. Every query is scoped to `auth.uid()` automatically.

### Next.js 15 — Async Params

Route params are **Promises** in Next.js 15:
```typescript
// ✅ Correct
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
// ❌ Wrong — will cause a runtime error
export default async function Page({ params }: { params: { id: string } }) {
  const id = params.id;
}
```

### Docker / Standalone Output

`output: 'standalone'` in `next.config.ts` is **conditional** — it only activates when `BUILD_STANDALONE=true`:
```typescript
...(process.env.BUILD_STANDALONE === 'true' ? { output: 'standalone' } : {})
```
This avoids Windows symlink permission errors in local dev. The Docker build sets `BUILD_STANDALONE=true`.

### Rules Engine

All game logic lives in `packages/rules-engine`. **Never inline game rules in UI components** — always import from `@dolmenwood/rules-engine`.

Key exports:
```typescript
import {
  getAbilityModifier,      // (score: number) => number
  calculateAC,             // (params) => number
  calculateSpeed,          // (encumbranceCoins: number) => 10|20|30|40
  getXPModifier,           // (primeScores: number[]) => number (percentage)
  getPrimeAbilities,       // (className: string) => string[]
  getAttackBonus,          // (className: string, level: number) => number
  getSaveTargets,          // (className: string, level: number) => SaveTargets
  getXPThresholdForNextLevel, // (className: string, level: number) => number
  getSpellSlots,           // (className: string, level: number) => object
  rollDie,                 // (sides: DieType) => number
  rollFromNotation,        // ('3d6') => number
} from '@dolmenwood/rules-engine';
```

`DieType` is a union: `4 | 6 | 8 | 10 | 12 | 20 | 100` — cast `n as DieType` if needed.

### State Management

- **Auth state**: `useAuthStore()` from `@/stores/auth-store`
- **Wizard state**: `useWizardStore()` from `@/stores/wizard-store` — holds all 13-step creation data
- **Server state**: Supabase realtime subscriptions or standard `useEffect` fetches. `@tanstack/react-query` is installed and available but not yet widely used — prefer the Supabase pattern for consistency unless you have a good reason to use TanStack Query.

### Minimum Touch Target

All interactive elements must have `minHeight: '44px'` and `minWidth: '44px'` for mobile accessibility.

---

## Game Data

| Entity | Values |
|--------|--------|
| **Kindreds** | Human, Breggle, Elf, Grimalkin, Mossling, Woodgrue |
| **Classes** | Bard, Cleric, Enchanter, Fighter, Friar, Hunter, Knight, Magician, Thief |
| **Alignments** | lawful, neutral, chaotic |
| **Alignments restricted** | Cleric + Friar cannot be chaotic |
| **Spellcasting classes** | Magician, Enchanter, Cleric, Friar, Bard |
| **Enchanter magic** | glamours (not spell slots) — `getSpellSlots('Enchanter', n)` returns `{ glamours: n }` |

Speed encumbrance thresholds (in coins weight):
- ≤ 400 → 40 ft/round
- ≤ 600 → 30 ft/round
- ≤ 800 → 20 ft/round
- \> 800 → 10 ft/round

Saving throw categories: `doom`, `ray`, `hold`, `blast`, `spell`

XP modifier (based on lowest prime ability):
- ≤ 5 → −20% · 6–8 → −10% · 9–12 → 0% · 13–15 → +5% · 16–18 → +10%

---

## Character Creation Wizard

Two modes share the same 13-step Zustand store (`wizard-store.ts`):

| Step | Screen |
|------|--------|
| 1 | Ability scores (auto: animated 3d6 roll / manual: number inputs) |
| 2 | Kindred selection |
| 3 | Class selection (filtered by kindred) |
| 4 | Ability score adjustment (2-for-1 trade) |
| 5 | Modifier summary |
| 6 | Kindred traits + combat stats |
| 7 | HP roll (auto: animated / manual: editable input) |
| 8 | Equipment (roll or buy) |
| 9 | AC breakdown |
| 10 | Speed/encumbrance |
| 11 | Alignment (with class restrictions) |
| 12 | Level & XP confirmation |
| 13 | Name & details |
| complete | Celebration → save to Supabase → character sheet |

**Auto path**: `/characters/new/auto/[step]`
**Manual path**: `/characters/new/manual/[step]`

Shared step components (`Step2Kindred` through `Step13Details`) accept a `basePath?: string` prop (default: `'/characters/new/auto'`) so they work in both modes.

---

## Auth Flow

1. User hits any protected route → middleware checks `supabase.auth.getUser()`
2. No session → redirect `/sign-in`
3. Authenticated on `/sign-in` or `/sign-up` → redirect `/characters`
4. Sign-up: 2-step form → role selection (player/referee) → Supabase signup → `handle_new_user()` DB trigger creates `accounts` row
5. Google OAuth: `/sign-in` → Supabase OAuth → `/auth/callback` route handler → `/characters`

Public routes (no auth required): `/sign-in`, `/sign-up`, `/auth/callback`, static assets

---

## Azure Infrastructure

All IaC is in `infra/azure/` using Bicep:

| Resource | Purpose |
|----------|---------|
| Azure Container Registry | Stores Docker images |
| App Service Plan (B1) | Hosts the web app |
| App Service (Linux) | Runs the Docker container |
| Key Vault | Stores secrets (Supabase keys) |
| Log Analytics + App Insights | Monitoring |

Deployment is via OIDC (no stored Azure credentials). Required GitHub secrets:
- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`

One-time OIDC setup: `bash infra/azure/scripts/setup-oidc.sh`

---

## Commands

```bash
# Dev
pnpm dev                                              # start Next.js + watch packages
pnpm lint                                             # lint all packages
pnpm typecheck                                        # type-check all packages
pnpm format                                           # prettier format

# Per-package (avoid rebuilding the whole monorepo)
pnpm --filter @dolmenwood/web typecheck
pnpm --filter @dolmenwood/rules-engine typecheck
pnpm --filter @dolmenwood/web build

# Tests
pnpm test                                             # run all tests (rules-engine + web)
pnpm --filter @dolmenwood/rules-engine test           # run rules-engine tests once
pnpm --filter @dolmenwood/web test                    # run web component tests once
pnpm --filter @dolmenwood/rules-engine test:watch     # watch mode

# Run a single test file
pnpm --filter @dolmenwood/rules-engine test -- src/__tests__/ability-modifiers.test.ts

# Supabase
npx supabase start                                    # start local stack (requires Docker)
npx supabase db reset                                 # re-apply all migrations from scratch
npx supabase gen types typescript --local > packages/types/src/supabase.ts  # regenerate DB types
```

## Blog Posts

Blog posts are Markdown files in `docs/blog/YYYY-MM-DD-slug.md`. They are published to
WordPress via the `blog-session.yml` workflow and appear in the in-app News tab.
The intended audience is LinkedIn — developer/builder readers.

### Writing a new blog post

**Always base the content on real work done since the last post — not invented topics.**

**Step 1 — Find work done since the last post:**
```powershell
# Find the most recent blog file and its date
Get-ChildItem docs\blog\*.md | Where-Object { $_.Name -ne 'README.md' } | Sort-Object Name | Select-Object -Last 1

# Review commits since that date (replace YYYY-MM-DD with the date from frontmatter):
git log --since="YYYY-MM-DD" --oneline

# Also check merged PRs:
gh pr list --state merged --base main --search "merged:>YYYY-MM-DD"
```

**Step 2 — Structure the post:**
- Opening hook: 2-3 sentences, no warm-up phrases ("In this post I will...")
- 3-5 `##` sections, each with a specific name (not "Part 1")
- Code blocks with language hints for any code snippets
- Screenshots or images where relevant
- Closing takeaway or "what's next"

**Step 3 — Add images** (see Image Conventions below)

**Step 4 — Save as** `docs/blog/YYYY-MM-DD-short-slug.md` with `status: draft`

### Required frontmatter

All six fields are required. Always start with `status: draft`:

```yaml
---
title: "Specific title that promises something (not 'Dev Log #N')"
date: YYYY-MM-DD
author: Adam Graves
status: draft
tags: [nextjs, supabase, devlog]
excerpt: >
  One or two compelling sentences. What did you learn? What is the hook?
  This text appears in the in-app news feed and as the LinkedIn intro.
---
```

### Image Conventions

The `blog-session.yml` workflow **automatically uploads all local images to WordPress**
and substitutes the real URLs. Just use relative paths in Markdown — no manual upload needed.

**App screenshots** — save to `docs/blog/screenshots/` as `NN-description.png`:
```markdown
![Sign-in page](./screenshots/01-sign-in.png)
```

**Post-specific images** (diagrams, downloaded stock photos) — save to
`docs/blog/images/YYYY-MM-DD-slug/` and reference as:
```markdown
![Architecture diagram](./images/2026-05-01-my-post/architecture.png)
```

**Free stock photos from Pexels** (royalty-free, no attribution required for editorial use):
```powershell
# Browse https://www.pexels.com, find an image, copy its direct image URL, then:
Invoke-WebRequest `
  -Uri "https://images.pexels.com/photos/ID/pexels-photo-ID.jpeg?auto=compress&cs=tinysrgb&w=1200" `
  -OutFile "docs\blog\images\YYYY-MM-DD-slug\hero.jpg"
```

Supported image formats: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`

### Blog Log — Required Update

**`docs/blog/BLOG_LOG.md` must be updated every time a blog post is created or modified.**

After saving or editing a post, update the log row for that file:

1. Get the current HEAD SHA: `git rev-parse --short HEAD`
2. Update (or add) the row in `BLOG_LOG.md` with the new SHA, timestamp, status, and a one-sentence summary
3. Commit `BLOG_LOG.md` together with the post file in the same commit

The log columns are: `# | File | Last Updated | Last Commit SHA | Status | Summary`

If creating a new post, append a new row. If updating an existing post, replace only that row.

### Publishing

Merge the PR to `main` — `blog-session.yml` triggers automatically.
To publish manually: Actions → "Publish Blog Post" → select the file → Run workflow.

---

## Running Locally
cp apps/web/.env.local.example apps/web/.env.local
# Edit .env.local with keys from `supabase start` output
npx supabase db reset
pnpm dev
```

App: `http://localhost:3000` · Supabase dashboard: `http://localhost:54323`

Environment variables needed in `apps/web/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key from supabase start>
NEXT_PUBLIC_WORDPRESS_URL=   # optional, for news feed
```

### File Naming

- Pages: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` (Next.js conventions)
- Components: PascalCase (`CharacterCard.tsx`)
- Hooks: kebab-case with `use` prefix (`use-characters.ts`)
- Utilities: camelCase (`wordpress.ts`)

### TypeScript Strictness

`strict: true` + `noUncheckedIndexedAccess: true` in tsconfig. Array and object index access returns `T | undefined` — use nullish coalescing or bounds checks. No `any` — use proper types or `unknown`.

---

## Common Gotchas

1. **JSON data imports**: Import JSON from `@dolmenwood/rules-engine/src/data/` using the package path, not relative paths from `apps/web`.

2. **Elf kindred**: Has no `acBonus` — the `KindredData.acBonus` field is optional.

3. **`next-pwa` in dev**: The service worker is disabled in development (`disable: process.env.NODE_ENV === 'development'`). Don't try to debug SW behaviour in dev mode.

4. **Supabase `ability_scores`**: Stored as JSONB `{"str":N,"int":N,...}` — always cast with `as AbilityScores`.

5. **`noUncheckedIndexedAccess`**: Enabled in tsconfig. Array/object index access returns `T | undefined`. Use nullish coalescing or bounds checks.

6. **Bottom nav**: 4 tabs — Characters (`/characters`), News (`/news`), Campaign (`/campaign`), Settings (`/settings`).

7. **`force-dynamic`** on app layout: `export const dynamic = 'force-dynamic'` prevents Supabase SSR client errors during static prerender.
