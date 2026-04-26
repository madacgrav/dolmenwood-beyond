# Architecture — Dolmenwood Beyond

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        User (Browser / PWA)                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────┐
│              Azure App Service (Linux Container)             │
│                                                              │
│   ┌──────────────────────────────────────────────────────┐  │
│   │              Next.js 15 (App Router)                 │  │
│   │                                                      │  │
│   │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │  │
│   │  │ Server RSC  │  │ Client Pages │  │  API Routes│  │  │
│   │  │ (news feed) │  │ (char sheet) │  │  /health   │  │  │
│   │  └─────────────┘  └──────────────┘  └────────────┘  │  │
│   │                                                      │  │
│   │  ┌─────────────────────────────────────────────────┐ │  │
│   │  │            @dolmenwood/rules-engine              │ │  │
│   │  │   (pure TypeScript — no runtime dependencies)   │ │  │
│   │  └─────────────────────────────────────────────────┘ │  │
│   └──────────────────────────────────────────────────────┘  │
└───────────┬──────────────────────────┬──────────────────────┘
            │ Supabase JS SDK           │ fetch (ISR)
┌───────────▼──────────────┐  ┌────────▼─────────────────────┐
│   Supabase (hosted)      │  │   WordPress REST API          │
│                          │  │   (optional, user-configured) │
│  ┌────────────────────┐  │  └──────────────────────────────┘
│  │  PostgreSQL + RLS  │  │
│  ├────────────────────┤  │
│  │  Auth (GoTrue)     │  │
│  ├────────────────────┤  │
│  │  Realtime          │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

---

## Monorepo Structure

The repository uses **Turborepo** with **pnpm workspaces**.

```
dolmenwood-beyond/
├── apps/
│   └── web/                   @dolmenwood/web
│       Next.js 15 PWA — the user-facing application
│
├── packages/
│   ├── rules-engine/          @dolmenwood/rules-engine
│   │   Pure TypeScript implementation of all Dolmenwood RPG rules.
│   │   No React, no Supabase — pure functions only.
│   │   57 unit tests.
│   │
│   ├── types/                 @dolmenwood/types
│   │   Shared TypeScript interfaces used by both web and rules-engine.
│   │   Single source of truth for all entity shapes.
│   │
│   └── ui/                    @dolmenwood/ui
│       Shared component stubs. Peer deps declared; intentionally minimal.
│
├── supabase/
│   Database migrations, seed data, and local dev config.
│
├── infra/azure/
│   Bicep infrastructure-as-code for Azure deployment.
│
└── extracted-data/
    JSON files extracted from the Dolmenwood Player's Book PDF.
    Source of truth for all static game data.
```

### Turborepo Task Pipeline

```
build      → depends on ^build (packages first, then apps)
typecheck  → depends on ^build
test       → no dependencies (run independently)
dev        → persistent, no cache
lint       → no dependencies
```

---

## Application Layers

### 1. Presentation Layer (`apps/web/src/`)

**Routing** — Next.js 15 App Router with route groups:

| Route Group | Description |
|-------------|-------------|
| `(auth)/` | Unauthenticated pages: sign-in, sign-up |
| `(app)/` | Authenticated shell with bottom navigation |
| `api/` | API routes: `/api/health` |
| `auth/callback/` | OAuth redirect handler |

**State Management**

| Store | Purpose | Scope |
|-------|---------|-------|
| `auth-store` (Zustand) | Current user session | App-wide |
| `wizard-store` (Zustand) | 13-step character creation state | Wizard session |
| Supabase client | Server state (characters, inventory, spells) | Per-component |

**Rendering Strategy**

| Page | Strategy | Reason |
|------|----------|--------|
| News feed | RSC + ISR (1hr revalidate) | SEO + caching |
| Character sheet | Client Component | Real-time HP/XP editing |
| Character roster | Client Component | Real-time Supabase subscription |
| Settings | Client Component | localStorage interactions |
| Sign-in / Sign-up | Client Component | Form interactions |

### 2. Rules Engine (`packages/rules-engine/`)

Stateless pure functions. All game mechanics are implemented here and imported into the web app. UI components **never** contain game logic inline.

```
ability-modifiers.ts    getAbilityModifier(score) → modifier
ac.ts                   calculateAC(params) → total AC
advancement.ts          getAttackBonus, getSaveTargets, getXPThresholdForNextLevel
dice.ts                 rollDie(sides), rollFromNotation('3d6')
kindreds.ts             getKindredData, getKindredACBonus, getSuggestedClasses
retainers.ts            Retainer morale/loyalty calculations
skills.ts               getSkillTargets(className)
speed.ts                calculateSpeed(encumbranceCoins)
spells.ts               getSpellSlots(className, level)
xp.ts                   getXPModifier(primeScores)
```

