import { describe, it, expect } from 'vitest';
import { channelsFor } from '../../lib/notifications/channels';

describe('channelsFor', () => {
  it('returns email when email is opted in', () => {
    expect(channelsFor({ email_opt_in: true, sms_opt_in: false, whatsapp_opt_in: false }))
      .toEqual(['email']);
  });

  it('returns nothing when email is opted out', () => {
    expect(channelsFor({ email_opt_in: false, sms_opt_in: false, whatsapp_opt_in: false }))
      .toEqual([]);
  });

  it('excludes opted-in but unimplemented channels (sms, whatsapp)', () => {
    expect(channelsFor({ email_opt_in: false, sms_opt_in: true, whatsapp_opt_in: true }))
      .toEqual([]);
  });

  it('returns only implemented channels when everything is opted in', () => {
    expect(channelsFor({ email_opt_in: true, sms_opt_in: true, whatsapp_opt_in: true }))
      .toEqual(['email']);
  });
});
