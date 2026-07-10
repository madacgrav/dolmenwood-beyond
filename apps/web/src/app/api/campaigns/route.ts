import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import {
  createCampaign,
  loadPlayerCampaigns,
  loadDMCampaigns,
  listMyCampaignNames,
} from '@/lib/data/campaigns';

export async function GET(request: Request) {
  try {
    const as = new URL(request.url).searchParams.get('as');
    if (as === 'referee') return NextResponse.json({ data: await loadDMCampaigns() });
    if (as === 'names') return NextResponse.json({ campaigns: await listMyCampaignNames() });
    return NextResponse.json({ campaigns: await loadPlayerCampaigns() });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id } = await createCampaign(String(body?.name ?? ''));
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}
