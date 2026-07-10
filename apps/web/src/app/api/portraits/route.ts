import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { uploadPortrait } from '@/lib/data/portraits';

export const runtime = 'nodejs';

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB, matching the client check

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    const characterId = String(form.get('characterId') ?? '');
    const ext = String(form.get('ext') ?? '');
    if (!(file instanceof File) || !characterId) {
      return NextResponse.json({ error: 'file and characterId are required' }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'image must be smaller than 5 MB' }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const { publicUrl } = await uploadPortrait(characterId, { bytes, ext });
    return NextResponse.json({ publicUrl }, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}
