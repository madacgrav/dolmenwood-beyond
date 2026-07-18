'use client';
import { useEffect, useState, type CSSProperties } from 'react';

interface Props {
  value: number | null;
  onCommit: (n: number | null) => void;
  allowDecimal?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  style?: CSSProperties;
  autoFocus?: boolean;
  'aria-label'?: string;
}

/**
 * Numeric input that starts blank and allows a transient empty draft while
 * typing. Commits the parsed (and min/max-clamped) number on blur/Enter;
 * an empty draft commits null so callers choose their own default.
 */
export function NumberField({ value, onCommit, allowDecimal = false, min, max, placeholder, style, autoFocus, ...aria }: Props) {
  const [draft, setDraft] = useState(value == null ? '' : String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value == null ? '' : String(value));
  }, [value, editing]);

  const clean = (s: string) =>
    allowDecimal
      ? s.replace(/[^0-9.]/g, '').replace(/^([^.]*\.)(.*)$/, (_, head, tail) => head + tail.replace(/\./g, ''))
      : s.replace(/[^0-9]/g, '');

  function commit() {
    setEditing(false);
    if (draft.trim() === '') return onCommit(null);
    let n = allowDecimal ? parseFloat(draft) : parseInt(draft, 10);
    if (Number.isNaN(n)) return onCommit(null);
    if (min != null) n = Math.max(min, n);
    if (max != null) n = Math.min(max, n);
    onCommit(n);
  }

  return (
    <input
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      pattern={allowDecimal ? '[0-9.]*' : '[0-9]*'}
      value={draft}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onFocus={() => setEditing(true)}
      onChange={e => { setEditing(true); setDraft(clean(e.target.value)); }}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      style={style}
      {...aria}
    />
  );
}
