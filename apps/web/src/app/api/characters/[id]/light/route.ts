import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { listLights, lightSource, burnTurn, extinguish } from '@/lib/data/light';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return NextResponse.json(await listLights(id));
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    switch (body?.action) {
      case 'light':
        return NextResponse.json(await lightSource(id, String(body?.itemId ?? '')));
      case 'burn':
        return NextResponse.json(await burnTurn(id, String(body?.lightId ?? ''), Number(body?.turns ?? 1)));
      case 'extinguish':
        return NextResponse.json(await extinguish(id, String(body?.lightId ?? '')));
      default:
        return NextResponse.json({ error: 'invalid action' }, { status: 400 });
    }
  } catch (e) {
    return handleRouteError(e);
  }
}
