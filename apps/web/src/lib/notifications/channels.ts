export type Channel = 'email' | 'sms' | 'whatsapp';

/** Channels with a working provider integration. SMS (Twilio) lands later. */
export const IMPLEMENTED_CHANNELS: Channel[] = ['email', 'whatsapp'];

export interface ChannelPrefs {
  email_opt_in: boolean;
  sms_opt_in: boolean;
  whatsapp_opt_in: boolean;
  /** Meta requires explicit recorded consent before proactive WhatsApp sends. */
  whatsapp_consent_at: string | null;
}

/** Channels that are both implemented AND opted-in (WhatsApp also consented). */
export function channelsFor(prefs: ChannelPrefs): Channel[] {
  const opted: Record<Channel, boolean> = {
    email: prefs.email_opt_in,
    sms: prefs.sms_opt_in,
    whatsapp: prefs.whatsapp_opt_in && prefs.whatsapp_consent_at != null,
  };
  return IMPLEMENTED_CHANNELS.filter(c => opted[c]);
}
