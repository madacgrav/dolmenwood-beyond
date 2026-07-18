import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { updateInventoryEntry, removeInventoryItem } from '@/lib/data/inventory';

type Params = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id, itemId } = await params;
    const body = await request.json();
    await updateInventoryEntry(id, itemId, {
      quantity: body?.quantity,
      location: body?.location,
      notes: body?.notes,
      move: body?.move,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id, itemId } = await params;
    await removeInventoryItem(id, itemId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError(e);
  }
}
