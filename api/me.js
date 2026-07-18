import { sfApex } from './_sf.js';
import { requireAuth } from './_session.js';

export default async function handler(req, res) {
  const session = requireAuth(req, res);
  if (!session) return;
  const { status, json } = await sfApex('/portal/data', {
    query: { type: 'me', phone: session.phone },
  });
  res.status(status).json(json);
}
