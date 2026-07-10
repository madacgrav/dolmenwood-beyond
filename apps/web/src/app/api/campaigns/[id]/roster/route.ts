import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { getCampaignRoster } from '@/lib/data/campaigns';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return NextResponse.json({ roster: await getCampaignRoster(id) });
  } catch (e) {
    return handleRouteError(e);
  }
}
