import { sfApex } from './_sf.js';
import { requireAuth } from './_session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const session = requireAuth(req, res);
  if (!session) return;
  const { items, clientName, area } = req.body || {};
  const { status, json } = await sfApex('/portal/data', {
    method: 'POST',
    body: { phone: session.phone, items, clientName, area }, // phone from JWT, never from client
  });
  res.status(status).json(json);
}
