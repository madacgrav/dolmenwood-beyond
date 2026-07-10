import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { insertPackAnimal } from '@/lib/data/campaigns';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const animal = await insertPackAnimal(id, {
      name: String(body?.name ?? ''),
      mountType: String(body?.mountType ?? 'Mule'),
      speed: Number(body?.speed) || 0,
    });
    return NextResponse.json(animal, { status: 201 });
  } catch (e) {
    return handleRouteError(e);
  }
}
