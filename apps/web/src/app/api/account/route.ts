import { NextResponse } from 'next/server';
import { AuthError, requireAccountId } from '@/lib/auth/session';
import {
  deleteAccount,
  fetchAccount,
  updateDisplayName,
  updateNotificationPrefs,
} from '@/lib/data/account';

function handleError(e: unknown) {
  if (e instanceof AuthError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error('account route error:', e);
  return NextResponse.json({ error: 'internal error' }, { status: 500 });
}

export async function GET() {
  try {
    const account = await fetchAccount(await requireAccountId());
    if (!account) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json(account);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(request: Request) {
  try {
    const accountId = await requireAccountId();
    const body = await request.json().catch(() => ({}));

    if (typeof body.display_name === 'string') {
      await updateDisplayName(accountId, body.display_name);
    }
    const prefKeys = ['phone', 'email_opt_in', 'sms_opt_in', 'whatsapp_opt_in'] as const;
    if (prefKeys.some((k) => body[k] !== undefined)) {
      await updateNotificationPrefs(accountId, {
        phone: body.phone,
        email_opt_in: body.email_opt_in,
        sms_opt_in: body.sms_opt_in,
        whatsapp_opt_in: body.whatsapp_opt_in,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE() {
  try {
    await deleteAccount(await requireAccountId());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
