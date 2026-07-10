import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { fetchCoins, saveCoins } from '@/lib/data/characters';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return NextResponse.json(await fetchCoins(id));
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const toInt = (v: unknown) => Math.max(0, Number.parseInt(String(v), 10) || 0);
    await saveCoins(id, { gp: toInt(body?.gp), sp: toInt(body?.sp), cp: toInt(body?.cp) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
