import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { updateMountHP, removeMount } from '@/lib/data/mounts';

type Params = { params: Promise<{ id: string; mountId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id, mountId } = await params;
    const body = await request.json();
    await updateMountHP(id, mountId, Number(body?.hp_current));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id, mountId } = await params;
    await removeMount(id, mountId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
