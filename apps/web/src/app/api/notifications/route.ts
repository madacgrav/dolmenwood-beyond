import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { loadNotifications } from '@/lib/data/notifications';

export async function GET() {
  try {
    return NextResponse.json({ notifications: await loadNotifications() });
  } catch (e) {
    return handleRouteError(e);
  }
}
