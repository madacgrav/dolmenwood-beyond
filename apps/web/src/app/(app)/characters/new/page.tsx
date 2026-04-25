'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWizardStore } from '@/stores/wizard-store';

const MODES = [
  {
    id: 'auto' as const,
    title: 'Auto Create',
    tagline: 'Roll your fate. Choose your destiny.',
    description: 'Guided step-by-step with animated dice rolls, suggestions, and auto-calculated stats.',
    icon: '🎲',
    href: '/characters/new/auto',
  },
  {
    id: 'manual' as const,
    title: 'Manual Create',
    tagline: 'Forge every detail by hand.',
    description: 'Full control over every field. Dice rollers available for any value.',
    icon: '🖊',
    href: '/characters/new/manual',
  },
  {
    id: 'import' as const,
    title: 'Import Existing',
    tagline: 'Bring your paper character to life.',
    description: 'Paste or upload a JSON export from another sheet to import your character.',
    icon: '📋',
    href: '/characters/new/import',
  },
] as const;

export default function NewCharacterPage() {
  const router = useRouter();
  const { setMode, reset } = useWizardStore();

  function handleSelect(mode: 'auto' | 'manual', href: string) {
    reset();
    setMode(mode);
    router.push(href);
  }

  return (
    <div style={{
      minHeight: '100dvh',
      backgroundColor: 'var(--color-bg)',
      padding: '1.5rem 1rem',
      maxWidth: '500px',
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/characters" style={{
          color: 'var(--color-text-muted)', textDecoration: 'none',
          fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
        }}>
          ← Characters
        </Link>
        <h1 style={{
          fontFamily: 'var(--font-display), Georgia, serif',
          fontSize: '1.5rem', color: 'var(--color-text)',
          margin: '0.75rem 0 0.25rem',
        }}>
          New Character
        </h1>
        <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '0.9rem' }}>
          Choose how you want to create your adventurer.
        </p>
      </div>

      {/* Mode cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              if (m.id === 'import') { router.push(m.href); return; }
              handleSelect(m.id, m.href);
            }}
            style={{
              display: 'flex', gap: '1.25rem', alignItems: 'flex-start',
              padding: '1.25rem', borderRadius: '12px', textAlign: 'left',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer', width: '100%',
              transition: 'border-color 0.15s, transform 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
          >
            <div style={{
              fontSize: '2.5rem', flexShrink: 0,
              width: '56px', height: '56px',
              backgroundColor: 'var(--color-bg)',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {m.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: 'var(--font-display), Georgia, serif',
                fontSize: '1.1rem', fontWeight: '600',
                color: 'var(--color-text)', marginBottom: '0.2rem',
              }}>
                {m.title}
              </div>
              <div style={{
                fontSize: '0.8rem', color: 'var(--color-primary)',
                fontStyle: 'italic', marginBottom: '0.4rem',
              }}>
                {m.tagline}
              </div>
              <div style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                {m.description}
              </div>
            </div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '1.25rem', flexShrink: 0, alignSelf: 'center' }}>
              ›
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
