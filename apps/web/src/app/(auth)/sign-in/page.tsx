'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/characters');
      router.refresh();
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setForgotSent(true);
    }
  }

  async function handleGoogleSignIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <main style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      backgroundColor: 'var(--color-bg)',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{
            fontFamily: 'var(--font-cinzel), Georgia, serif',
            fontSize: '1.75rem',
            fontWeight: '700',
            color: 'var(--color-primary)',
            letterSpacing: '0.05em',
            margin: 0,
          }}>
            Dolmenwood Beyond
          </h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            {showForgot ? 'Reset your password' : 'Sign in to your account'}
          </p>
        </div>

        <div style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          padding: '1.5rem',
        }}>
          {error && (
            <div style={{
              backgroundColor: 'color-mix(in srgb, var(--color-danger) 15%, transparent)',
              border: '1px solid var(--color-danger)',
              borderRadius: '8px',
              padding: '0.75rem',
              marginBottom: '1rem',
              color: 'var(--color-danger)',
              fontSize: '0.875rem',
            }}>
              {error}
            </div>
          )}

          {forgotSent ? (
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <p style={{ color: 'var(--color-text)', marginBottom: '1rem' }}>
                Check your email for a password reset link.
              </p>
              <button
                onClick={() => { setShowForgot(false); setForgotSent(false); }}
                style={{ color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                Back to sign in
              </button>
            </div>
          ) : showForgot ? (
            <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} placeholder="you@example.com" />
              </div>
              <button type="submit" disabled={loading} style={primaryButtonStyle}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
              <button type="button" onClick={() => setShowForgot(false)} style={ghostButtonStyle}>
                Back to sign in
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} placeholder="you@example.com" autoComplete="email" />
                </div>
                <div>
                  <label style={labelStyle}>Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} placeholder="••••••••" autoComplete="current-password" />
                </div>
                <div style={{ textAlign: 'right', marginTop: '-0.5rem' }}>
                  <button type="button" onClick={() => setShowForgot(true)} style={{ color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: 0, minHeight: 'auto' }}>
                    Forgot password?
                  </button>
                </div>
                <button type="submit" disabled={loading} style={primaryButtonStyle}>
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
              </form>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1rem 0' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border)' }} />
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>or</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border)' }} />
              </div>

              <button onClick={handleGoogleSignIn} style={{ ...secondaryButtonStyle, width: '100%', gap: '0.5rem' }}>
                <GoogleIcon />
                Continue with Google
              </button>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.25rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          No account?{' '}
          <Link href="/sign-up" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: '600' }}>
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.875rem',
  fontWeight: '500',
  color: 'var(--color-text)',
  marginBottom: '0.375rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.625rem 0.75rem',
  backgroundColor: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: '8px',
  color: 'var(--color-text)',
  fontSize: '1rem',
  outline: 'none',
  boxSizing: 'border-box',
  minHeight: '44px',
};

const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  backgroundColor: 'var(--color-primary)',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '1rem',
  fontWeight: '600',
  cursor: 'pointer',
  minHeight: '44px',
};

const secondaryButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.75rem',
  backgroundColor: 'var(--color-bg)',
  color: 'var(--color-text)',
  border: '1px solid var(--color-border)',
  borderRadius: '8px',
  fontSize: '0.9rem',
  fontWeight: '500',
  cursor: 'pointer',
  minHeight: '44px',
};

const ghostButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem',
  backgroundColor: 'transparent',
  color: 'var(--color-text-muted)',
  border: 'none',
  borderRadius: '8px',
  fontSize: '0.9rem',
  cursor: 'pointer',
  minHeight: '44px',
};
