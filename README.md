# Dolmenwood Beyond

A cross-platform PWA for managing characters in the [Dolmenwood](https://necroticgnome.com/products/dolmenwood-campaign-book) tabletop RPG. Built for personal use by a small group of players and a referee.

## Features

- **Character creation** — guided 13-step wizard (auto with animated dice rolls, or manual entry)
- **Character sheet** — 5 tabs: Stats, Combat, Inventory, Magic and Abilities, Notes with inline HP/XP editing
- **Level-up flow** — animated HP roll, level diff preview, XP tracking, atomic Supabase RPC
- **Retainer management** — hire retainers, track stats, promote to full character
- **Mount management** — character mounts + campaign pack animals
- **Campaign/party system** — create campaign, invite code, join campaign, referee read-only view
- **Ammo tracking + battle view** — shot counter with end-of-battle recovery roll
- **Portrait upload** — Supabase Storage with per-user path RLS
- **Forgot password / password reset** — full email-based reset flow
- **Optional rules settings** — sub-par ability re-roll, HP re-roll on level-up, coin weight toggle
- **Rules engine** — all Dolmenwood mechanics (ability modifiers, AC, saves, speed, XP, spells) extracted from the Player's Book
- **News feed** — optional WordPress blog integration with ISR caching
- **PWA** — installable, offline-capable, service worker via next-pwa
- **Auth** — email/password + Google OAuth via Supabase

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), Tailwind v4, Zustand |
| Backend/DB | Supabase (PostgreSQL + Auth + Realtime) |
| Monorepo | Turborepo + pnpm workspaces |
| Infrastructure | Azure App Service, Docker, Bicep IaC |
| CI/CD | GitHub Actions with OIDC (no stored Azure credentials) |

## Quick Start

```bash
pnpm install
npx supabase start
cp apps/web/.env.local.example apps/web/.env.local
# Edit .env.local with your Supabase local keys
npx supabase db reset
pnpm dev
```

App: http://localhost:3000 · Supabase dashboard: http://localhost:54323

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/architecture.md](docs/architecture.md) | System overview, layers, auth flow, Azure infra |
| [docs/database.md](docs/database.md) | Full schema reference, RLS policies, migrations |
| [docs/development.md](docs/development.md) | Setup guide, conventions, adding features |
| [docs/deployment.md](docs/deployment.md) | Azure deployment, Docker, CI/CD, rollback |
| [.github/copilot-instructions.md](.github/copilot-instructions.md) | AI assistant context (Copilot) |
| [dolmenwood_beyond_prd.md](dolmenwood_beyond_prd.md) | Full product requirements document |

## Project Structure

```
apps/web/          Next.js 15 PWA
packages/
  rules-engine/    Dolmenwood game rules (pure TypeScript, 145 tests)
  types/           Shared TypeScript interfaces
  ui/              Shared component stubs
supabase/          Migrations + seed data
infra/azure/       Bicep IaC
extracted-data/    JSON game data (from PDF)
```

## License

Personal use only. Dolmenwood is © Necrotic Gnome. This tool is not affiliated with or endorsed by Necrotic Gnome.