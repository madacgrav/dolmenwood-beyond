import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { getCampaignNpcs, addNpc } from '@/lib/data/npcs';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return NextResponse.json({ npcs: await getCampaignNpcs(id) });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    await addNpc(id, {
      name: body?.name,
      relationship: body?.relationship ?? '',
      status: body?.status ?? 'unknown',
      note: body?.note ?? '',
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}
