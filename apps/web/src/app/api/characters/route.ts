import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { listCharacters, createCharacter } from '@/lib/data/characters';

export async function GET() {
  try {
    return NextResponse.json({ characters: await listCharacters() });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json();
    if (!input?.name || !input?.kindred || !input?.characterClass || !input?.abilityScores) {
      return NextResponse.json({ error: 'missing required character fields' }, { status: 400 });
    }
    const { id } = await createCharacter(input);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}
