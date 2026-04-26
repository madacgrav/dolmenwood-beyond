import { BottomNav } from '@/components/layout/BottomNav';

export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <main style={{ flex: 1, paddingBottom: '80px' }}>{children}</main>
      <BottomNav />
    </div>
  );
}
