import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { markNotificationRead } from '@/lib/data/notifications';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await markNotificationRead(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
