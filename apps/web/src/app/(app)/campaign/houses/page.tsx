'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listNobleHouses } from '@/lib/api/noble-houses';
import type { NobleHouseDoc } from '@/lib/cosmos/types';

export default function NobleHousesPage() {
  const router = useRouter();
  const [houses, setHouses] = useState<NobleHouseDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setHouses(await listNobleHouses());
      } catch {
        setLoadError('Failed to load Noble Houses');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'var(--color-bg)', paddingBottom: '5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1rem 0.5rem', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <button
          onClick={() => router.back()}
          aria-label="Back"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.25rem', padding: '0.25rem', minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ←
        </button>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display), Georgia, serif', color: 'var(--color-primary)', fontSize: '1.1rem' }}>
          Noble Houses
        </h1>
      </div>

      <div style={{ padding: '1rem', maxWidth: '600px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: '72px', borderRadius: '10px', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : loadError ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--color-danger)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚠</div>
            <p style={{ fontSize: '0.95rem' }}>{loadError}</p>
          </div>
        ) : houses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🏰</div>
            <p style={{ fontSize: '0.95rem' }}>No Noble Houses found.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {houses.map(house => (
              <div key={house.id} style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '0.875rem 1rem' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-text)' }}>{house.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>{house.alignment} · {house.seat}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
