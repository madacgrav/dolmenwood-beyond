/** E.164: leading +, first digit 1-9, total 8–15 digits. */
const E164 = /^\+[1-9]\d{7,14}$/;

export function isValidE164(phone: string): boolean {
  return E164.test(phone);
}
