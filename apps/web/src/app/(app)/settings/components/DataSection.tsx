'use client';

import { sectionStyle, sectionHeaderStyle } from './styles';

// TODO(phase3a): re-enable via GET /api/characters/export once character
// data lives in Cosmos. The old path exported straight from Supabase in the
// browser, which no longer has a database session.
export function DataSection() {
  return (
    <section style={sectionStyle}>
      <h2 style={sectionHeaderStyle}>Data</h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.875rem' }}>
        Export all your character data as a JSON file.
      </p>
      <button
        disabled
        title="Temporarily unavailable during the database migration"
        style={{ padding: '0.625rem 1.25rem', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', borderRadius: '8px', cursor: 'not-allowed', fontSize: '0.875rem', fontWeight: '500', minHeight: '44px', opacity: 0.6 }}
      >
        ⬇ Export Characters (JSON) — unavailable during migration
      </button>
    </section>
  );
}
