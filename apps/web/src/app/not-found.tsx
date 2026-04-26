import Link from 'next/link';

export default function NotFound() {
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
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗺️</div>
      <h1
        style={{
          fontFamily: 'var(--font-display), Georgia, serif',
          color: 'var(--color-primary)',
          fontSize: '2rem',
          marginBottom: '0.5rem',
        }}
      >
        Lost in the Wood
      </h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
        This page doesn&apos;t exist.
      </p>
      <Link
        href="/characters"
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: 'var(--color-primary)',
          color: 'white',
          borderRadius: '8px',
          textDecoration: 'none',
          fontSize: '1rem',
          minHeight: '44px',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        Return to Characters
      </Link>
    </div>
  );
}
