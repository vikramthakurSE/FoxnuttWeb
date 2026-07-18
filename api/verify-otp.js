import { sfApex } from './_sf.js';
import { issueToken } from './_session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { phone, code } = req.body || {};
  const { status, json } = await sfApex('/portal/auth', {
    method: 'POST',
    body: { action: 'verify_otp', phone, code },
  });
  if (status === 200 && json.ok) {
    json.token = issueToken(json.phone); // client stores this; skips OTP for 30 days
  }
  res.status(status).json(json);
}
