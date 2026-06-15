'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { createCharacter } from '@/lib/data/characters';
import type { Kindred, CharacterClass, Alignment, AbilityScores } from '@dolmenwood/types';

const VALID_KINDREDS: Kindred[] = ['Human', 'Breggle', 'Elf', 'Grimalkin', 'Mossling', 'Woodgrue'];
const VALID_CLASSES: CharacterClass[] = ['Bard', 'Cleric', 'Enchanter', 'Fighter', 'Friar', 'Hunter', 'Knight', 'Magician', 'Thief'];
const VALID_ALIGNMENTS: Alignment[] = ['lawful', 'neutral', 'chaotic'];
const ABILITY_KEYS: (keyof AbilityScores)[] = ['str', 'int', 'wis', 'dex', 'con', 'cha'];

interface ImportData {
  name: string;
  kindred: Kindred;
  characterClass: CharacterClass;
  alignment: Alignment;
  abilityScores: AbilityScores;
  hpMax: number;
  hpCurrent?: number;
  level?: number;
  xp?: number;
  sex?: string;
  age?: string;
  height?: string;
  weight?: string;
  background?: string;
  moonSign?: string;
}

function validateJson(raw: unknown): { data: ImportData | null; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { data: null, errors: ['JSON must be an object.'] };
  }
  const obj = raw as Record<string, unknown>;

  if (!obj.name || typeof obj.name !== 'string' || !obj.name.trim()) errors.push('name is required and must be a non-empty string.');
  if (!VALID_KINDREDS.includes(obj.kindred as Kindred)) errors.push(`kindred must be one of: ${VALID_KINDREDS.join(', ')}.`);
  if (!VALID_CLASSES.includes(obj.characterClass as CharacterClass)) errors.push(`characterClass must be one of: ${VALID_CLASSES.join(', ')}.`);
  if (!VALID_ALIGNMENTS.includes(obj.alignment as Alignment)) errors.push(`alignment must be one of: ${VALID_ALIGNMENTS.join(', ')}.`);

  if (!obj.abilityScores || typeof obj.abilityScores !== 'object' || Array.isArray(obj.abilityScores)) {
    errors.push('abilityScores must be an object with str, int, wis, dex, con, cha.');
  } else {
    const scores = obj.abilityScores as Record<string, unknown>;
    for (const key of ABILITY_KEYS) {
      const v = scores[key];
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 3 || v > 18) {
        errors.push(`abilityScores.${key} must be an integer between 3 and 18.`);
      }
    }
  }

  if (typeof obj.hpMax !== 'number' || !Number.isInteger(obj.hpMax) || obj.hpMax < 1) {
    errors.push('hpMax must be a positive integer.');
  }

  if (errors.length > 0) return { data: null, errors };

  const scores = obj.abilityScores as AbilityScores;
  return {
    data: {
      name: (obj.name as string).trim(),
      kindred: obj.kindred as Kindred,
      characterClass: obj.characterClass as CharacterClass,
      alignment: obj.alignment as Alignment,
      abilityScores: scores,
      hpMax: obj.hpMax as number,
      hpCurrent: typeof obj.hpCurrent === 'number' ? obj.hpCurrent : (obj.hpMax as number),
      level: typeof obj.level === 'number' && obj.level >= 1 ? Math.floor(obj.level) : 1,
      xp: typeof obj.xp === 'number' && obj.xp >= 0 ? Math.floor(obj.xp) : 0,
      sex: typeof obj.sex === 'string' ? obj.sex : undefined,
      age: typeof obj.age === 'string' ? obj.age : undefined,
      height: typeof obj.height === 'string' ? obj.height : undefined,
      weight: typeof obj.weight === 'string' ? obj.weight : undefined,
      background: typeof obj.background === 'string' ? obj.background : undefined,
      moonSign: typeof obj.moonSign === 'string' ? obj.moonSign : undefined,
    },
    errors: [],
  };
}

