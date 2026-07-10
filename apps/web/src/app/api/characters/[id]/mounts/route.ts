import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { listCharacterMounts, addMount } from '@/lib/data/mounts';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return NextResponse.json({ mounts: await listCharacterMounts(id) });
  } catch (e) {
    return handleRouteError(e);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const mount = await addMount(id, await request.json());
    return NextResponse.json(mount, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}
