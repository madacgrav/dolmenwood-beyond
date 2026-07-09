export type Channel = 'email' | 'sms' | 'whatsapp';

/** Channels with a working provider integration. SMS/WhatsApp (Twilio) land later. */
export const IMPLEMENTED_CHANNELS: Channel[] = ['email'];

export interface ChannelPrefs {
  email_opt_in: boolean;
  sms_opt_in: boolean;
  whatsapp_opt_in: boolean;
}

/** Channels that are both implemented AND opted-in for this account. */
export function channelsFor(prefs: ChannelPrefs): Channel[] {
  const opted: Record<Channel, boolean> = {
    email: prefs.email_opt_in,
    sms: prefs.sms_opt_in,
    whatsapp: prefs.whatsapp_opt_in,
  };
  return IMPLEMENTED_CHANNELS.filter(c => opted[c]);
}
