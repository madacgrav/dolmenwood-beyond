import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/http';
import { dmBankOverview } from '@/lib/data/bank';

export async function GET() {
  try {
    return NextResponse.json({ entries: await dmBankOverview() });
  } catch (e) {
    return handleRouteError(e);
  }
}
