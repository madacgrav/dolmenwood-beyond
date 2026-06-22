'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWizardStore } from '@/stores/wizard-store';
import { WizardProgress } from '@/components/wizard/WizardProgress';
import nameTablesData from '@dolmenwood/rules-engine/src/data/name-tables.json';

type NameEntry = {
  male?: string[];
  female?: string[];
  unisex?: string[];
  forenames?: string[];
  names?: string[];
  [key: string]: unknown;
};

const NAME_TABLES = nameTablesData as Record<string, NameEntry>;

function rollName(kindred: string | null): string {
  const table = NAME_TABLES[kindred ?? 'Human'];
  if (!table) return '';
  const pool = [
    ...(table.names ?? []),
    ...(table.forenames ?? []),
    ...(table.male ?? []),
    ...(table.female ?? []),
    ...(table.unisex ?? []),
  ];
  if (pool.length === 0) return '';
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx] ?? '';
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: '500',
  color: 'var(--color-text)', marginBottom: '0.375rem',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.625rem 0.75rem', backgroundColor: 'var(--color-bg)',
  border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text)',
  fontSize: '1rem', outline: 'none', boxSizing: 'border-box', minHeight: '44px',
};

export function Step13Details({ basePath = '/characters/new/auto' }: { basePath?: string }) {
  const router = useRouter();
  const {
    name, sex, age, height, weight, background, kindred,
    setName, setSex, setAge, setHeight, setWeight, setBackground,
  } = useWizardStore();
  const [nameError, setNameError] = useState(false);

  function handleRollName() {
    const rolled = rollName(kindred);
    if (rolled) setName(rolled);
  }

  function handleContinue() {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    router.push(`${basePath}/complete`);
  }

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100dvh', paddingBottom: '2rem' }}>
      <WizardProgress step={13} totalSteps={13} title="Name & Details"
        onBack={() => router.push(`${basePath}/12`)} />
      <div style={{ padding: '1rem', maxWidth: '500px', margin: '0 auto' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Almost there! Give your adventurer a name and any final details.
        </p>

        {/* Name */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>
            Name <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setNameError(false); }}
              placeholder="Enter name…"
              style={{ ...inputStyle, flex: 1, borderColor: nameError ? 'var(--color-danger)' : 'var(--color-border)' }}
            />
            <button
              onClick={handleRollName}
              type="button"
              style={{
                padding: '0 1rem', backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)', borderRadius: '8px',
                cursor: 'pointer', color: 'var(--color-text)', fontSize: '0.875rem',
                flexShrink: 0, minHeight: '44px', whiteSpace: 'nowrap',
              }}>
              🎲 Roll
            </button>
          </div>
          {nameError && (
            <div style={{ color: 'var(--color-danger)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              Please enter a name.
            </div>
          )}
        </div>

        {/* Sex */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>
            Sex <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            value={sex}
            onChange={e => setSex(e.target.value)}
            placeholder="Free text…"
            style={inputStyle}
          />
        </div>

        {/* Age / Height / Weight */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.625rem', marginBottom: '1rem' }}>
          {[
            { label: 'Age', value: age, setter: setAge, placeholder: 'e.g. 24' },
            { label: 'Height', value: height, setter: setHeight, placeholder: "5'8\"" },
            { label: 'Weight', value: weight, setter: setWeight, placeholder: '160 lbs' },
          ].map(({ label, value, setter, placeholder }) => (
            <div key={label}>
              <label style={{ ...labelStyle, fontSize: '0.75rem' }}>
                {label} <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(opt)</span>
              </label>
              <input
                value={value}
                onChange={e => setter(e.target.value)}
                placeholder={placeholder}
                style={{ ...inputStyle, fontSize: '0.875rem', padding: '0.5rem 0.625rem' }}
              />
            </div>
          ))}
        </div>

        {/* Background */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={labelStyle}>
            Background <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            value={background}
            onChange={e => setBackground(e.target.value)}
            placeholder="Your character's history, occupation, or origin…"
            rows={3}
            style={{
              ...inputStyle, resize: 'vertical', lineHeight: 1.5,
              padding: '0.625rem 0.75rem', minHeight: 'unset',
            }}
          />
        </div>

        <button
          onClick={handleContinue}
          style={{
            ...primaryBtn,
            opacity: !name.trim() ? 0.6 : 1,
            cursor: !name.trim() ? 'not-allowed' : 'pointer',
          }}>
          Complete Character →
        </button>
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  width: '100%', padding: '0.875rem', backgroundColor: 'var(--color-primary)', color: 'white',
  border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', minHeight: '44px',
};
