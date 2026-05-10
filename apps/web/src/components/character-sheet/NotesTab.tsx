'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import type { Character, SessionNote, PersonOfNote, CharacterWithNotes } from '@dolmenwood/types';

type SaveStatus = 'idle' | 'saving' | 'saved';

interface Props {
  character: CharacterWithNotes;
  onUpdate: (updates: Partial<CharacterWithNotes>) => void;
  readOnly?: boolean;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── General Notes ─────────────────────────────────────────────────────────────
function GeneralNotes({ character, onUpdate, readOnly }: { character: CharacterWithNotes; onUpdate: Props['onUpdate']; readOnly?: boolean }) {
  const [text, setText] = useState(character.notes ?? '');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setText(character.notes ?? ''); }, [character.notes]);

  const triggerSave = useCallback((value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveStatus('saving');
    timerRef.current = setTimeout(async () => {
      await onUpdate({ notes: value });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 1000);
  }, [onUpdate]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>General Notes</h3>
        <span style={{ fontSize: '0.75rem', color: saveStatus === 'saved' ? 'var(--color-primary)' : saveStatus === 'saving' ? 'var(--color-gold)' : 'transparent', transition: 'color 0.3s' }}>
          {saveStatus === 'saved' ? 'Saved ✓' : saveStatus === 'saving' ? 'Saving…' : '·'}
        </span>
      </div>
      <textarea
        value={text}
        onChange={e => { if (!readOnly) { setText(e.target.value); triggerSave(e.target.value); } }}
        readOnly={readOnly}
        placeholder="Adventure notes, quest reminders, NPC names…"
        style={{ width: '100%', minHeight: '200px', padding: '0.875rem', borderRadius: '10px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.9rem', lineHeight: 1.6, resize: readOnly ? 'none' : 'vertical', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
      />
    </div>
  );
}

// ── Session Notes ─────────────────────────────────────────────────────────────
function SessionNotes({ character, onUpdate, readOnly }: { character: CharacterWithNotes; onUpdate: Props['onUpdate']; readOnly?: boolean }) {
  const notes = character.sessionNotes ?? [];
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    if (!newText.trim()) return;
    const entry: SessionNote = {
      id: generateId(),
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      text: newText.trim(),
    };
    const updated = [entry, ...notes];
    await onUpdate({ sessionNotes: updated });
    setNewText('');
    setAdding(false);
  }

  async function handleDelete(id: string) {
    await onUpdate({ sessionNotes: notes.filter(n => n.id !== id) });
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Session Notes</h3>
        {!readOnly && (
          <button onClick={() => setAdding(a => !a)} style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', minHeight: '44px' }}>
            {adding ? 'Cancel' : '+ New Session'}
          </button>
        )}
      </div>

      {!readOnly && adding && (
        <div style={{ marginBottom: '1rem', padding: '0.875rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
          <textarea
            value={newText}
            onChange={e => setNewText(e.target.value)}
            placeholder="What happened this session?"
            autoFocus
            style={{ width: '100%', minHeight: '120px', padding: '0.625rem', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.875rem', lineHeight: 1.6, resize: 'vertical', fontFamily: 'var(--font-body)', boxSizing: 'border-box', marginBottom: '0.5rem' }}
          />
          <button onClick={handleAdd} style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', minHeight: '44px' }}>
            Save Session
          </button>
        </div>
      )}

      {notes.length === 0 && !adding ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>
          {readOnly ? 'No session notes recorded.' : 'No session notes yet. Add one after your next game!'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {notes.map(note => (
            <div key={note.id} style={{ padding: '0.875rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.375rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-gold)', fontWeight: '600' }}>{note.date}</span>
                {!readOnly && (
                  <button onClick={() => handleDelete(note.id)} aria-label="Delete session note" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1rem', padding: '0', lineHeight: 1, minHeight: '44px', minWidth: '44px' }}>×</button>
                )}
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{note.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── People of Note ────────────────────────────────────────────────────────────
function PeopleOfNote({ character, onUpdate, readOnly }: { character: CharacterWithNotes; onUpdate: Props['onUpdate']; readOnly?: boolean }) {
  const people = character.peopleOfNote ?? [];
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNote, setNewNote] = useState('');

  async function handleAdd() {
    if (!newName.trim()) return;
    const entry: PersonOfNote = { id: generateId(), name: newName.trim(), note: newNote.trim() };
    await onUpdate({ peopleOfNote: [...people, entry] });
    setNewName('');
    setNewNote('');
    setAdding(false);
  }

  async function handleDelete(id: string) {
    await onUpdate({ peopleOfNote: people.filter(p => p.id !== id) });
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>People of Note</h3>
        {!readOnly && (
          <button onClick={() => setAdding(a => !a)} style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', minHeight: '44px' }}>
            {adding ? 'Cancel' : '+ Add Person'}
          </button>
        )}
      </div>

      {!readOnly && adding && (
        <div style={{ marginBottom: '1rem', padding: '0.875rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px' }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Name or title"
            autoFocus
            style={{ width: '100%', padding: '0.5rem 0.625rem', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.875rem', boxSizing: 'border-box', marginBottom: '0.5rem' }}
          />
          <textarea
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            placeholder="Notes about this person (optional)"
            style={{ width: '100%', minHeight: '80px', padding: '0.5rem 0.625rem', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.875rem', lineHeight: 1.5, resize: 'vertical', fontFamily: 'var(--font-body)', boxSizing: 'border-box', marginBottom: '0.5rem' }}
          />
          <button onClick={handleAdd} style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', minHeight: '44px' }}>
            Save Person
          </button>
        </div>
      )}

      {people.length === 0 && !adding ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>
          {readOnly ? 'No people of note recorded.' : 'No notable people yet. Track allies, enemies, and contacts here.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {people.map(person => (
            <div key={person.id} style={{ padding: '0.75rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--color-text)' }}>{person.name}</span>
                {!readOnly && (
                  <button onClick={() => handleDelete(person.id)} aria-label={`Delete ${person.name}`} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1rem', padding: '0', lineHeight: 1, minHeight: '44px', minWidth: '44px' }}>×</button>
                )}
              </div>
              {person.note && <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{person.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── NotesTab (main export) ────────────────────────────────────────────────────
const SUBTABS = ['General', 'Sessions', 'People'] as const;
type SubTab = typeof SUBTABS[number];

export function NotesTab({ character, onUpdate, readOnly }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('General');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0' }}>
        {SUBTABS.map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            style={{
              padding: '0.5rem 0.875rem',
              background: 'none',
              border: 'none',
              borderBottom: subTab === t ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: subTab === t ? 'var(--color-primary)' : 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: subTab === t ? '600' : '400',
              marginBottom: '-1px',
              transition: 'color 0.15s',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {subTab === 'General' && <GeneralNotes character={character} onUpdate={onUpdate} readOnly={readOnly} />}
      {subTab === 'Sessions' && <SessionNotes character={character} onUpdate={onUpdate} readOnly={readOnly} />}
      {subTab === 'People' && <PeopleOfNote character={character} onUpdate={onUpdate} readOnly={readOnly} />}
    </div>
  );
}
