import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { fetchXPLog } from '@/lib/data/xp-log';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return NextResponse.json(await fetchXPLog(id));
  } catch (e) {
    return handleRouteError(e);
  }
}
