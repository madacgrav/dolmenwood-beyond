# Task

Transition the persistence layer from Supabase (Postgres + PostgREST/RPC + RLS + Supabase Auth) to Azure Cosmos DB. Scope includes: Cosmos DB provisioning/setup (infra-as-code), new data-access pipelines against Cosmos DB, CI/CD pipeline changes, and a one-time migration script to export existing data from Supabase and import it into Cosmos DB. Note that Supabase currently also provides authentication, storage (portraits), and RLS-based authorization, so the design must account for what replaces those capabilities.
