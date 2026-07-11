export type Channel = 'email' | 'sms' | 'whatsapp';

/** Channels with a working provider integration. SMS (Twilio) lands later. */
export const IMPLEMENTED_CHANNELS: Channel[] = ['email', 'whatsapp'];

/**
 * Feature flag: WhatsApp is enabled by configuring Twilio. Until the Twilio
 * account is set up (env vars absent), the channel is off everywhere — no
 * deliveries are enqueued, so nothing is marked failed.
 */
export function whatsappEnabled(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM,
  );
}

export interface ChannelPrefs {
  email_opt_in: boolean;
  sms_opt_in: boolean;
  whatsapp_opt_in: boolean;
  /** Meta requires explicit recorded consent before proactive WhatsApp sends. */
  whatsapp_consent_at: string | null;
}

/** Channels that are implemented, enabled, AND opted-in (WhatsApp also consented). */
export function channelsFor(prefs: ChannelPrefs): Channel[] {
  const opted: Record<Channel, boolean> = {
    email: prefs.email_opt_in,
    sms: prefs.sms_opt_in,
    whatsapp: whatsappEnabled() && prefs.whatsapp_opt_in && prefs.whatsapp_consent_at != null,
  };
  return IMPLEMENTED_CHANNELS.filter(c => opted[c]);
}
