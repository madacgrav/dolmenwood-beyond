---
title: "Dolmenwood Beyond Dev Log #1 — Building a Full-Stack RPG Character Manager with GitHub Copilot"
date: 2026-04-25
author: Adam Graves
status: draft
tags: [dolmenwood, rpg, nextjs, supabase, azure, github-copilot, devlog]
excerpt: >
  How I built a complete cross-platform PWA for managing Dolmenwood RPG characters — 
  full-stack with Next.js 15, Supabase, Bicep IaC, and Docker — in a single Copilot session.
---

# Dolmenwood Beyond Dev Log #1 — Building a Full-Stack RPG Character Manager with GitHub Copilot

I've been running a Dolmenwood campaign for a few months now and character management has always been the rough part. Paper sheets get lost. PDFs are clunky on phones at the table. So I decided to build something: a proper PWA that my players can install on their phones and use to manage their characters between sessions.

This is the story of how I built the entire first version in a single development session using GitHub Copilot — and what that process actually looked like.

---

## What I Built

**Dolmenwood Beyond** is a cross-platform Progressive Web App for managing characters in the [Dolmenwood](https://necroticgnome.com/products/dolmenwood-campaign-book) tabletop RPG. It's not a commercial product — it's a personal tool for my friend group. But I built it properly: full TypeScript monorepo, real auth, real database with row-level security, proper IaC for Azure deployment, and a Docker pipeline.

Here's what ships in version 1:

### Character Creation Wizard
Two modes: **Auto** (guided 13-step wizard with animated 3d6 dice rolls) and **Manual** (same steps but every field is editable from the start). The wizard covers ability scores, kindred selection, class selection, ability adjustments, traits, HP rolling, equipment, AC confirmation, speed/encumbrance, alignment, XP summary, and name/details. At the end it saves directly to Supabase and drops you into the character sheet.

The dice rolling animations were a deliberate choice — there's something satisfying about watching the numbers tumble in before they lock in. I wanted the app to feel like rolling at the table, not filling out a spreadsheet.

### Character Sheet — 5 Tabs
- **Stats**: 2×3 ability score grid with prime abilities highlighted in gold, saving throws table, attack bonus, AC, and movement speed
- **Combat**: AC breakdown, condition toggles (Poisoned, Paralysed, Unconscious), melee and ranged attack cards
- **Inventory**: Full equipment list from the database, add/delete items, total weight → encumbrance tier display, GP/SP/CP coin tracking
- **Magic**: Spell slots or glamours grid (varies by class), spell list with memorize checkboxes, graceful "no magic" message for non-casters
- **Notes**: Auto-saving textarea — writes to Supabase on blur with a 1-second debounce

HP and XP are *always* tappable — no edit mode required. Tap HP to get ±1/±5 quick-adjust chips. Tap the XP bar to add XP. An edit button unlocks full field editing.

### Level Up Flow
When your XP crosses the threshold, a pulsing gold "⬆ Level Up!" button appears on the character sheet. Tap it for a 4-step flow: XP confirmation with stats preview → animated HP roll → new class features → Supabase save with `level+1`, `hp_max+rolled`, `hp_current+rolled`.

### Rules Engine
All the game mechanics live in a separate `@dolmenwood/rules-engine` package — pure TypeScript with 57 unit tests and zero UI dependencies. I extracted the data from the Dolmenwood Player's Book PDF into JSON files that the engine reads at runtime. Every UI component imports from the rules engine rather than hardcoding values. This was intentional: if Necrotic Gnome errata a table, I fix the JSON and everything updates.

---

## The Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 15 App Router | RSC for the news feed, client components for interactive sheets |
| Database | Supabase | Auth + Postgres + Realtime + RLS in one service |
| Styling | Tailwind v4 | CSS custom properties via `@theme {}` — no config file needed |
| State | Zustand | Lightweight, no boilerplate for the wizard store |
| Monorepo | Turborepo + pnpm | Fast builds, clean package boundaries |
| Infra | Azure App Service + Bicep | OIDC auth from GitHub Actions, no stored credentials |
| Container | Docker (3-stage alpine build) | <300MB image, standalone Next.js output |

### The Tailwind v4 Decision
This was my first project using Tailwind v4 and the `@theme {}` block approach. All design tokens — colors, fonts, spacing — are CSS custom properties. Components use them as `var(--color-primary)` in inline styles. It felt cleaner than the old `tailwind.config.js` approach, especially for a design system with a specific visual identity (dark parchment, Cinzel serif font, Dolmenwood gold).

### Supabase RLS
Every table has row-level security. Players own their characters; referees can read characters belonging to their campaign members. The `handle_new_user()` trigger auto-creates an `accounts` row whenever someone signs up — including their invite code, generated by a collision-safe `generate_invite_code()` function. No manual account creation step.

---

## How I Used GitHub Copilot

The honest answer: I used Copilot as a *project manager directing a team of agents*, not as an autocomplete tool.

I wrote a detailed PRD (891 lines covering every screen, every data model, every design decision) and handed it to Copilot. From there, the workflow was:

1. Copilot analyzed the PRD and created a structured implementation plan with 22 tracked todos and dependencies
2. For each phase, Copilot launched multiple **background agents in parallel** — one per major subsystem
3. Agents ran concurrently (PDF extraction + monorepo scaffolding + Next.js setup + CI/CD setup all ran simultaneously)
4. Each agent reported back with a summary; Copilot reviewed and launched the next wave

This parallelism was the key to covering so much ground quickly. While the wizard steps 8–13 agent was building, the manual wizard agent was building. While the character sheet agent was running, I was updating todos and preparing the next phase.

### What Copilot Got Right

- **Architectural decisions held**: The `basePath` prop pattern for sharing wizard step components between auto and manual modes was clean and worked first try
- **Type safety**: `strict: true` + `noUncheckedIndexedAccess: true` throughout, all 57 tests passing, typecheck clean
- **Context retention**: Copilot remembered that Elf kindred has no `acBonus`, that Enchanter uses glamours not spell slots, and that Next.js 15 params are Promises — across the entire session

### What Required Correction

- The `output: 'standalone'` Next.js setting caused symlink permission errors on Windows. Fixed by making it conditional on a `BUILD_STANDALONE=true` env var
- `next-pwa` needed a type declaration file to stop TypeScript complaining about the import
- A few step components had hardcoded `/auto/N` navigation paths that needed the `basePath` prop retrofit for the manual wizard

---

## Infrastructure: OIDC and No Stored Credentials

One thing I'm particularly happy with: the Azure deployment uses OIDC federated identity. There are no Azure credentials stored in GitHub secrets — only three non-secret identifiers (client ID, tenant ID, subscription ID). The `az login --federated-token` step in the workflow authenticates using a short-lived token that GitHub generates for that specific workflow run.

The Bicep setup handles the circular dependency between App Service and Key Vault carefully: App Service deploys first (with placeholder KV URI), then Key Vault deploys and grants the App Service's managed identity access, then a final update wires the secrets. The App Service pulls its Docker image from ACR using managed identity — no registry credentials in config.

---

## What's Next

A few things didn't make it into v1 that I want to add:

- **Retainer sheets** — full stats for hired NPCs with morale/loyalty tracking
- **Mount management** — horses, ponies, encumbrance impact
- **Campaign/Party view** — referee screen showing all party members and their current HP
- **Portrait upload** — the field and DB column exist, the upload UI doesn't
- **Real PWA icons** — currently just an SVG placeholder; needs proper 192×512 PNGs

The WordPress news feed integration is also ready but dormant — I need to actually set up a WordPress site to connect it to.

---

## The Repo

The full source is at [github.com/madacgrav/dolmenwood-beyond](https://github.com/madacgrav/dolmenwood-beyond). Docs are in `docs/` — architecture, database schema, development guide, and deployment guide are all written.

If you're building something similar — a personal RPG tool, a hobby app with real infrastructure — the Copilot agent workflow scales surprisingly well. The trick is having a detailed spec upfront and being precise about context in agent prompts. Vague prompts produce vague code.

---

*Next session: retainer sheets, mount management, and portrait upload.*
