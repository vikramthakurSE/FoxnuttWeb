// Shared Salesforce REST API helper
// Uses Username-Password OAuth flow

let _token = null;
let _instanceUrl = null;
let _tokenExpiry = 0;

async function getSFToken() {
  if (_token && Date.now() < _tokenExpiry) {
    return { token: _token, instanceUrl: _instanceUrl };
  }

  const params = new URLSearchParams({
    grant_type:    'password',
    client_id:     process.env.SF_CLIENT_ID,
    client_secret: process.env.SF_CLIENT_SECRET,
    username:      process.env.SF_USERNAME,
    password:      process.env.SF_PASSWORD + process.env.SF_SECURITY_TOKEN
  });

  const res = await fetch(
    (process.env.SF_LOGIN_URL || 'https://login.salesforce.com') +
    '/services/oauth2/token',
    { method: 'POST', body: params }
  );
  const data = await res.json();

  if (!data.access_token) {
    throw new Error('SF auth failed: ' + JSON.stringify(data));
  }

  _token       = data.access_token;
  _instanceUrl = data.instance_url;
  _tokenExpiry = Date.now() + 50 * 60 * 1000; // 50 min
  return { token: _token, instanceUrl: _instanceUrl };
}

async function sfQuery(soql) {
  const { token, instanceUrl } = await getSFToken();
  const res = await fetch(
    instanceUrl + '/services/data/v59.0/query?q=' +
    encodeURIComponent(soql),
    { headers: { Authorization: 'Bearer ' + token } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function sfInsert(sobject, record) {
  const { token, instanceUrl } = await getSFToken();
  const res = await fetch(
    instanceUrl + '/services/data/v59.0/sobjects/' + sobject,
    {
      method:  'POST',
      headers: {
        Authorization:  'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(record)
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

module.exports = { getSFToken, sfQuery, sfInsert };