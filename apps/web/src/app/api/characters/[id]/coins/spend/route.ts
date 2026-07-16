import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { spendCoins } from '@/lib/data/characters';
import { amountToCp } from '@/lib/coins';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const denom = body?.denom;
    if (denom !== 'gp' && denom !== 'sp' && denom !== 'cp') {
      return NextResponse.json({ error: 'invalid denom' }, { status: 400 });
    }
    const coins = await spendCoins(id, amountToCp(Number(body?.amount), denom));
    return NextResponse.json(coins);
  } catch (e) {
    return handleRouteError(e);
  }
}
