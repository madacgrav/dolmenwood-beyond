'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ImportCharacterPage() {
  const [json, setJson] = useState('');
  const [error, setError] = useState('');

  function handleImport() {
    try {
      const data = JSON.parse(json);
      if (!data.name || !data.kindred || !data.characterClass) {
        setError('Invalid character JSON — must include name, kindred, and characterClass.');
        return;
      }
      // TODO: save to Supabase and redirect
      setError('Import functionality coming soon.');
    } catch {
      setError('Invalid JSON — please check your input.');
    }
  }

  return (
    <div style={{ padding: '1.5rem 1rem', maxWidth: '500px', margin: '0 auto' }}>
      <Link href="/characters/new" style={{ color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '0.875rem' }}>
        ← Back
      </Link>
      <h1 style={{ fontFamily: 'var(--font-display), Georgia, serif', color: 'var(--color-text)', margin: '0.75rem 0' }}>
        Import Character
      </h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Paste your character JSON export below.
      </p>
      {error && (
        <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: 'color-mix(in srgb, var(--color-danger) 15%, transparent)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}
      <textarea
        value={json}
        onChange={e => { setJson(e.target.value); setError(''); }}
        placeholder='{"name":"Aldric","kindred":"Human","characterClass":"Fighter",...}'
        rows={12}
        style={{
          width: '100%', padding: '0.75rem', borderRadius: '8px',
          backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
          color: 'var(--color-text)', fontFamily: 'monospace', fontSize: '0.8rem',
          resize: 'vertical', boxSizing: 'border-box',
        }}
      />
      <button onClick={handleImport} style={{
        marginTop: '1rem', width: '100%', padding: '0.75rem',
        backgroundColor: 'var(--color-primary)', color: 'white',
        border: 'none', borderRadius: '8px', fontSize: '1rem',
        fontWeight: '600', cursor: 'pointer', minHeight: '44px',
      }}>
        Import Character
      </button>
    </div>
  );
}
