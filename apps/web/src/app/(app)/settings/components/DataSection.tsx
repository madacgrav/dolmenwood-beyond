'use client';

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchCharactersForExport } from '@/lib/data/account';
import { sectionStyle, sectionHeaderStyle } from './styles';

interface DataSectionProps {
  supabase: SupabaseClient;
}

export function DataSection({ supabase }: DataSectionProps) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  async function handleExportData() {
    setExporting(true);
    setExportError('');
    try {
      const { characters: chars, error: cErr } = await fetchCharactersForExport(supabase);
      if (cErr) throw new Error(cErr);
      const json = JSON.stringify({ exportedAt: new Date().toISOString(), characters: chars }, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dolmenwood-characters-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  return (
    <section style={sectionStyle}>
      <h2 style={sectionHeaderStyle}>Data</h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.875rem' }}>
        Export all your character data as a JSON file.
      </p>
      <button
        onClick={handleExportData}
        disabled={exporting}
        style={{ padding: '0.625rem 1.25rem', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500', minHeight: '44px', opacity: exporting ? 0.7 : 1 }}
      >
        {exporting ? 'Exporting…' : '⬇ Export Characters (JSON)'}
      </button>
      {exportError && <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-danger)' }}>{exportError}</p>}
    </section>
  );
}
