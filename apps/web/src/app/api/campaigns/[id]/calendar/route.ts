import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { setCampaignDate, advanceCampaignDay } from '@/lib/data/campaigns';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const date =
      body?.op === 'advanceDay' ? await advanceCampaignDay(id) : await setCampaignDate(id, body?.date);
    return NextResponse.json({ currentDate: date });
  } catch (e) {
    return handleRouteError(e);
  }
}
