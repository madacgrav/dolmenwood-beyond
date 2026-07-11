import twilio from 'twilio';

export async function sendWhatsApp(to: string, _subject: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM; // includes the "whatsapp:" prefix
  if (!sid || !token || !from) {
    throw new Error(
      'WhatsApp channel requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FROM',
    );
  }
  if (!to) throw new Error('WhatsApp channel requires a recipient phone number');
  const client = twilio(sid, token);
  await client.messages.create({ from, to: `whatsapp:${to}`, body });
}
