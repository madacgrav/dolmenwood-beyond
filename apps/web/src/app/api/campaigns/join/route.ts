import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { joinCampaign } from '@/lib/data/campaigns';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json(
      await joinCampaign(String(body?.inviteCode ?? ''), String(body?.characterId ?? '')),
    );
  } catch (e) {
    return handleRouteError(e);
  }
}
