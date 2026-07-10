import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { updateRetainerHP, markRetainerPromoted, removeRetainer } from '@/lib/data/retainers';

type Params = { params: Promise<{ id: string; retainerId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id, retainerId } = await params;
    const body = await request.json();
    if (body?.promoted === true) {
      await markRetainerPromoted(id, retainerId);
    } else if (body?.hp_current !== undefined) {
      await updateRetainerHP(id, retainerId, Number(body.hp_current));
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id, retainerId } = await params;
    await removeRetainer(id, retainerId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
