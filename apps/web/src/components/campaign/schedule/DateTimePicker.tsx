'use client';

import { useState } from 'react';
import { CalendarDatePicker, toDayInput } from '@/components/campaign/schedule/CalendarDatePicker';

const fieldStyle = {
  padding: '0.5rem 0.625rem', borderRadius: '6px',
  border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
  color: 'var(--color-text)', fontSize: '0.95rem', minHeight: '44px',
  boxSizing: 'border-box' as const,
};

interface Props {
  value: string;   // datetime-local string 'YYYY-MM-DDTHH:mm'
  onChange: (value: string) => void;
}

/** Calendar-modal day picker + time input that emits a datetime-local string. */
export function DateTimePicker({ value, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const datePart = value ? value.split('T')[0] : '';
  const timePart = value.includes('T') ? value.split('T')[1] : '';

  function handleDay(d: Date) {
    const time = timePart || '19:00';
    onChange(`${toDayInput(d)}T${time}`);
    setPickerOpen(false);
  }

  function handleTime(t: string) {
    const date = datePart || toDayInput(new Date());
    onChange(`${date}T${t}`);
  }

  const dateLabel = datePart
    ? new Date(`${datePart}T${timePart || '00:00'}`).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      })
    : 'Pick a date';

  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          style={{ ...fieldStyle, flex: 1, textAlign: 'left', cursor: 'pointer' }}
        >
          📅 {dateLabel}
        </button>
        <input
          type="time"
          value={timePart}
          onChange={e => handleTime(e.target.value)}
          aria-label="Time"
          style={{ ...fieldStyle, width: '110px', flexShrink: 0 }}
        />
      </div>
      {pickerOpen && (
        <CalendarDatePicker
          value={datePart ? new Date(`${datePart}T${timePart || '00:00'}`) : null}
          onSelect={handleDay}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}
