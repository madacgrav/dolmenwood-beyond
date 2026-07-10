import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { fetchBankState, recordBankTransaction } from '@/lib/data/bank';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return NextResponse.json(await fetchBankState(id));
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    await recordBankTransaction(id, Number(body?.amountGp), String(body?.description ?? ''));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
