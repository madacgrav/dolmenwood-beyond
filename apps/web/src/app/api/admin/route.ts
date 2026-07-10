import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { getAdminData } from '@/lib/data/admin';

export async function GET() {
  try {
    return NextResponse.json(await getAdminData());
  } catch (e) {
    return handleRouteError(e);
  }
}
