'use client';

import { useEffect, useState } from 'react';
import type { Account } from '@/lib/data/account';
import { sectionStyle, sectionHeaderStyle, inputStyle } from './styles';

interface NotificationsSectionProps {
  account: Account | null;
  onAccountChange: (updater: (prev: Account | null) => Account | null) => void;
}

/** Strip formatting characters; keep a leading + for E.164-style numbers. */
function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-().]/g, '');
}

export function NotificationsSection({ account, onAccountChange }: NotificationsSectionProps) {
  const [phone, setPhone] = useState('');
  const [emailOptIn, setEmailOptIn] = useState(true);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    if (!account) return;
    setPhone(account.phone ?? '');
    setEmailOptIn(account.email_opt_in);
    setSmsOptIn(account.sms_opt_in);
    setWhatsappOptIn(account.whatsapp_opt_in);
  }, [account]);

  async function handleSave() {
    if (!account) return;
    setSaving(true);
    setSaveMsg('');
    const normalizedPhone = normalizePhone(phone);
    const prefs = {
      phone: normalizedPhone === '' ? null : normalizedPhone,
      email_opt_in: emailOptIn,
      sms_opt_in: smsOptIn,
      whatsapp_opt_in: whatsappOptIn,
    };
    const res = await fetch('/api/account', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    });
    setSaving(false);
    if (!res.ok) {
      setSaveMsg('Failed to save.');
    } else {
      setPhone(normalizedPhone);
      onAccountChange(prev => prev ? { ...prev, ...prefs } : prev);
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 2000);
    }
  }

  const toggles = [
    { value: emailOptIn, set: setEmailOptIn, label: 'Email', desc: 'Session confirmations by email' },
    { value: smsOptIn, set: setSmsOptIn, label: 'SMS', desc: 'Text message notifications (coming soon)' },
    { value: whatsappOptIn, set: setWhatsappOptIn, label: 'WhatsApp', desc: 'WhatsApp notifications (coming soon)' },
  ];

  return (
    <section style={sectionStyle}>
      <h2 style={sectionHeaderStyle}>Notifications</h2>

      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
          Phone Number (for SMS / WhatsApp)
        </div>
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="+15551234567"
          style={inputStyle}
        />
      </div>

      {toggles.map(({ value, set, label, desc }) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{label}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>{desc}</div>
          </div>
          <button
            onClick={() => set(!value)}
            aria-label={value ? `Disable ${label} notifications` : `Enable ${label} notifications`}
            style={{ width: '52px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer', backgroundColor: value ? 'var(--color-primary)' : 'var(--color-border)', position: 'relative', transition: 'background-color 0.2s', flexShrink: 0 }}
          >
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'white', position: 'absolute', top: '3px', left: value ? '27px' : '3px', transition: 'left 0.2s' }} />
          </button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', minHeight: '44px', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
        {saveMsg && (
          <span style={{ fontSize: '0.875rem', color: saveMsg === 'Saved!' ? 'var(--color-primary)' : 'var(--color-danger)' }}>
            {saveMsg}
          </span>
        )}
      </div>
    </section>
  );
}
