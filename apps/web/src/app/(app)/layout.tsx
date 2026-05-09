import { BottomNav } from '@/components/layout/BottomNav';
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
      <main style={{ flex: 1, paddingBottom: '80px' }}>{children}</main>
      <BottomNav isAdmin={isAdmin} />
    </div>
  );
}

