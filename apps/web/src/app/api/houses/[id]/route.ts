import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { notFound } from '@/lib/authz';
import { getNobleHouse } from '@/lib/data/noble-houses';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const house = await getNobleHouse(id);
    if (!house) throw notFound('house');
    return NextResponse.json(house);
  } catch (e) {
    return handleRouteError(e);
  }
}
