import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe Auth.js config: no Node-only imports (bcrypt, Cosmos) so the
 * middleware can verify the JWT session cookie without pulling the full
 * credentials provider into the edge bundle. The Credentials provider is
 * added in ./config.ts (Node runtime only).
 */
export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/sign-in' },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
