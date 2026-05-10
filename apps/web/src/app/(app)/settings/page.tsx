'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useOptionalRules } from '@/hooks/use-optional-rules';

type Account = {
  display_name: string;
  email: string;
  role: string;
  invite_code: string;
};

const sectionStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  borderRadius: '12px',
  padding: '1.25rem',
  marginBottom: '1rem',
  border: '1px solid var(--color-border)',
};

const sectionHeaderStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display), Georgia, serif',
  fontSize: '0.875rem',
  fontWeight: '600',
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '1rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.625rem 0.75rem',
  backgroundColor: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: '8px',
  color: 'var(--color-text)',
  fontSize: '0.9375rem',
  outline: 'none',
  boxSizing: 'border-box',
};

export default function SettingsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [account, setAccount] = useState<Account | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [saveNameMsg, setSaveNameMsg] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [offlineMode, setOfflineMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [optionalRules, setOptionalRules] = useOptionalRules();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    const savedTheme = (localStorage.getItem('dolmenwood-theme') as 'light' | 'dark' | 'system') ?? 'system';
    setTheme(savedTheme);

    const savedOffline = localStorage.getItem('dolmenwood-offline') === 'true';
    setOfflineMode(savedOffline);

    async function fetchAccount() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/sign-in'); return; }

      const { data } = await supabase
        .from('accounts')
        .select('display_name, email, role, invite_code')
        .eq('id', user.id)
        .single();

      if (data) {
        setAccount(data as Account);
        setDisplayName(data.display_name ?? '');
      }
    }

    fetchAccount();
  }, [router, supabase]);

  async function handleSaveName() {
    if (!account) return;
    setSavingName(true);
    setSaveNameMsg('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('accounts')
      .update({ display_name: displayName })
      .eq('id', user.id);
    setSavingName(false);
    if (error) {
      setSaveNameMsg('Failed to save.');
    } else {
      setAccount((prev) => prev ? { ...prev, display_name: displayName } : prev);
      setSaveNameMsg('Saved!');
      setTimeout(() => setSaveNameMsg(''), 2000);
    }
  }

  async function handleCopy() {
    if (!account?.invite_code) return;
    await navigator.clipboard.writeText(account.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleThemeChange(t: 'light' | 'dark' | 'system') {
    setTheme(t);
    localStorage.setItem('dolmenwood-theme', t);
    if (t === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (t === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/sign-in');
  }

  async function handleExportData() {
    setExporting(true);
    setExportError('');
    try {
      const { data: chars, error: cErr } = await supabase
        .from('characters')
        .select('*, character_inventory(*), character_spells(*)');
      if (cErr) throw new Error(cErr.message);
      const json = JSON.stringify({ exportedAt: new Date().toISOString(), characters: chars }, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dolmenwood-characters-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError('');
    try {
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw new Error(error.message);
      await supabase.auth.signOut();
      router.push('/sign-in');
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete account');
      setDeleting(false);
    }
  }

  async function handleChangePassword() {
    if (!account?.email) return;
    setResetSent(false);
    await supabase.auth.resetPasswordForEmail(account.email);
    setResetSent(true);
    setTimeout(() => setResetSent(false), 4000);
  }

  const initials = displayName.charAt(0).toUpperCase() || '?';
  const roleBadgeColor = account?.role === 'referee' ? 'var(--color-gold)' : 'var(--color-primary)';

  return (
    <div style={{ padding: '1.25rem', paddingTop: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display), Georgia, serif', color: 'var(--color-primary)', fontSize: '1.5rem', marginBottom: '1.5rem' }}>
        Settings
      </h1>

      {/* Profile */}
      <section style={sectionStyle}>
        <h2 style={sectionHeaderStyle}>Profile</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '1.5rem', fontFamily: 'var(--font-display), Georgia, serif', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Display Name</div>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleSaveName}
            disabled={savingName}
            style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', minHeight: '44px', opacity: savingName ? 0.7 : 1 }}
          >
            {savingName ? 'Saving…' : 'Save Name'}
          </button>
          {saveNameMsg && (
            <span style={{ fontSize: '0.875rem', color: saveNameMsg === 'Saved!' ? 'var(--color-primary)' : 'var(--color-danger)' }}>
              {saveNameMsg}
            </span>
          )}
        </div>

        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
          {account?.email ?? '—'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          {account?.role && (
            <span style={{ display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '999px', backgroundColor: roleBadgeColor, color: 'white', fontSize: '0.75rem', fontWeight: '600', textTransform: 'capitalize' }}>
              {account.role}
            </span>
          )}
          <button
            onClick={handleChangePassword}
            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline', padding: 0, minHeight: '44px' }}
          >
            {resetSent ? 'Reset email sent!' : 'Change Password'}
          </button>
        </div>
      </section>

      {/* Invite Code */}
      <section style={sectionStyle}>
        <h2 style={sectionHeaderStyle}>Invite Code</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
          Share this code with friends to invite them to your campaigns.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ flex: 1, padding: '0.75rem', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', fontFamily: 'monospace', fontSize: '1.25rem', letterSpacing: '0.15em', color: 'var(--color-gold)', textAlign: 'center' }}>
            {account?.invite_code ?? '------'}
          </div>
          <button
            onClick={handleCopy}
            style={{ padding: '0.75rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', cursor: 'pointer', minHeight: '44px', minWidth: '44px', fontSize: '1.125rem' }}
            aria-label="Copy invite code"
          >
            {copied ? '✓' : '📋'}
          </button>
        </div>
      </section>

      {/* Appearance */}
      <section style={sectionStyle}>
        <h2 style={sectionHeaderStyle}>Appearance</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button
              key={t}
              onClick={() => handleThemeChange(t)}
              style={{
                flex: 1,
                padding: '0.625rem',
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: theme === t ? 'var(--color-primary)' : 'var(--color-surface)',
                color: theme === t ? 'white' : 'var(--color-text)',
                border: `1px solid ${theme === t ? 'var(--color-primary)' : 'var(--color-border)'}`,
                fontWeight: '500',
                textTransform: 'capitalize',
                fontSize: '0.875rem',
                minHeight: '44px',
              }}
            >
              {t === 'light' ? '☀️ Light' : t === 'dark' ? '🌙 Dark' : '⚙️ System'}
            </button>
          ))}
        </div>
      </section>

      {/* Offline Mode */}
      <section style={sectionStyle}>
        <h2 style={sectionHeaderStyle}>Offline Mode</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>Cache characters for offline use</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>Stores your characters locally for offline viewing</div>
          </div>
          <button
            onClick={() => {
              const next = !offlineMode;
              setOfflineMode(next);
              localStorage.setItem('dolmenwood-offline', String(next));
            }}
            aria-label={offlineMode ? 'Disable offline mode' : 'Enable offline mode'}
            style={{ width: '52px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer', backgroundColor: offlineMode ? 'var(--color-primary)' : 'var(--color-border)', position: 'relative', transition: 'background-color 0.2s', flexShrink: 0 }}
          >
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'white', position: 'absolute', top: '3px', left: offlineMode ? '27px' : '3px', transition: 'left 0.2s' }} />
          </button>
        </div>
      </section>

      {/* Optional Rules */}
      <section style={sectionStyle}>
        <h2 style={sectionHeaderStyle}>Optional Rules</h2>
        {[
          { key: 'subParReroll' as const, label: 'Sub-Par Re-roll', desc: 'Allow re-rolling if all ability scores are below 9' },
          { key: 'hpRerollLowRolls' as const, label: 'Re-roll Low HP', desc: 'Re-roll HP if result is 1 or 2 at level-up' },
          { key: 'coinWeightEnabled' as const, label: 'Coin Weight', desc: 'Count coins toward encumbrance (100 coins = 1 item)' },
        ].map(({ key, label, desc }) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
            <div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{label}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>{desc}</div>
            </div>
            <button
              onClick={() => setOptionalRules(prev => ({ ...prev, [key]: !prev[key] }))}
              aria-label={optionalRules[key] ? `Disable ${label}` : `Enable ${label}`}
              style={{ width: '52px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer', backgroundColor: optionalRules[key] ? 'var(--color-primary)' : 'var(--color-border)', position: 'relative', transition: 'background-color 0.2s', flexShrink: 0 }}
            >
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'white', position: 'absolute', top: '3px', left: optionalRules[key] ? '27px' : '3px', transition: 'left 0.2s' }} />
            </button>
          </div>
        ))}
      </section>

      {/* Data */}
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

      {/* Sign Out */}
      <section style={{ padding: '1.5rem 0 0.75rem' }}>
        <button
          onClick={handleSignOut}
          style={{ width: '100%', padding: '0.875rem', backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)', border: `1px solid var(--color-danger)`, borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', minHeight: '44px' }}
        >
          Sign Out
        </button>
      </section>

      {/* Danger Zone */}
      <section style={{ ...sectionStyle, borderColor: 'var(--color-danger)', marginBottom: '2rem' }}>
        <h2 style={{ ...sectionHeaderStyle, color: 'var(--color-danger)' }}>Danger Zone</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.875rem' }}>
          Permanently delete your account and all associated characters, inventory, and data. This cannot be undone.
        </p>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          style={{ padding: '0.625rem 1.25rem', backgroundColor: 'transparent', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600', minHeight: '44px' }}
        >
          Delete Account
        </button>
      </section>

      {/* Delete account confirmation modal */}
      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-danger)', borderRadius: '14px', padding: '1.5rem', maxWidth: '360px', width: '100%' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontFamily: 'var(--font-display), Georgia, serif', color: 'var(--color-danger)', fontSize: '1.1rem' }}>⚠ Delete Account?</h3>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: 'var(--color-text)', lineHeight: 1.5 }}>
              This will permanently delete:
            </p>
            <ul style={{ margin: '0 0 1rem 1.25rem', padding: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
              <li>Your account and login</li>
              <li>All your characters</li>
              <li>All inventory, spells, and notes</li>
              <li>All retainers and mounts</li>
            </ul>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-danger)' }}>This cannot be undone.</p>
            {deleteError && <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--color-danger)' }}>⚠ {deleteError}</p>}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(''); }}
                disabled={deleting}
                style={{ flex: 1, padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '0.9rem', minHeight: '44px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                style={{ flex: 1, padding: '0.625rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-danger)', color: 'white', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '700', minHeight: '44px', opacity: deleting ? 0.7 : 1 }}
              >
                {deleting ? 'Deleting…' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
