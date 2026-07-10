import { NextResponse } from 'next/server';
import { setPassword } from '@/lib/data/account';
import { verifyResetToken } from '@/lib/auth/reset-token';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = String(body?.token ?? '');
  const password = String(body?.password ?? '');

  if (password.length < 8) {
    return NextResponse.json({ error: 'password must be at least 8 characters' }, { status: 400 });
  }
  const accountId = await verifyResetToken(token);
  if (!accountId) {
    return NextResponse.json({ error: 'invalid or expired reset link' }, { status: 400 });
  }
  await setPassword(accountId, password);
  return NextResponse.json({ ok: true });
}
