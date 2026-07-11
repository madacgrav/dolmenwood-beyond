import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { updateNpc, deleteNpc } from '@/lib/data/npcs';

type Params = { params: Promise<{ id: string; npcId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id, npcId } = await params;
    const body = await request.json();
    await updateNpc(id, npcId, {
      name: body?.name,
      relationship: body?.relationship ?? '',
      status: body?.status ?? 'unknown',
      note: body?.note ?? '',
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id, npcId } = await params;
    await deleteNpc(id, npcId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
