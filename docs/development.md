# Development Guide — Dolmenwood Beyond

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 22.x | Use `.nvmrc` or `nvm use 22` |
| pnpm | 10.x | `npm install -g pnpm@10` |
| Docker Desktop | Latest | Required for local Supabase + Docker builds |
| Supabase CLI | Latest | `npm install -g supabase` |
| Azure CLI | Latest | Only needed for Azure deployments |

---

## First-Time Setup

```bash
# 1. Clone the repo
git clone https://github.com/madacgrav/dolmenwood-beyond.git
cd dolmenwood-beyond

# 2. Install dependencies
pnpm install

# 3. Start local Supabase (requires Docker)
npx supabase start
# Note the local API URL and anon key printed to stdout

# 4. Create local env file
cp apps/web/.env.local.example apps/web/.env.local
# Edit .env.local with the values from `supabase start` output

# 5. Apply database migrations
npx supabase db reset

# 6. Start the dev server
pnpm dev
```

The app will be available at `http://localhost:3000`.
The local Supabase dashboard is at `http://localhost:54323`.

---

## Environment Variables

Create `apps/web/.env.local` with:

```env
# Required — from `npx supabase start` output
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>

# Optional — for news/blog feed
NEXT_PUBLIC_WORDPRESS_URL=https://your-wordpress-site.com
```

> **Note**: `NEXT_PUBLIC_*` variables are baked into the browser bundle at build time. In Docker/CI, pass them as `--build-arg` to `docker build`.

---

## Daily Development Workflow

```bash
# Start everything
pnpm dev                              # starts Next.js dev server + watches packages

# In a separate terminal, if you need Supabase
npx supabase start                    # start local DB (if not already running)
npx supabase db reset                 # re-apply all migrations from scratch

# Type checking
pnpm typecheck                        # check all packages
pnpm --filter @dolmenwood/web typecheck      # check web only
pnpm --filter @dolmenwood/rules-engine typecheck  # check rules-engine only

# Testing
pnpm test                             # run all tests
pnpm --filter @dolmenwood/rules-engine test   # rules-engine unit tests only

# Linting
pnpm lint

# Build (local — skips standalone output)
pnpm --filter @dolmenwood/web build

# Build with standalone output (Docker-compatible, requires elevated permissions on Windows)
BUILD_STANDALONE=true pnpm --filter @dolmenwood/web build
```

---

## Adding a New Screen

1. **Create the page** in `apps/web/src/app/(app)/your-screen/page.tsx`
2. **Add to bottom nav** if it's a top-level destination — edit `apps/web/src/components/layout/BottomNav.tsx`
3. **Add Supabase queries** using `createClient()` from `@/lib/supabase/client`
4. **Use rules engine** for any game logic — import from `@dolmenwood/rules-engine`
5. **Use design tokens** — `var(--color-*)` CSS variables, `var(--font-display)` for headings

### Page template (client component)

```tsx
'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function YourPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('your_table').select('*');
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingSkeleton />;

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100dvh', paddingBottom: '5rem' }}>
      <h1 style={{ fontFamily: 'var(--font-display), Georgia, serif', color: 'var(--color-primary)' }}>
        Your Page
      </h1>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} style={{ height: '80px', borderRadius: '10px', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ))}
    </div>
  );
}
```

---

## Adding a Database Migration

```bash
# Create a new migration file
npx supabase migration new your_migration_name

# This creates: supabase/migrations/<timestamp>_your_migration_name.sql
# Edit the SQL file, then apply:
npx supabase db reset    # resets local DB and applies all migrations
```

Always test locally before committing. Never edit existing migration files — add a new one.

---

## Adding Rules Engine Logic

All game mechanics go in `packages/rules-engine/src/`.

1. Create or edit the relevant file (e.g. `combat.ts`)
2. Export the function
3. Add it to `packages/rules-engine/src/index.ts`
4. Write a test in `packages/rules-engine/src/__tests__/`
5. Run `pnpm --filter @dolmenwood/rules-engine test`

```typescript
// packages/rules-engine/src/your-module.ts
export function yourFunction(input: number): number {
  return input * 2;
}

// packages/rules-engine/src/index.ts
export * from './your-module';

// packages/rules-engine/src/__tests__/your-module.test.ts
import { yourFunction } from '../your-module';
test('doubles the input', () => {
  expect(yourFunction(5)).toBe(10);
});
```

---

## Docker

### Local Docker build

```bash
# Build the image (from repo root)
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  -t dolmenwood-web:local \
  -f apps/web/Dockerfile \
  .

# Run the container
docker run -p 3000:3000 dolmenwood-web:local

# Or use docker-compose for local dev with Postgres
docker compose up
```

### Docker Compose (local dev)

`docker-compose.yml` at the repo root starts:
- The Next.js app on port 3000
- A local PostgreSQL instance on port 5432

> **Note**: The docker-compose setup uses a local Postgres container, not Supabase. For full Supabase features (auth, RLS, realtime), use `npx supabase start` instead.

---

## Deployment

See [deployment.md](./deployment.md) for Azure deployment instructions.

For quick deployments, push to `main` — the `deploy-azure.yml` workflow handles everything automatically via GitHub Actions.

---

## Code Conventions

### TypeScript
- `strict: true` + `noUncheckedIndexedAccess: true` — all array accesses return `T | undefined`
- `moduleResolution: bundler` — use bare package imports
- No `any` — use proper types or `unknown`

### React
- Client components: `'use client'` directive at top
- Server components: no directive needed (default in App Router)
- All interactive elements: `minHeight: '44px'` for touch targets
- No CSS-in-JS libraries — use inline styles with CSS variables

### Git
- Feature branches off `main`
- PRs required (CI runs typecheck + lint + tests)
- Commit messages: imperative present tense (`Add feature X`, not `Added feature X`)

### File Naming
- Pages: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` (Next.js conventions)
- Components: PascalCase (`CharacterCard.tsx`)
- Hooks: camelCase with `use` prefix (`use-characters.ts`)
- Utilities: camelCase (`wordpress.ts`)
