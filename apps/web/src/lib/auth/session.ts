import { auth } from './config';
import { fetchAccountDoc } from '@/lib/data/account';
import type { AccountDoc } from '@/lib/cosmos/types';

/** Thrown by require* helpers; route handlers map it to an HTTP status. */
export class AuthError extends Error {
  constructor(public status: 401 | 403 = 401, message = 'Unauthorized') {
    super(message);
  }
}

export async function getCurrentAccountId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function requireAccountId(): Promise<string> {
  const id = await getCurrentAccountId();
  if (!id) throw new AuthError();
  return id;
}

export async function getCurrentAccount(): Promise<AccountDoc> {
  const doc = await fetchAccountDoc(await requireAccountId());
  if (!doc) throw new AuthError();
  return doc;
}
