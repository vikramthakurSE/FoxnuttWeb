import { sfApex } from './_sf.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { phone } = req.body || {};
  const { status, json } = await sfApex('/portal/auth', {
    method: 'POST',
    body: { action: 'send_otp', phone },
  });
  res.status(status).json(json);
}
