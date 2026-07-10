import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { fetchMagicData, applyMagicOp, type MagicOp } from '@/lib/data/spells';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return NextResponse.json(await fetchMagicData(id));
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await request.json()) as MagicOp;
    return NextResponse.json(await applyMagicOp(id, body));
  } catch (e) {
    return handleRouteError(e);
  }
}
