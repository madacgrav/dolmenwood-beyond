# Supabase

## Local Development

Install Supabase CLI then:

```bash
supabase start
supabase db reset  # applies all migrations + seed
```

## Migrations

Numbered migrations in `migrations/`:
- `000001_initial_schema.sql` — Core tables + RLS policies + auth triggers
- `000002_equipment_catalog.sql` — Equipment catalog reference table
- `000003_invite_code_function.sql` — Invite code generator

## Required Secrets (GitHub Actions)
- `SUPABASE_ACCESS_TOKEN` — Supabase CLI access token
- `SUPABASE_DB_URL` — Database URL for migrations
- `NEXT_PUBLIC_SUPABASE_URL` — Project URL (can be a var)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (server-side only)
