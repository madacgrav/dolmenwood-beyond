import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './shared';
import { fetchAccountDocByEmail, verifyPassword } from '@/lib/data/account';

/** Full Auth.js setup (Node runtime). Middleware uses ./shared instead. */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = String(credentials?.email ?? '').trim().toLowerCase();
        const password = String(credentials?.password ?? '');
        if (!email || !password) return null;
        const account = await fetchAccountDocByEmail(email);
        // Null hash ⇒ migrated account that must reset its password first.
        if (!account || !(await verifyPassword(account, password))) return null;
        return { id: account.id, email: account.email, name: account.displayName };
      },
    }),
  ],
});
