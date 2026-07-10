import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { listActiveRetainers, addRetainer } from '@/lib/data/retainers';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return NextResponse.json({ retainers: await listActiveRetainers(id) });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const retainer = await addRetainer(id, await request.json());
    return NextResponse.json(retainer, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}
