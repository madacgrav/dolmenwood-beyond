import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { getCampaignQuests, addQuest } from '@/lib/data/quests';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return NextResponse.json({ quests: await getCampaignQuests(id) });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    await addQuest(id, {
      title: body?.title,
      giver: body?.giver ?? '',
      status: body?.status ?? 'active',
      note: body?.note ?? '',
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}
