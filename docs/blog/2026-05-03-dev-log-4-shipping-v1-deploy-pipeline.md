---
title: "Dev Log #4 — Shipping v1: The Deploy Pipeline, Real Bug Reports, and Two New Features"
date: 2026-05-03
author: Adam Graves
status: draft
tags: [dolmenwood, rpg, github-copilot, azure, bicep, docker, devlog, nextjs, supabase]
excerpt: >
  Version 1 of Dolmenwood Beyond is live and user testing has started. Here's everything
  it took to get there: 19 pipeline fixes, three bugs caught by real users on day one,
  and two features shipped the same afternoon.
---

Version 1 of Dolmenwood Beyond is live. Real people are using it right now to create Dolmenwood characters, and their feedback started arriving the same day it deployed. That feedback loop — the one I built the whole thing for — is finally running.

Getting to that moment took a lot of unglamorous work. This post covers the deployment pipeline battle, the bugs that surfaced in the first hours of real use, and the two features I shipped in response.

## The Deployment War

The app code was done. The CI/CD pipeline was not.

Getting from "works on my machine" to "running on Azure App Service via GitHub Actions" required 19 separate pipeline fixes across five days. The rough categories:

**GitHub Actions plumbing.** The `deploy-azure.yml` workflow called `ci.yml` as a reusable workflow, but `ci.yml` was missing the `on: workflow_call` trigger. Easy mistake, cryptic error message. Fixed. Then the job ordering was wrong: the build step tried to push an image to Azure Container Registry before the Bicep deployment that creates the ACR had even run. Restructured to `ci → deploy-infra → build-and-push → deploy-app`.

**Bicep: circular dependencies.** The Bicep template had a `keyVault` module that needed the App Service's managed identity principal ID, and an `appService` module that needed the Key Vault URI. Neither could deploy first. The fix: compute the Key Vault URI deterministically from its name using `az.environment().suffixes.keyvaultDns` — no module output needed, cycle broken.

```bicep
var keyVaultUri = 'https://${kvName}${az.environment().suffixes.keyvaultDns}/'
```

**Supabase migrations in CI.** The `supabase db push --db-url` command doesn't actually use the `SUPABASE_DB_PASSWORD` environment variable when a password is embedded in the URL string. The fix: construct the full connection URL explicitly from separate secret components. An easy assumption that cost a couple of failed runs to diagnose.

**Dockerfile: COPY with shell operators.** The Dockerfile had lines like:

```dockerfile
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules 2>/dev/null || true
```

The intent was "copy this if it exists, skip silently if not." The reality: shell operators (`2>/dev/null || true`) on a `COPY` instruction are silently ignored by BuildKit, and the build fails hard if the path doesn't exist. Replaced with `RUN --mount=type=bind,from=deps` shell loops that check before copying.

**Standalone output in a monorepo.** Next.js `output: 'standalone'` mirrors the repository directory structure inside `.next/standalone/`. In a monorepo, `server.js` lands at `apps/web/.next/standalone/apps/web/server.js` — not at the root. The Dockerfile was copying `server.js` to the wrong location and the container crashed on start with `Cannot find module '/app/server.js'`. Three characters of path change; a fun one to debug through Azure container logs.

**Managed identity for ACR pulls.** After all of that, the App Service couldn't pull its own image from Azure Container Registry. The fix was `acrUseManagedIdentityCreds: true` in the Bicep `siteConfig` — and a follow-up `az webapp update` in the pipeline because the container config step was resetting it.

The health check at the end of the pipeline needed a 5-minute retry loop because cold starts on the B1 App Service plan take longer than a single `curl` timeout.

## Bug Reports from Real Users

The app had been live for about two hours when I got the first message.

**"Typing a number in the ability score field puts in a 3."** The manual character creation wizard has inputs for each of the six ability scores (STR, INT, WIS, DEX, CON, CHA). The bug: `onChange` was calling `Math.max(3, value)` on every keystroke. Typing the digit `1` on the way to `15` immediately clamped to 3. The fix was a separate string draft state for the displayed value, with the actual clamp only applied `onBlur`.

**"The confirmation email link goes to localhost."** The `supabase.auth.signUp()` call was missing the `emailRedirectTo` option, so Supabase fell back to whatever was set in the dashboard (a localhost URL from local development). Fixed with `emailRedirectTo: \`${window.location.origin}/auth/callback\`` — uses the current host automatically so it works in both environments.

**"There's a Google sign-in button but it doesn't do anything."** The Google OAuth button was wired up but the Google OAuth provider had never been configured in Supabase. Rather than set it up for a small friend-group app, I removed the button entirely. Email and password is sufficient.

All three were in production within an hour of the reports.

## What Shipped After Launch

With the pipeline stable and the day-one bugs cleared, I shipped two features the same afternoon.

**Character Import.** The mode selection screen already had an "Import Existing" option stubbed out with "coming soon." The feature is now complete: users can upload a `.json` file or paste JSON directly. There's a sample character JSON available to download as a starting template. The page validates every field with specific error messages — correct kindred name, ability scores in the 3–18 range, required fields present — before the Import button becomes active. On success it saves directly to Supabase and drops the user on their new character sheet.

**Campaign Bank.** The DM (referee) for a Dolmenwood campaign often holds party funds between sessions — treasure that hasn't been divided yet, gold being held for a specific purpose. The bank feature formalizes that. Players can deposit GP from their character's inventory screen. The DM has a Bank tab on the Campaign page that shows every character's balance and can transfer funds back. All transactions are logged with timestamps and notes. The carried coin values (gp/sp/cp) are now persisted to the database instead of living in local state.

## What's Next

The immediate backlog includes campaign management features (the Campaign overview tab is still a stub), a level-up flow that walks through class advancement, and some quality-of-life improvements to the character sheet.

The most interesting piece coming up is probably the campaign join flow — letting players join a referee's campaign so the DM can see the whole party's character sheets in one place. That's where the bank feature will become more useful too.

---

The thing that keeps surprising me about this project is the iteration speed. Between a reported bug and a deployed fix, the window is often under an hour. Between "wouldn't it be nice if the bank tracked deposits" and "the bank tracks deposits," it's an afternoon. That speed changes how you think about what's worth building.

More soon.
