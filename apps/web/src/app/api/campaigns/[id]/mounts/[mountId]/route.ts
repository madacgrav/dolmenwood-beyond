import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { removePackAnimal } from '@/lib/data/campaigns';

type Params = { params: Promise<{ id: string; mountId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id, mountId } = await params;
    await removePackAnimal(id, mountId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
