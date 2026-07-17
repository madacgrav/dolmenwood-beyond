import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { updateQuest, deleteQuest } from '@/lib/data/quests';

type Params = { params: Promise<{ id: string; questId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id, questId } = await params;
    const body = await request.json();
    await updateQuest(id, questId, {
      title: body?.title,
      giver: body?.giver ?? '',
      status: body?.status ?? 'active',
      note: body?.note ?? '',
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id, questId } = await params;
    await deleteQuest(id, questId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
