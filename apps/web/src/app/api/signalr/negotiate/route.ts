import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { handleRouteError } from '@/lib/http';
import { requireAccountId } from '@/lib/auth/session';

export const runtime = 'nodejs';

const HUB = 'characters';

/**
 * Serverless-mode SignalR negotiate: issue the browser a short-lived
 * access token for the client endpoint, signed with the service key.
 * Session-gated so only signed-in users can subscribe.
 */
export async function POST() {
  try {
    const accountId = await requireAccountId();
    const connectionString = process.env.SIGNALR_CONNECTION_STRING;
    if (!connectionString) {
      return NextResponse.json({ error: 'not configured' }, { status: 500 });
    }
    const endpoint = /Endpoint=(.+?);/i.exec(connectionString)?.[1];
    const accessKey = /AccessKey=(.+?);/i.exec(connectionString)?.[1];
    if (!endpoint || !accessKey) {
      return NextResponse.json({ error: 'invalid connection string' }, { status: 500 });
    }

    const url = `${endpoint}/client/?hub=${HUB}`;
    const accessToken = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setAudience(url)
      .setSubject(accountId)
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(accessKey));

    return NextResponse.json({ url, accessToken });
  } catch (e) {
    return handleRouteError(e);
  }
}
