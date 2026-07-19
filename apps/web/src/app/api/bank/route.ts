import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { dmBankOverview } from '@/lib/data/bank';

export async function GET(request: Request) {
  try {
    const campaignId = new URL(request.url).searchParams.get('campaignId') ?? undefined;
    return NextResponse.json({ entries: await dmBankOverview(campaignId) });
  } catch (e) {
    return handleRouteError(e);
  }
}
