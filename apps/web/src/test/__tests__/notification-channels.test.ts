import { describe, it, expect } from 'vitest';
import { channelsFor } from '../../lib/notifications/channels';

const CONSENT = '2026-07-10T00:00:00Z';

describe('channelsFor', () => {
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
