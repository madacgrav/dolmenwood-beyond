'use client';

export function CelebrationOverlay({
  newLevel,
  characterName,
}: {
  newLevel: number;
  characterName: string;
}) {
  return (
    <div style={{
      minHeight: '100dvh', backgroundColor: 'var(--color-bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '1rem', padding: '2rem',
    }}>
      <div style={{
        fontSize: '5rem',
        animation: 'celebrationBounce 0.6s ease-out forwards',
      }}>
        🏆
      </div>
      <h2 style={{
        margin: 0, textAlign: 'center',
        fontFamily: 'var(--font-display), Georgia, serif',
        fontSize: '1.5rem', fontWeight: '700',
        color: 'var(--color-gold)',
      }}>
        Level {newLevel} Achieved!
      </h2>
      <p style={{ margin: 0, color: 'var(--color-text-muted)', textAlign: 'center' }}>
        {characterName} has advanced. Returning to character sheet…
      </p>
    </div>
  );
}
