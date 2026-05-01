---
title: "Dev Log #3 — Teaching the Repo to Review Itself: AI Agents, 107 Tests, and a Blog Pipeline That Actually Works"
date: 2026-05-01
author: Adam Graves
status: draft
tags: [dolmenwood, rpg, github-copilot, vitest, github-actions, testing, react-testing-library, devlog]
excerpt: >
  Solo projects skip quality gates — until the cost of skipping them becomes obvious. This week I
  added five AI-powered PR review agents, went from zero to 107 tests, wired up pre-commit hooks,
  and fixed a silent bug that had been dropping every image from published blog posts.
---

![Developer reviewing code at desk](./images/2026-05-01-dev-log-3/hero.jpg)

There's a specific kind of technical debt that solo projects accumulate quietly: the stuff you know you
*should* have but keep deferring because there's no one asking for it. Tests. Code review. Linting on
commit. This week Dolmenwood Beyond got all of it — and the tooling that enforces it.

## Five AI Review Agents on Every Pull Request

The biggest addition this week was a GitHub Copilot agent workflow that runs five parallel code reviews
on every PR. Not summaries — actual opinionated reviews, each with a specific mandate.

**Developer Architect** checks that the code follows the project's conventions: no game logic leaking
into UI components, correct Supabase client usage (browser vs. server), async params handled properly
in Next.js 15, Tailwind tokens used via CSS variables instead of hardcoded hex values.

**DevOps** reviews the deployment pipeline and infrastructure-as-code. It knows the Azure Bicep modules,
checks for missing OIDC permissions, validates that Docker builds will actually succeed, and flags
drift between local dev and the containerised environment.

**Security** scans for vulnerabilities in both the app and the infrastructure: leaked secrets,
RLS policies that could expose data, missing Content Security Policy headers, OIDC scope creep.

**QA** checks that test coverage exists for new code, that UI components have `data-testid` attributes
for testability, and that new game rules have corresponding tests in `packages/rules-engine`.

**Blogger** is the newest addition — it reviews any blog posts in the PR for LinkedIn readiness.
It checks the hook (first three lines), flags corporate filler words like "leverage" and "seamless",
and gives the post a readiness score out of 10.

The setup is a single `.github/workflows/pr-review.yml` that fans out into five parallel jobs.
Each agent gets its persona from a markdown file in `.github/agents/`:

```yaml
- uses: github/copilot-for-prs@v1
  with:
    agent-path: .github/agents/developer-review.agent.md
```

Every PR now gets five structured reviews before anything merges. For a solo project that previously
merged to main with a "looks good to me" from the same person who wrote the code, this is a step change.

## From Zero to 107 Tests

The rules engine (`packages/rules-engine`) already had 78 tests across 8 files — ability modifiers,
AC calculations, advancement tables, spell slots. Two modules were untested: `calculateSpeed` and
`getXPModifier`. Both are now covered.

The web app (`apps/web`) had zero tests. Not even a test directory.

Setting up [Vitest](https://vitest.dev/) with React Testing Library in a Next.js 15 App Router project
has a few non-obvious requirements. The main one: `@vitejs/plugin-react` v6 requires Vite 8, but Vitest
ships with Vite 7. You need `@vitejs/plugin-react@4` to avoid a version conflict.

```typescript
// apps/web/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

The setup file mocks `next/navigation` (useRouter, usePathname, useSearchParams) and `next/link`.
Without those mocks, every component that uses them throws in the test environment.

Three new test files cover the components most likely to break silently:

- **`HPBar.test.tsx`** — 9 tests for the health bar component. Hit an interesting issue: `toHaveStyle`
  in jsdom doesn't resolve CSS custom properties. `toHaveStyle({ backgroundColor: 'var(--color-danger)' })`
  always fails. Fix: add `data-testid="hp-bar-fill"` to the fill div and check `getAttribute('style')`
  instead.

- **`WizardProgress.test.tsx`** — 7 tests for the 13-step creation wizard progress bar. Verifies
  step labels appear, completed steps get the right visual treatment, and the active step is marked.

- **`wizard-store.test.ts`** — 13 tests for the Zustand store that holds all character creation state
  across the wizard's 13 steps. Each action is tested in isolation.

Total: **107 tests, 0 failing**.

![Characters page showing the app in action](./screenshots/03-characters-empty.png)

## Pre-Commit Hooks

Every code change now runs through lint-staged before it's committed. TypeScript files go through
ESLint, YAML files through `yamllint`.

```json
// package.json (root)
"lint-staged": {
  "*.{ts,tsx,js,jsx,mjs}": ["eslint --fix --max-warnings=0"],
  "*.{yml,yaml}": ["yamllint"]
}
```

The pre-commit hook is managed by Husky. One Windows-specific gotcha: lint-staged's default behaviour
is to stash uncommitted changes before linting — but the Windows implementation of git stash in this
context can leave the working tree dirty. Fix is `--no-stash`:

```json
"lint-staged": {
  "*.{ts,tsx}": "eslint --fix --max-warnings=0 --no-stash"
}
```

## Fixing a Silent Image Bug

Every blog post published to WordPress was missing its images. Not an error — just silent disappearance.
The Node.js script that converts Markdown to HTML had no image handling at all.

The link regex `\[text\](url)` → `<a href>` would *almost* match images — `![alt](path)` — but the `!`
prefix caused it to produce malformed HTML or just get eaten by the paragraph wrapper. Either way,
the images never made it to WordPress.

The fix happens in two stages in `blog-session.yml`:

**Stage 1 — Parse**: extract all local image refs *before* the link regex runs, convert them to
`<img>` tags, and pass a JSON array of `{ alt, path }` objects to the next step.

```javascript
// Before the markdown → HTML pipeline
const imageRefs = [];
const imgRefPattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
let imgRefMatch;
while ((imgRefMatch = imgRefPattern.exec(body)) !== null) {
  const imgPath = imgRefMatch[2];
  if (!imgPath.startsWith('http')) {
    imageRefs.push({ alt: imgRefMatch[1], path: imgPath });
  }
}
```

**Stage 2 — Upload**: a new workflow step uploads each image file to the WordPress media endpoint
using Node 22's native `fetch`, captures the `source_url` from the response, and substitutes it
back into the HTML before the post is published.

```javascript
const response = await fetch(`${base}/media`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Type': mimeType,
  },
  body: fs.readFileSync(localPath),
});
const { source_url } = await response.json();
html = html.split(`src="${imgRef.path}"`).join(`src="${source_url}"`);
```

The step is conditional (`if: steps.post.outputs.has_images == 'true'`) so posts without images
skip it entirely. The publish step falls back to the raw parse output when no upload happened.

This fix retroactively unblocks Dev Log #2, which had 8 screenshots that were never appearing on
the WordPress side.

## What's Next

The character creation wizard is the core feature and it's working well across both auto and manual
modes. Next up: the character sheet — the view you live in once a character exists. HP tracking,
spell slot management, inventory, combat stats. That's where Dolmenwood Beyond goes from "creation
tool" to "session companion."

The `campaign/` route is still a stub. That's intentional — single-player utility first, then the
multiplayer table features that make this something more than a fancy character sheet.

---

*Dolmenwood Beyond is a personal project for managing characters in the [Dolmenwood](https://necroticgnome.com/products/dolmenwood-campaign-book) tabletop RPG.
Source: [github.com/madacgrav/dolmenwood-beyond](https://github.com/madacgrav/dolmenwood-beyond)*
