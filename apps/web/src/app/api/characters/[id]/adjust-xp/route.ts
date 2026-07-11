import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { adjustXP } from '@/lib/data/characters';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    return NextResponse.json(await adjustXP(id, Number(body?.newTotal)));
  } catch (e) {
    return handleRouteError(e);
  }
}
