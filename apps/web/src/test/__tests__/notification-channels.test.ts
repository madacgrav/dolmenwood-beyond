import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { channelsFor } from '../../lib/notifications/channels';

const CONSENT = '2026-07-10T00:00:00Z';

// WhatsApp is feature-flagged on the presence of the TWILIO_* env vars.
function enableWhatsApp() {
  vi.stubEnv('TWILIO_ACCOUNT_SID', 'ACtest');
  vi.stubEnv('TWILIO_AUTH_TOKEN', 'token');
  vi.stubEnv('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886');
}

describe('channelsFor (Twilio configured)', () => {
  beforeEach(enableWhatsApp);
  afterEach(() => vi.unstubAllEnvs());

  it('returns email when email is opted in', () => {
    expect(
      channelsFor({
        email_opt_in: true,
        sms_opt_in: false,
        whatsapp_opt_in: false,
        whatsapp_consent_at: null,
      }),
    ).toEqual(['email']);
  });

  it('returns nothing when everything is opted out', () => {
    expect(
      channelsFor({
        email_opt_in: false,
        sms_opt_in: false,
        whatsapp_opt_in: false,
        whatsapp_consent_at: null,
      }),
    ).toEqual([]);
  });

  it('excludes whatsapp when opted in but not consented (and sms is unimplemented)', () => {
    expect(
      channelsFor({
        email_opt_in: false,
        sms_opt_in: true,
        whatsapp_opt_in: true,
        whatsapp_consent_at: null,
      }),
    ).toEqual([]);
  });

  it('returns whatsapp when opted in AND consented', () => {
    expect(
      channelsFor({
        email_opt_in: false,
        sms_opt_in: false,
        whatsapp_opt_in: true,
        whatsapp_consent_at: CONSENT,
      }),
    ).toEqual(['whatsapp']);
  });

  it('returns only implemented channels when everything is opted in and consented', () => {
    expect(
      channelsFor({
        email_opt_in: true,
        sms_opt_in: true,
        whatsapp_opt_in: true,
        whatsapp_consent_at: CONSENT,
      }),
    ).toEqual(['email', 'whatsapp']);
  });
});

describe('channelsFor (Twilio NOT configured — feature flag off)', () => {
  it('excludes whatsapp even when opted in and consented', () => {
    expect(
      channelsFor({
        email_opt_in: true,
        sms_opt_in: false,
        whatsapp_opt_in: true,
        whatsapp_consent_at: CONSENT,
      }),
    ).toEqual(['email']);
  });
});
