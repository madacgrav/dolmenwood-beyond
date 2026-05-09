'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const BASE_NAV_ITEMS: NavItem[] = [
  { href: '/characters', label: 'Characters', icon: '🏠' },
  { href: '/news', label: 'News', icon: '📜' },
  { href: '/campaign', label: 'Campaign', icon: '⚔️' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

const ADMIN_NAV_ITEM: NavItem = { href: '/admin', label: 'Admin', icon: '🛡️' };

interface Props {
  isAdmin?: boolean;
}

export function BottomNav({ isAdmin = false }: Props) {
  const pathname = usePathname();
  const navItems = isAdmin ? [...BASE_NAV_ITEMS, ADMIN_NAV_ITEM] : BASE_NAV_ITEMS;

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
      {navItems.map((item) => {
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
              minWidth: '44px',
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

