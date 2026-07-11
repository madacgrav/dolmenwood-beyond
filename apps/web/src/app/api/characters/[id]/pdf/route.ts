import { fetchFullCharacter } from '@/lib/data/characters';
import { fillCharacterSheet } from '@/lib/pdf/character-sheet';
import { handleRouteError } from '@/lib/http';
import { HttpError } from '@/lib/authz';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

/**
 * Owner-only: download the official Dolmenwood sheet filled with this character.
 *
 * The blank sheet is © Necrotic Gnome and stays out of the (public) repo:
 * prod points SHEET_PDF_URL at a private copy; local dev drops the file at
 * apps/web/public/dolmenwood-sheet.pdf (gitignored) and needs no env.
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const character = await fetchFullCharacter(id);
    const src = process.env.SHEET_PDF_URL || new URL('/dolmenwood-sheet.pdf', request.url);
    const res = await fetch(src);
    if (!res.ok) throw new HttpError(503, 'sheet template not available');
    const blank = await res.arrayBuffer();
    const bytes = await fillCharacterSheet(blank, character);
    const filename = `${character.name.replace(/[^\w-]+/g, '_') || 'character'}.pdf`;
    return new Response(bytes as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
