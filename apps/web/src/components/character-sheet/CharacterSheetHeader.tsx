'use client';
import { useState } from 'react';
import { HeaderTopBar } from './header/HeaderTopBar';
import { PortraitButton } from './header/PortraitButton';
import { HPBar } from './header/HPBar';
import { XPBar } from './header/XPBar';
import { usePortraitUpload } from './header/use-portrait-upload';
import type { CharacterSheetHeaderProps as Props } from './header/types';

export function CharacterSheetHeader({ character, editMode, onToggleEdit, onUpdate, onBack, onDelete, readOnly = false }: Props) {
  const [hpEditOpen, setHpEditOpen] = useState(false);
  const [xpEditOpen, setXpEditOpen] = useState(false);
  const { portraitUrl, portraitUploading, uploadError, fileInputRef, handlePortraitSelect } =
    usePortraitUpload(character, onUpdate);

  const initials = character.name.charAt(0).toUpperCase();

  return (
    <div style={{
      backgroundColor: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      padding: '0.875rem 1rem 1rem',
    }}>
      {/* Top row: back + edit */}
      <HeaderTopBar
        characterId={character.id}
        editMode={editMode}
        readOnly={readOnly}
        onToggleEdit={onToggleEdit}
        onBack={onBack}
        onDelete={onDelete}
      />

      {/* Portrait + name row */}
      <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start', position: 'relative' }}>
        <PortraitButton
          initials={initials}
          portraitUrl={portraitUrl}
          portraitUploading={portraitUploading}
          uploadError={uploadError}
          readOnly={readOnly}
          fileInputRef={fileInputRef}
          onSelect={handlePortraitSelect}
        />

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

          <HPBar
            character={character}
            readOnly={readOnly}
            hpEditOpen={hpEditOpen}
            onToggle={() => { setHpEditOpen(o => !o); setXpEditOpen(false); }}
            onUpdate={onUpdate}
          />

          <XPBar
            character={character}
            readOnly={readOnly}
            xpEditOpen={xpEditOpen}
            onToggle={() => { setXpEditOpen(o => !o); setHpEditOpen(false); }}
            onUpdate={onUpdate}
          />
        </div>
      </div>
    </div>
  );
}
