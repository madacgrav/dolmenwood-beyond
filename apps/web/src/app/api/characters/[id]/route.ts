import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import {
  fetchCharacterWithNotes,
  updateCharacter,
  deleteCharacter,
} from '@/lib/data/characters';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return NextResponse.json(await fetchCharacterWithNotes(id));
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await updateCharacter(id, await request.json());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await deleteCharacter(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
