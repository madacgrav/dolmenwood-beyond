import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { listInventory, addInventoryItem } from '@/lib/data/inventory';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return NextResponse.json({ items: await listInventory(id) });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const item = await addInventoryItem(id, await request.json());
    return NextResponse.json(item, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}
