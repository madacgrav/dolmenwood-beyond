import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { setMemberCharacter } from '@/lib/data/campaigns';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    await setMemberCharacter(id, String(body?.characterId ?? ''));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
