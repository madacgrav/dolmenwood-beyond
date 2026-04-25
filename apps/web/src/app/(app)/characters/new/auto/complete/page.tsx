'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWizardStore } from '@/stores/wizard-store';
import { createClient } from '@/lib/supabase/client';

export default function CharacterCompletePage() {
  const router = useRouter();
  const wizard = useWizardStore();
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(true);
  const savedRef = useRef(false);

  useEffect(() => {
    if (savedRef.current) return;
    savedRef.current = true;

    async function save() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/sign-in'); return; }

      const { data, error: insertError } = await supabase.from('characters').insert({
        owner_id: user.id,
        name: wizard.name,
        sex: wizard.sex || null,
        age: wizard.age || null,
        height: wizard.height || null,
        weight: wizard.weight || null,
        kindred: wizard.kindred ?? 'Human',
        character_class: wizard.characterClass ?? 'Fighter',
        alignment: wizard.alignment ?? 'neutral',
        background: wizard.background || null,
        level: 1,
        xp: 0,
        ability_scores: wizard.abilityScores,
        hp_current: wizard.hpMax,
        hp_max: wizard.hpMax,
        portrait_url: wizard.portraitUrl,
        is_active: true,
      }).select('id').single();

      setSaving(false);

      if (insertError) {
        setError(insertError.message);
      } else if (data) {
        setCharacterId(data.id as string);
        wizard.reset();
      }
    }

    save();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (saving) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'var(--color-bg)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'pulse 1.5s ease infinite' }}>⚔️</div>
          <div style={{ color: 'var(--color-text-muted)' }}>Creating your adventurer…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'var(--color-bg)', padding: '1.5rem',
      }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
          <p style={{ color: 'var(--color-danger)', marginBottom: '1.5rem' }}>
            Failed to save character: {error}
          </p>
          <button
            onClick={() => router.back()}
            style={primaryBtn}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100dvh', backgroundColor: 'var(--color-bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '2rem', textAlign: 'center',
    }}>
      <div style={{ fontSize: '5rem', marginBottom: '1rem', animation: 'celebrationBounce 0.7s ease both' }}>
        ⚔️
      </div>
      <h1 style={{
        fontFamily: 'var(--font-display), Georgia, serif',
        fontSize: '2rem', color: 'var(--color-primary)', margin: '0 0 0.5rem',
      }}>
        Adventure Awaits!
      </h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '0.5rem', fontSize: '1rem' }}>
        Your character is ready.
      </p>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem', fontSize: '0.875rem' }}>
        May fortune favour the bold.
      </p>
      <button
        onClick={() => { if (characterId) router.push(`/characters/${characterId}`); }}
        disabled={!characterId}
        style={{ ...primaryBtn, padding: '1rem 2.5rem', fontSize: '1.1rem', minHeight: '54px', borderRadius: '10px' }}>
        Begin Adventure →
      </button>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '0.875rem 1.5rem', backgroundColor: 'var(--color-primary)', color: 'white',
  border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '700',
  cursor: 'pointer', minHeight: '44px',
};
