import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { awardXP } from '@/lib/data/campaigns';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    await awardXP(id, Number(body?.gain), Boolean(body?.correction));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
