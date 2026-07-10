'use client';

import { useEffect, useState, useCallback } from 'react';
import { loadNotifications, markNotificationRead, type AppNotification } from '@/lib/api/notifications';

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);

  const refetch = useCallback(async () => {
    setNotifications(await loadNotifications());
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const data = await loadNotifications();
      if (active) setNotifications(data);
    })();
    return () => { active = false; };
  }, []);

  const unread = notifications.filter(n => !n.read).length;

  async function handleClickItem(n: AppNotification) {
    if (!n.read) {
      await markNotificationRead(n.id);
      await refetch();
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Notifications"
        style={{
          position: 'relative', background: 'transparent', border: 'none',
          fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1,
          minWidth: '44px', minHeight: '44px',
        }}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: '4px', right: '4px',
            minWidth: '16px', height: '16px', padding: '0 4px', borderRadius: '8px',
            backgroundColor: 'var(--color-danger)', color: 'white',
            fontSize: '0.6rem', fontWeight: '700',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '52px', right: 0, width: '280px', maxHeight: '360px',
          overflowY: 'auto', zIndex: 60,
          backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: '12px', padding: '0.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}>
          {notifications.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
              No notifications.
            </div>
          ) : (
            notifications.map(n => (
              <button
                key={n.id}
                onClick={() => handleClickItem(n)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '0.6rem 0.7rem', borderRadius: '8px', border: 'none',
                  backgroundColor: n.read ? 'transparent' : 'var(--color-bg)',
                  color: 'var(--color-text)', cursor: 'pointer', marginBottom: '0.25rem',
                }}
              >
                <div style={{ fontSize: '0.82rem', fontWeight: n.read ? '400' : '700' }}>{n.body}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                  {relativeTime(n.created_at)}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
