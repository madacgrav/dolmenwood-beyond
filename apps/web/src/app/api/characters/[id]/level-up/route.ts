import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { levelUp, fetchLevelUpLog } from '@/lib/data/level-up';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return NextResponse.json(await fetchLevelUpLog(id));
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    await levelUp(id, {
      newLevel: body?.newLevel,
      hpGain: body?.hpGain,
      hpRoll: body?.hpRoll,
      changes: body?.changes ?? [],
      xpThreshold: Number(body?.xpThreshold) || 0,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
