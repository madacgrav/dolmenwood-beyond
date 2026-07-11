import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { listNobleHouses } from '@/lib/data/noble-houses';

export async function GET() {
  try {
    return NextResponse.json(await listNobleHouses());
  } catch (e) {
    return handleRouteError(e);
  }
}
