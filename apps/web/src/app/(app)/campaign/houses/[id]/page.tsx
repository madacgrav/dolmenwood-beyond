'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchNobleHouse } from '@/lib/api/noble-houses';
import type { NobleHouseDoc } from '@/lib/cosmos/types';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '0.9rem', color: 'var(--color-text)', lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}

export default function NobleHouseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? (rawId[0] ?? '') : (rawId ?? '');

  const [house, setHouse] = useState<NobleHouseDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundFlag, setNotFoundFlag] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchNobleHouse(id);
        if (!data) setNotFoundFlag(true);
        else setHouse(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

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
          {house?.name ?? 'Noble House'}
        </h1>
      </div>

      <div style={{ padding: '1rem', maxWidth: '600px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ height: '200px', borderRadius: '10px', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ) : notFoundFlag || !house ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🏰</div>
            <p style={{ fontSize: '0.95rem' }}>House not found.</p>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 700, marginBottom: '1rem' }}>{house.alignment}</div>
            <Field label="Domain" value={house.domain} />
            <Field label="Seat" value={house.seat} />
            <Field label="Head" value={house.head} />
          </div>
        )}
      </div>
    </div>
  );
}
