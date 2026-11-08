// Sends one email through Resend's HTTP API when RESEND_API_KEY is set.
// Without a key, the email is printed to the server log so the reset flow can be tried locally.
export async function sendEmail({ to, subject, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'production') console.warn('RESEND_API_KEY is not set, so no email was sent.');
    else console.log(`\n--- email to ${to} ---\n${subject}\n\n${text}\n---\n`);
    return { sent: false };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || 'SpendLog <onboarding@resend.dev>', to: [to], subject, text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Email provider returned ${res.status}`);
  return { sent: true };
}
