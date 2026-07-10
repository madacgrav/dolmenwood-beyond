import { NextResponse } from 'next/server';
import { AuthError } from '@/lib/auth/session';
import { HttpError } from '@/lib/authz';

/** Map errors thrown by the data/authz layer to HTTP responses. */
export function handleRouteError(e: unknown): NextResponse {
  if (e instanceof AuthError || e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error('route error:', e);
  return NextResponse.json({ error: 'internal error' }, { status: 500 });
}
