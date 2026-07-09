import { createServiceClient } from '@/lib/supabase/service';
import { drainNotifications } from '@/lib/notifications/dispatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Secret-protected drain endpoint: enqueues + sends pending outbound
 * notifications. Called by the scheduled GitHub Actions workflow (and
 * manually via curl). Not session-authenticated — under /api/ the auth
 * middleware is bypassed, so the shared secret header is the gate.
 */
export async function POST(request: Request) {
  const secret = process.env.NOTIFICATIONS_DRAIN_SECRET;
  if (!secret) {
    return Response.json({ error: 'not configured' }, { status: 500 });
  }
  if (request.headers.get('x-drain-secret') !== secret) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await drainNotifications(createServiceClient());
  return Response.json(result);
}
