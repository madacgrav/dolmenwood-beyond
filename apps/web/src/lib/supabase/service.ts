import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only elevated client for the notification dispatch path.
 * Bypasses RLS — never import from client components. The dispatch
 * path needs to read other users' contact info and opt-ins and write
 * delivery status, which the session-scoped anon client cannot do.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('createServiceClient requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
