import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { refereeBankOverview } from '@/lib/data/bank';

export async function GET() {
  try {
    return NextResponse.json({ entries: await refereeBankOverview() });
  } catch (e) {
    return handleRouteError(e);
  }
}
