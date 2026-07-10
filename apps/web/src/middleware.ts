import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth/shared';

const PUBLIC_ROUTES = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password'];

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const pathname = request.nextUrl.pathname;
  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  if (!request.auth && !isPublicRoute) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  if (request.auth && isPublicRoute) {
    return NextResponse.redirect(new URL('/characters', request.url));
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|api/).*)'],
};