export default function ImportCharacterPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'upload' | 'paste'>('upload');
  const [pasteText, setPasteText] = useState('');
  const [fileName, setFileName] = useState('');
  const [validData, setValidData] = useState<ImportData | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  function parseAndValidate(text: string) {
    setErrors([]);
    setValidData(null);
    if (!text.trim()) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setErrors(['Invalid JSON — please check for missing commas, quotes, or brackets.']);
      return;
    }
    const { data, errors: errs } = validateJson(parsed);
    if (errs.length > 0) {
      setErrors(errs);
    } else {
      setValidData(data);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => parseAndValidate(ev.target?.result as string ?? '');
    reader.readAsText(file);
  }

  function handlePasteChange(text: string) {
    setPasteText(text);
    if (text.trim()) parseAndValidate(text);
    else { setErrors([]); setValidData(null); }
  }

  async function handleImport() {
    if (!validData) return;
    setSaving(true);
    setSaveError('');
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/sign-in'); return; }

    const { id, error } = await createCharacter(supabase, user.id, validData);

    setSaving(false);
    if (error) {
      setSaveError(error);
    } else if (id) {
      router.push(`/characters/${id}`);
    }
  }

  const isValid = validData !== null && errors.length === 0;

  return (
    <div style={{
      minHeight: '100dvh', backgroundColor: 'var(--color-bg)',
      padding: '1.5rem 1rem', maxWidth: '540px', margin: '0 auto',
    }}>
      {/* Back */}
      <Link href="/characters/new" style={{
        color: 'var(--color-text-muted)', textDecoration: 'none',
        fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
      }}>
        ← New Character
      </Link>

      {/* Header */}
      <div style={{ margin: '0.75rem 0 1.5rem' }}>
        <h1 style={{
          fontFamily: 'var(--font-display), Georgia, serif',
          fontSize: '1.5rem', color: 'var(--color-text)', margin: '0 0 0.25rem',
        }}>
          Import Character
        </h1>
        <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '0.875rem' }}>
          Upload or paste a character JSON file to import.
        </p>
      </div>

      {/* Download sample */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.875rem 1rem',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '10px', marginBottom: '1.25rem',
      }}>
        <span style={{ fontSize: '1.5rem' }}>📄</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text)', marginBottom: '0.15rem' }}>
            Need a template?
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Download the sample JSON, edit it, then upload.
          </div>
        </div>
        <a
          href="/sample-character.json"
          download="sample-character.json"
          style={{
            padding: '0.5rem 0.875rem',
            backgroundColor: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px', textDecoration: 'none',
            fontSize: '0.825rem', fontWeight: '600',
            color: 'var(--color-primary)', whiteSpace: 'nowrap',
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            minHeight: '44px',
          }}
        >
          ⬇ Download
        </a>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', borderRadius: '8px', overflow: 'hidden',
        border: '1px solid var(--color-border)', marginBottom: '1rem',
      }}>
        {(['upload', 'paste'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setErrors([]); setValidData(null); }}
            style={{
              flex: 1, padding: '0.625rem',
              border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600',
              backgroundColor: tab === t ? 'var(--color-primary)' : 'var(--color-surface)',
              color: tab === t ? 'white' : 'var(--color-text-muted)',
              minHeight: '44px',
            }}
          >
            {t === 'upload' ? '📁 Upload File' : '📋 Paste JSON'}
          </button>
        ))}
      </div>

      {/* Upload tab */}
      {tab === 'upload' && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              width: '100%', padding: '2rem 1rem',
              backgroundColor: 'var(--color-surface)',
              border: `2px dashed ${isValid ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: '10px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
            }}
          >
            <span style={{ fontSize: '2rem' }}>{fileName ? '✅' : '📂'}</span>
            <span style={{ fontSize: '0.875rem', color: fileName ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: '600' }}>
              {fileName || 'Click to browse for a JSON file'}
            </span>
            {!fileName && (
              <span style={{ fontSize: '0.775rem', color: 'var(--color-text-muted)' }}>
                .json files only
              </span>
            )}
          </button>
          {fileName && (
            <button
              onClick={() => { setFileName(''); setValidData(null); setErrors([]); if (fileRef.current) fileRef.current.value = ''; }}
              style={{
                marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)',
                background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem',
              }}
            >
              ✕ Clear
            </button>
          )}
        </div>
      )}

      {/* Paste tab */}
      {tab === 'paste' && (
        <textarea
          value={pasteText}
          onChange={e => handlePasteChange(e.target.value)}
          placeholder={'{\n  "name": "Aldric Thornwood",\n  "kindred": "Human",\n  ...\n}'}
          rows={12}
          style={{
            width: '100%', padding: '0.75rem', borderRadius: '8px',
            backgroundColor: 'var(--color-surface)',
            border: `1px solid ${errors.length > 0 ? 'var(--color-danger)' : isValid ? 'var(--color-primary)' : 'var(--color-border)'}`,
            color: 'var(--color-text)', fontFamily: 'monospace', fontSize: '0.8rem',
            resize: 'vertical', boxSizing: 'border-box', outline: 'none',
          }}
        />
      )}

      {/* Validation errors */}
      {errors.length > 0 && (
        <div style={{
          marginTop: '0.875rem', padding: '0.875rem',
          backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
          border: '1px solid var(--color-danger)',
          borderRadius: '8px',
        }}>
          <div style={{ fontSize: '0.825rem', fontWeight: '700', color: 'var(--color-danger)', marginBottom: '0.4rem' }}>
            ⚠ Validation errors:
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {errors.map((e, i) => (
              <li key={i} style={{ fontSize: '0.8rem', color: 'var(--color-danger)' }}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Valid preview */}
      {isValid && validData && (
        <div style={{
          marginTop: '0.875rem', padding: '0.875rem',
          backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
          border: '1px solid var(--color-primary)',
          borderRadius: '8px',
        }}>
          <div style={{ fontSize: '0.825rem', fontWeight: '700', color: 'var(--color-primary)', marginBottom: '0.4rem' }}>
            ✓ Ready to import
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text)' }}>
            <strong>{validData.name}</strong> · {validData.kindred} {validData.characterClass} · Level {validData.level ?? 1} · {validData.hpMax} HP
          </div>
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div style={{
          marginTop: '0.875rem', padding: '0.75rem',
          backgroundColor: 'color-mix(in srgb, var(--color-danger) 15%, transparent)',
          border: '1px solid var(--color-danger)', borderRadius: '8px',
          fontSize: '0.875rem', color: 'var(--color-danger)',
        }}>
          Failed to save: {saveError}
        </div>
      )}

      {/* Import button */}
      <button
        onClick={handleImport}
        disabled={!isValid || saving}
        style={{
          marginTop: '1.25rem', width: '100%', padding: '0.875rem',
          backgroundColor: 'var(--color-primary)', color: 'white',
          border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600',
          cursor: !isValid || saving ? 'not-allowed' : 'pointer',
          opacity: !isValid || saving ? 0.55 : 1, minHeight: '44px',
        }}
      >
        {saving ? 'Importing…' : 'Import Character →'}
      </button>
    </div>
  );
}

