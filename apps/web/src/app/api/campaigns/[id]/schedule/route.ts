import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { getCampaignSchedule, createSession } from '@/lib/data/schedule';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return NextResponse.json({ sessions: await getCampaignSchedule(id) });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    await createSession(id, {
      title: body?.title,
      scheduledAt: body?.scheduledAt,
      notes: body?.notes ?? '',
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}
