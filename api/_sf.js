// Salesforce connection helper — username-password OAuth, token cached per warm lambda.
// Env vars (Vercel → Project → Settings → Environment Variables):
//   SF_LOGIN_URL      e.g. https://login.salesforce.com  (or your My Domain)
//   SF_CLIENT_ID      Connected App consumer key
//   SF_CLIENT_SECRET  Connected App consumer secret
//   SF_USERNAME       integration user
//   SF_PASSWORD       password + security token concatenated

let cached = null; // { accessToken, instanceUrl, expiresAt }

async function login() {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: process.env.SF_CLIENT_ID,
    client_secret: process.env.SF_CLIENT_SECRET,
    username: process.env.SF_USERNAME,
    password: process.env.SF_PASSWORD,
  });
  const r = await fetch(`${process.env.SF_LOGIN_URL}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) throw new Error(`Salesforce login failed: ${r.status}`);
  const data = await r.json();
  cached = {
    accessToken: data.access_token,
    instanceUrl: data.instance_url,
    expiresAt: Date.now() + 90 * 60 * 1000, // refresh well before 2h default
  };
  return cached;
}

async function session() {
  if (cached && cached.expiresAt > Date.now()) return cached;
  return login();
}

/** Call an Apex REST endpoint. path e.g. '/portal/auth'. Retries once on 401. */
export async function sfApex(path, { method = 'GET', body, query } = {}) {
  let s = await session();
  const qs = query ? '?' + new URLSearchParams(query).toString() : '';
  const doFetch = () =>
    fetch(`${s.instanceUrl}/services/apexrest${path}${qs}`, {
      method,
      headers: {
        Authorization: `Bearer ${s.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  let r = await doFetch();
  if (r.status === 401) {
    s = await login();
    r = await doFetch();
  }
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { ok: false, message: text }; }
  // Apex REST sometimes double-serializes strings
  if (typeof json === 'string') { try { json = JSON.parse(json); } catch {} }
  return { status: r.status, json };
}
