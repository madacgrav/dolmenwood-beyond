# Research Questions

## Context
Focus on the entire persistence and platform layer: the `supabase/` directory (migrations, config, seed), the Supabase client factories and data-access modules under `apps/web/src/lib/`, direct database calls in components/hooks/pages, authentication flows, the `packages/types` package, and the deployment/infrastructure code under `infra/`, `.github/workflows/`, and `docker-compose.yml`. Trace how data, identity, and configuration move through every layer of the stack.

## Questions

1. How is the persistence layer structured end to end: how are database clients constructed for browser vs. server contexts, how are the `apps/web/src/lib/data` modules organized (inputs, return types, error handling), and which components, hooks, and pages perform database reads/writes outside that layer?

2. What is the complete database schema — every table, its columns, keys, and foreign-key relationships — and what business logic lives in Postgres RPC functions and triggers rather than application code?

3. How is authorization enforced today via Row Level Security — which policies exist on which tables, and what user/role/membership facts do they depend on to grant access?

4. How does authentication and user identity flow through the app: session establishment and refresh (middleware, cookies), OAuth and email/password flows, how `auth.users` links to `public.accounts`, and how the current user's id is resolved in server and client contexts?

5. What other Supabase platform features are in use beyond the database — storage buckets, auth emails, realtime, edge functions — and where are they consumed in the app?

6. How are the schema and migrations defined, versioned, applied, and seeded across local development, CI, and production, and what tooling or patterns exist for bulk reading/exporting rows from all tables?

7. How is the app built, deployed, and configured: what do the GitHub Actions workflows, Dockerfiles, docker-compose, and Azure Bicep templates provision and wire together, and how are secrets and environment variables threaded from local dev through CI to Azure?

8. How are domain types defined and shared between the database layer, the web app, and the rules engine — and how tightly are they coupled to Supabase row shapes or client types?
