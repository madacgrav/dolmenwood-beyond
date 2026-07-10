import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { updateSession, deleteSession, setSessionRsvp } from '@/lib/data/schedule';

type Params = { params: Promise<{ id: string; sessionId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id, sessionId } = await params;
    const body = await request.json();
    if (body?.rsvp !== undefined) {
      await setSessionRsvp(id, sessionId, body.rsvp);
    } else {
      await updateSession(id, sessionId, {
        title: body?.title,
        scheduledAt: body?.scheduledAt,
        notes: body?.notes,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id, sessionId } = await params;
    await deleteSession(id, sessionId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
