'use client';
import { useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { CharacterWithNotes } from '@dolmenwood/types';
import { getXPThresholdForNextLevel, getPrimeAbilities, getXPModifier, getKindredXPBonus, applyXPModifiers } from '@dolmenwood/rules-engine';
import { createClient } from '@/lib/supabase/client';

interface Props {
  character: CharacterWithNotes;
  editMode: boolean;
  onToggleEdit: () => void;
  onUpdate: (updates: Partial<CharacterWithNotes>) => void | Promise<void>;
  onBack: () => void;
  readOnly?: boolean;
}

export function CharacterSheetHeader({ character, editMode, onToggleEdit, onUpdate, onBack, readOnly = false }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [hpEditOpen, setHpEditOpen] = useState(false);
  const [hpInputVal, setHpInputVal] = useState('');
  const [xpEditOpen, setXpEditOpen] = useState(false);
  const [xpInputVal, setXpInputVal] = useState('');
  const [portraitUrl, setPortraitUrl] = useState<string | null>(character.portraitUrl ?? null);
  const [portraitUploading, setPortraitUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const nextLevelXP = getXPThresholdForNextLevel(character.characterClass, character.level);
  const xpPct = nextLevelXP > 0 ? Math.min(1, character.xp / nextLevelXP) : 1;

  const hpPct = character.hpMax > 0 ? Math.max(0, Math.min(1, character.hpCurrent / character.hpMax)) : 0;
  const hpColor = hpPct > 0.66 ? 'var(--color-primary)' : hpPct > 0.33 ? 'var(--color-gold)' : 'var(--color-danger)';

  const initials = character.name.charAt(0).toUpperCase();

  function adjustHP(delta: number) {
    const newHP = Math.max(0, Math.min(character.hpMax, character.hpCurrent + delta));
    onUpdate({ hpCurrent: newHP });
  }

  function commitHpInput() {
    const val = parseInt(hpInputVal, 10);
    if (!isNaN(val)) onUpdate({ hpCurrent: Math.max(0, Math.min(character.hpMax, val)) });
    setHpInputVal('');
    setHpEditOpen(false);
  }

  function commitXPInput() {
    const val = parseInt(xpInputVal, 10);
    if (!isNaN(val) && val !== 0) {
      const gain = val > 0
        ? applyXPModifiers(val, character.characterClass, character.abilityScores as unknown as Record<string, number>, character.kindred)
        : val;
      onUpdate({ xp: Math.max(0, character.xp + gain) });
    }
    setXpInputVal('');
    setXpEditOpen(false);
  }

  async function handlePortraitSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError('Only JPEG, PNG, WebP, and GIF images are allowed.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setUploadError('Image must be smaller than 5 MB.');
      return;
    }
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png',
      'image/webp': 'webp', 'image/gif': 'gif',
    };
    const ext = extMap[file.type] ?? 'jpg';

    setUploadError('');
    setPortraitUploading(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setUploadError('Could not verify user session. Please sign in again.');
        return;
      }
      const user = userData.user;
      const path = `${user.id}/${character.id}/${Date.now()}.${ext}`;
      const { error: storageError } = await supabase.storage
        .from('portraits')
        .upload(path, file, { upsert: true });
      if (storageError) {
        console.error('Portrait upload failed:', storageError.message);
        setUploadError('Upload failed: ' + storageError.message);
        return;
      }
      const { data: urlData } = supabase.storage.from('portraits').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      await supabase.from('characters').update({ portrait_url: publicUrl }).eq('id', character.id);
      setPortraitUrl(publicUrl);
      await onUpdate({ portraitUrl: publicUrl });
    } finally {
      setPortraitUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const primes = getPrimeAbilities(character.characterClass);
  const primeScores = primes.map(p => character.abilityScores[p.toLowerCase() as keyof typeof character.abilityScores] ?? 0);
  const xpMod = getXPModifier(primeScores);
  const kindredXpBonus = getKindredXPBonus(character.kindred);
  const totalXpMod = xpMod + kindredXpBonus;

  return (
    <div style={{
      backgroundColor: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      padding: '0.875rem 1rem 1rem',
    }}>
      {/* Top row: back + edit */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-muted)', fontSize: '1.1rem',
            padding: '0.25rem 0.5rem', borderRadius: '6px',
            minHeight: '44px',
          }}
          aria-label="Back to characters"
        >
          ← Back
        </button>
        {readOnly ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            fontSize: '0.78rem', fontWeight: '600',
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '0.375rem 0.75rem',
            backgroundColor: 'var(--color-surface)',
          }}>
            👁 Read-Only View
          </span>
        ) : (
          <button
            onClick={onToggleEdit}
            style={{
              background: editMode ? 'var(--color-primary)' : 'none',
              border: editMode ? 'none' : '1px solid var(--color-border)',
              borderRadius: '8px', cursor: 'pointer',
              color: editMode ? 'white' : 'var(--color-text-muted)',
              fontSize: '0.85rem', padding: '0.375rem 0.75rem',
              minHeight: '44px', display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
            }}
          >
            {editMode ? '✓ Done' : '✏️ Edit'}
          </button>
        )}
      </div>

      {/* Portrait + name row */}
      <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start', position: 'relative' }}>
        {/* Tappable portrait with upload */}
        <button
          onClick={() => { if (!readOnly) fileInputRef.current?.click(); }}
          disabled={portraitUploading || readOnly}
          aria-label={readOnly ? 'Character portrait' : 'Upload portrait photo'}
          style={{
            position: 'relative',
            width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
            backgroundColor: 'var(--color-primary)',
            backgroundImage: portraitUrl ? `url(${portraitUrl})` : undefined,
            backgroundSize: 'cover', backgroundPosition: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white',
            fontFamily: 'var(--font-display), Georgia, serif',
            fontSize: '1.75rem', fontWeight: '700',
            border: readOnly ? '2px solid transparent' : '2px solid var(--color-border)',
            cursor: readOnly ? 'default' : 'pointer',
            overflow: 'hidden',
            padding: 0,
          }}
        >
          {!portraitUrl && !portraitUploading && initials}
          {portraitUploading && (
            <div style={{
              position: 'absolute', inset: 0,
              backgroundColor: 'rgba(0,0,0,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '50%',
            }}>
              <svg
                width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="white" strokeWidth="2.5" strokeLinecap="round"
                style={{ animation: 'spin 0.8s linear infinite' }}
              >
                <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                <path d="M12 2 a10 10 0 0 1 10 10" />
              </svg>
            </div>
          )}
          {!portraitUrl && !portraitUploading && !readOnly && (
            <div style={{
              position: 'absolute', bottom: 0, right: 0,
              width: '20px', height: '20px',
              backgroundColor: 'var(--color-bg)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', border: '1px solid var(--color-border)',
            }}>
              📷
            </div>
          )}
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handlePortraitSelect}
        />

        {/* Upload error message */}
        {uploadError && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '0.25rem',
            fontSize: '0.75rem',
            color: 'var(--color-danger)',
            backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, var(--color-bg))',
            border: '1px solid var(--color-danger)',
            borderRadius: '6px',
            padding: '0.25rem 0.5rem',
          }}>
            {uploadError}
          </div>
        )}

        {/* Name + bars */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{
            margin: 0, fontSize: '1.2rem', fontWeight: '700',
            fontFamily: 'var(--font-display), Georgia, serif',
            color: 'var(--color-text)',
          }}>
            {character.name}
          </h2>
          <p style={{ margin: '0.125rem 0 0.625rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {character.kindred} {character.characterClass} · Level {character.level}
          </p>

          {/* HP bar */}
          <div
            style={{ cursor: readOnly ? 'default' : 'pointer', marginBottom: '0.5rem' }}
            onClick={() => { if (!readOnly) { setHpEditOpen(o => !o); setXpEditOpen(false); } }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
              <span style={{ color: hpColor, fontWeight: '600' }}>
                ❤️ {character.hpCurrent} / {character.hpMax} HP
              </span>
              {!readOnly && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>tap to edit</span>}
            </div>
            <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--color-border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${hpPct * 100}%`, backgroundColor: hpColor, borderRadius: '4px', transition: 'width 0.3s, background-color 0.3s' }} />
            </div>
          </div>

          {/* HP edit controls */}
          {!readOnly && hpEditOpen && (
            <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              {([-5, -1, 1, 5] as const).map(d => (
                <button
                  key={d}
                  onClick={() => adjustHP(d)}
                  style={{
                    padding: '0.25rem 0.625rem', borderRadius: '6px', border: '1px solid var(--color-border)',
                    backgroundColor: d < 0 ? 'color-mix(in srgb, var(--color-danger) 15%, var(--color-bg))' : 'color-mix(in srgb, var(--color-primary) 15%, var(--color-bg))',
                    color: d < 0 ? 'var(--color-danger)' : 'var(--color-primary)',
                    cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', minHeight: '44px',
                  }}
                >
                  {d > 0 ? `+${d}` : d}
                </button>
              ))}
              <input
                type="number"
                placeholder="set HP"
                value={hpInputVal}
                onChange={e => setHpInputVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && commitHpInput()}
                style={{
                  width: '70px', padding: '0.25rem 0.5rem', borderRadius: '6px',
                  border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
                  color: 'var(--color-text)', fontSize: '0.85rem', minHeight: '44px',
                }}
              />
              <button
                onClick={commitHpInput}
                style={{ padding: '0.25rem 0.625rem', borderRadius: '6px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.85rem', minHeight: '44px' }}
              >
                ✓
              </button>
            </div>
          )}

          {/* XP bar */}
          <div
            style={{ cursor: readOnly ? 'default' : 'pointer' }}
            onClick={() => { if (!readOnly) { setXpEditOpen(o => !o); setHpEditOpen(false); } }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '3px' }}>
              <span style={{ color: 'var(--color-gold)', fontWeight: '600' }}>
                ✨ {character.xp.toLocaleString()} XP {nextLevelXP > 0 ? `/ ${nextLevelXP.toLocaleString()}` : '(max level)'}
              </span>
              {totalXpMod !== 0 && (
                <span style={{ color: totalXpMod > 0 ? 'var(--color-primary)' : 'var(--color-danger)', fontSize: '0.65rem' }}>
                  {totalXpMod > 0 ? `+${totalXpMod}%` : `${totalXpMod}%`} XP mod
                </span>
              )}
            </div>
            <div style={{ height: '5px', borderRadius: '3px', backgroundColor: 'var(--color-border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${xpPct * 100}%`, backgroundColor: 'var(--color-gold)', borderRadius: '3px', transition: 'width 0.3s' }} />
            </div>
          </div>

          {/* XP edit */}
          {!readOnly && xpEditOpen && (() => {
            const inputVal = parseInt(xpInputVal, 10);
            const isPositive = !isNaN(inputVal) && inputVal > 0;
            const isNegative = !isNaN(inputVal) && inputVal < 0;
            const previewGain = isPositive && totalXpMod !== 0
              ? Math.round(inputVal * (1 + totalXpMod / 100))
              : inputVal || 0;
            const showPreview = !isNaN(inputVal) && inputVal !== 0 && isPositive && totalXpMod !== 0;
            return (
              <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {isNegative ? 'Correct XP:' : 'Add XP:'}
                  </span>
                  <input
                    type="number"
                    placeholder="e.g. 250"
                    value={xpInputVal}
                    onChange={e => setXpInputVal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && commitXPInput()}
                    style={{
                      width: '90px', padding: '0.25rem 0.5rem', borderRadius: '6px',
                      border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
                      color: 'var(--color-text)', fontSize: '0.85rem', minHeight: '44px',
                    }}
                  />
                  <button
                    onClick={commitXPInput}
                    style={{ padding: '0.25rem 0.75rem', borderRadius: '6px', backgroundColor: 'var(--color-gold)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', minHeight: '44px' }}
                  >
                    {isNegative ? '−XP' : '+XP'}
                  </button>
                </div>
                {showPreview && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', paddingLeft: '0.25rem' }}>
                    {inputVal} base → <span style={{ color: 'var(--color-gold)' }}>+{previewGain} actual</span>
                    {' '}({totalXpMod > 0 ? '+' : ''}{totalXpMod}% mod)
                  </div>
                )}
              </div>
            );
          })()}

          {/* Level Up button */}
          {!readOnly && nextLevelXP > 0 && character.xp >= nextLevelXP && (
            <button
              onClick={() => router.push(`/characters/${character.id}/level-up`)}
              style={{
                marginTop: '0.5rem',
                width: '100%',
                padding: '0.4rem 0.75rem',
                borderRadius: '8px',
                border: '2px solid var(--color-gold)',
                backgroundColor: 'color-mix(in srgb, var(--color-gold) 15%, var(--color-bg))',
                color: 'var(--color-gold)',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer',
                minHeight: '44px',
                animation: 'levelUpPulse 1.5s ease-in-out infinite',
              }}
            >
              ⬆ Level Up!
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
