import { Resend } from 'resend';

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    throw new Error('Email channel requires RESEND_API_KEY and RESEND_FROM');
  }
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from, to, subject, text: body });
  if (error) throw new Error(error.message);
}
