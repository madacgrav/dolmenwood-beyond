import { NextResponse } from 'next/server';
import { fetchAccountDocByEmail } from '@/lib/data/account';
import { createResetToken } from '@/lib/auth/reset-token';
import { sendEmail } from '@/lib/notifications/channels/email';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? '').trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  // Always 200 so the endpoint doesn't leak which emails have accounts.
  const account = await fetchAccountDocByEmail(email);
  if (account) {
    try {
      const token = await createResetToken(account.id);
      const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
      const link = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
      await sendEmail(
        account.email,
        'Reset your Dolmenwood Beyond password',
        `Follow this link to set a new password (valid for 1 hour):\n\n${link}\n\nIf you did not request this, you can ignore this email.`,
      );
    } catch (e) {
      console.error('reset email failed:', e);
      return NextResponse.json({ error: 'could not send reset email' }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
