import { BottomNav } from '@/components/layout/BottomNav';
import { AppBar } from '@/components/layout/AppBar';
import { PageHeaderProvider } from '@/components/layout/PageHeaderContext';
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
    <PageHeaderProvider>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        {session && <AppBar />}
        <main style={{ flex: 1, paddingTop: session ? '52px' : 0, paddingBottom: '64px' }}>{children}</main>
        <BottomNav isAdmin={isAdmin} />
      </div>
    </PageHeaderProvider>
  );
}
