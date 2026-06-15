'use client';
import type { RefObject } from 'react';

interface Props {
  initials: string;
  portraitUrl: string | null;
  portraitUploading: boolean;
  uploadError: string;
  readOnly: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function PortraitButton({ initials, portraitUrl, portraitUploading, uploadError, readOnly, fileInputRef, onSelect }: Props) {
  return (
    <>
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
        onChange={onSelect}
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
    </>
  );
}
