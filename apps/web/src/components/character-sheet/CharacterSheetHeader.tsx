'use client';
import { useState } from 'react';
import { PortraitButton } from './header/PortraitButton';
import { HPBar } from './header/HPBar';
import { XPBar } from './header/XPBar';
import { usePortraitUpload } from './header/use-portrait-upload';
import type { CharacterSheetHeaderProps as Props } from './header/types';

export function CharacterSheetHeader({ character, onUpdate, onAdjustXP, xpVariant, onCorrectXP, readOnly = false, variant = 'full' }: Props) {
  const [hpEditOpen, setHpEditOpen] = useState(false);
  const [xpEditOpen, setXpEditOpen] = useState(false);
  const { portraitUrl, portraitUploading, uploadError, fileInputRef, handlePortraitSelect } =
    usePortraitUpload(character, onUpdate);

  const initials = character.name.charAt(0).toUpperCase();
  const compact = variant === 'compact';

  return (
    <div style={{
      background: 'linear-gradient(var(--color-sheet-surface), var(--color-sheet-surface-deep))',
      borderBottom: '1px solid var(--color-border)',
      padding: compact ? '0.625rem 1rem 0.75rem' : '1rem 1rem 1.125rem',
    }}>
      {/* Portrait + name row */}
      <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start', position: 'relative' }}>
        <PortraitButton
          initials={initials}
          portraitUrl={portraitUrl}
          portraitUploading={portraitUploading}
          uploadError={uploadError}
          readOnly={readOnly || compact}
          fileInputRef={fileInputRef}
          onSelect={handlePortraitSelect}
          size={compact ? 44 : 64}
        />

        {/* Name + bars */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{
            margin: 0,
            fontSize: compact ? '1rem' : '1.35rem',
            fontWeight: '700',
            fontFamily: 'var(--font-display), Georgia, serif',
            color: 'var(--color-text)',
            lineHeight: 1.2,
          }}>
            {character.name}
          </h2>
          <p style={{ margin: '0.125rem 0 0.625rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {character.kindred} {character.characterClass} · Level {character.level}
          </p>

          {!compact && (character.alignment || character.moonSign || character.background) && (
            <div style={{ margin: '-0.375rem 0 0.625rem', fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.75rem' }}>
              {character.alignment && <span><strong style={{ fontWeight: 600 }}>Alignment:</strong> {character.alignment}</span>}
              {character.moonSign && <span><strong style={{ fontWeight: 600 }}>Moon Sign:</strong> {character.moonSign}</span>}
              {character.background && <span><strong style={{ fontWeight: 600 }}>Background:</strong> {character.background}</span>}
            </div>
          )}

          <HPBar
            character={character}
            readOnly={readOnly}
            hpEditOpen={hpEditOpen}
            onToggle={() => { setHpEditOpen(o => !o); setXpEditOpen(false); }}
            onUpdate={onUpdate}
          />

          {!compact && (
            <XPBar
              character={character}
              readOnly={readOnly}
              xpEditOpen={xpEditOpen}
              onToggle={() => { setXpEditOpen(o => !o); setHpEditOpen(false); }}
              onAdjustXP={onAdjustXP}
              variant={xpVariant}
              onCorrectXP={onCorrectXP}
            />
          )}
        </div>
      </div>
    </div>
  );
}
