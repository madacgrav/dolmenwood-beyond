import { BottomNav } from '@/components/layout/BottomNav';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { auth } from '@/lib/auth/config';
import { fetchAccountDoc } from '@/lib/data/account';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  let isAdmin = false;
  if (session?.user?.id) {
    const account = await fetchAccountDoc(session.user.id);
    isAdmin = account?.isAdmin ?? false;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      {session && (
        <header style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: '52px', zIndex: 50,
          backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 1rem',
        }}>
          <NotificationBell />
        </header>
      )}
      <main style={{ flex: 1, paddingTop: session ? '52px' : 0, paddingBottom: '80px' }}>{children}</main>
      <BottomNav isAdmin={isAdmin} />
    </div>
  );
}
