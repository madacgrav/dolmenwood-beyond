'use client';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: 'var(--color-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
      <h2
        style={{
          fontFamily: 'var(--font-display), Georgia, serif',
          color: 'var(--color-primary)',
          marginBottom: '0.5rem',
        }}
      >
        Something went wrong
      </h2>
      <p
        style={{
          color: 'var(--color-text-muted)',
          marginBottom: '1.5rem',
          maxWidth: '320px',
        }}
      >
        {error.message ?? 'An unexpected error occurred.'}
      </p>
      <button
        onClick={reset}
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: 'var(--color-primary)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '1rem',
          minHeight: '44px',
        }}
      >
        Try Again
      </button>
    </div>
  );
}
