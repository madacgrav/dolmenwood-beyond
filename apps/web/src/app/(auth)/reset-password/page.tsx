'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!token) {
      setError('Missing reset token — use the link from your email.');
      return;
    }
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/reset-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? 'Password reset failed.');
    } else {
      router.push('/sign-in?message=password_updated');
    }
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', backgroundColor: 'var(--color-bg)' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: 'var(--font-cinzel), Georgia, serif', fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-primary)', letterSpacing: '0.05em', margin: 0 }}>
            Dolmenwood Beyond
          </h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Choose a new password
          </p>
        </div>

        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '1.5rem' }}>
          {error && (
            <div style={{ backgroundColor: 'color-mix(in srgb, var(--color-danger) 15%, transparent)', border: '1px solid var(--color-danger)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', color: 'var(--color-danger)', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text)', marginBottom: '0.375rem' }}>New Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="new-password"
                style={{ width: '100%', padding: '0.625rem 0.75rem', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text)', fontSize: '1rem', outline: 'none', boxSizing: 'border-box', minHeight: '44px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text)', marginBottom: '0.375rem' }}>Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="new-password"
                style={{ width: '100%', padding: '0.625rem 0.75rem', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text)', fontSize: '1rem', outline: 'none', boxSizing: 'border-box', minHeight: '44px' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', minHeight: '44px', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
