import { NextResponse } from 'next/server';
import { createAccount } from '@/lib/data/account';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');
  const displayName = typeof body?.displayName === 'string' ? body.displayName : undefined;

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'password must be at least 8 characters' }, { status: 400 });
  }

  try {
    await createAccount({ email, password, displayName });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'registration failed';
    const status = message.includes('already exists') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
