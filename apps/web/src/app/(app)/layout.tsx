import { BottomNav } from '@/components/layout/BottomNav';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data } = await supabase
      .from('accounts')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    isAdmin = (data as { is_admin: boolean } | null)?.is_admin ?? false;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      {user && (
        <header style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: '52px', zIndex: 50,
          backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 1rem',
        }}>
          <NotificationBell />
        </header>
      )}
      <main style={{ flex: 1, paddingTop: user ? '52px' : 0, paddingBottom: '80px' }}>{children}</main>
      <BottomNav isAdmin={isAdmin} />
    </div>
  );
}