Data files (`src/data/*.json`) are extracted from the Dolmenwood Player's Book PDF and committed to source control. They are the authoritative source for all static game data.

### 3. Database Layer (`supabase/`)

PostgreSQL hosted by Supabase with Row Level Security on all tables.

See [database.md](./database.md) for full schema documentation.

---

## Authentication Flow

```
User visits /characters
       │
       ▼
middleware.ts checks supabase.auth.getUser()
       │
  No session?──────────────────────────────────► redirect /sign-in
       │                                              │
  Session OK                              Email/password or Google OAuth
       │                                              │
       ▼                                    Supabase Auth (GoTrue)
  render page                                         │
                                           Google: /auth/callback route
                                                      │
                                           handle_new_user() DB trigger
                                           creates accounts row
                                                      │
                                                redirect /characters
```

**Public routes** (bypass auth middleware):
- `/sign-in`, `/sign-up`, `/auth/callback`
- `/_next/static/**`, `/_next/image/**`, `/favicon.ico`, `/icons/**`, `/manifest.json`

---

## Character Creation Flow

```
/characters/new
      │
      ├── Auto (3d6 guided)
      │     └── /characters/new/auto/[1..13]
      │               │
      │         WizardProgress component tracks steps
      │         Zustand wizard-store holds all state
      │               │
      │         /characters/new/auto/complete
      │               └── INSERT into characters table
      │                          │
      │                   /characters/[id]
      │
      └── Manual (editable inputs)
            └── /characters/new/manual/[1..13]
                      │
                  Same Zustand store, same step components
                  Step components accept basePath prop
                      │
                  /characters/new/manual/complete
                      └── INSERT into characters table
```

**Shared step components** (`components/wizard/steps/Step*.tsx`) accept:
```typescript
interface StepProps {
  basePath?: string; // default: '/characters/new/auto'
}
```
This allows both wizard paths to reuse the same components.

---

## Azure Infrastructure

```
Azure Resource Group: dolmenwood-beyond-rg
│
├── Azure Container Registry (dolmenwooodprodacr)
│   └── Docker image: dolmenwood/web:{tag}
│
├── App Service Plan (dolmenwood-prod-plan) — Linux B1
│   └── App Service (dolmenwood-prod-web)
│       ├── System-assigned managed identity
│       │   └── AcrPull role on ACR (no credentials stored)
│       └── App Settings (secrets via Key Vault references)
│           ├── NEXT_PUBLIC_SUPABASE_URL
│           ├── SUPABASE_SERVICE_ROLE_KEY → @Microsoft.KeyVault(SecretUri=...)
│           └── NEXT_PUBLIC_SUPABASE_ANON_KEY → @Microsoft.KeyVault(...)
│
├── Key Vault (dolmenwood-prod-kv)
│   └── Secrets: supabase-service-role-key, supabase-anon-key
│
└── Log Analytics Workspace + Application Insights
    └── Linked to App Service for monitoring
```

**Deployment Pipeline** (`.github/workflows/deploy-azure.yml`):

```
PR opened/updated:
  └── bicep what-if (preview changes, no deployment)

Push to main:
  1. OIDC login to Azure (no stored credentials)
  2. Build Docker image with BUILD_STANDALONE=true
  3. Push to ACR
  4. Deploy Bicep (idempotent)
  5. Update App Service to use new image tag
  6. Health check: GET /api/health
```

---

## PWA Configuration

Service worker generated by `next-pwa` (disabled in development):
- **Strategy**: NetworkFirst with 24hr cache
- **Offline fallback**: `/public/offline.html`
- **Install shortcut**: "New Character" → `/characters/new`
- **Icons**: `/public/icons/icon.svg` (replace with PNGs before production)

The app registers as a PWA on mobile with:
- `display: standalone` — full-screen on install
- `orientation: portrait-primary`
- `theme_color: #8b6914` (Dolmenwood gold)
- `background_color: #1a1510` (dark parchment)

---

## WordPress Integration

Optional news/blog feed powered by the WordPress REST API:

```
NEXT_PUBLIC_WORDPRESS_URL not set → /news shows "Coming Soon"
NEXT_PUBLIC_WORDPRESS_URL set     → fetches /wp-json/wp/v2/posts?_embed
                                    Cached with ISR (1hr revalidate)
```

Posts render with the `.wp-content` CSS class for styled HTML output.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Used in API routes requiring elevated access |
| `NEXT_PUBLIC_WORDPRESS_URL` | Optional | WordPress site URL for news feed |
| `BUILD_STANDALONE` | Build only | Set to `true` in Docker builds for `output: standalone` |
