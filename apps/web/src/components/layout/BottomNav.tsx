'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/characters', label: 'Characters', icon: '👤' },
  { href: '/party', label: 'Party', icon: '👥' },
  { href: '/dice', label: 'Dice', icon: '🎲' },
  { href: '/settings', label: 'More', icon: '⋯' },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '80px',
        backgroundColor: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 50,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              minWidth: '60px',
              minHeight: '44px',
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
              textDecoration: 'none',
              fontSize: '11px',
              fontWeight: isActive ? '600' : '400',
            }}
          >
            <span style={{ fontSize: '20px' }}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
