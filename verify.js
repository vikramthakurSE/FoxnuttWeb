const { sfQuery } = require('./_sf');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const body  = req.body || {};
  const phone = (body.phone || '').toString().trim();
  if (phone.length !== 10)
    return res.status(400).json({ error: 'Enter a valid 10-digit number.' });

  // Surface missing env vars clearly
  const required = ['SF_CLIENT_ID','SF_CLIENT_SECRET','SF_USERNAME',
                    'SF_PASSWORD','SF_SECURITY_TOKEN','SF_LOGIN_URL'];
  const missing  = required.filter(k => !process.env[k]);
  if (missing.length)
    return res.status(500).json({ error: 'Missing: ' + missing.join(', ') });

  try {
    const soql =
      "SELECT Id, Name, Phone, Account_Balance__c FROM Account " +
      "WHERE RecordType.Name = 'Client' AND (" +
      "Phone LIKE '%" + phone + "' OR " +
      "Phone = '" + phone + "' OR " +
      "Phone = '+91" + phone + "' OR " +
      "Phone = '91" + phone + "') LIMIT 1";

    const result = await sfQuery(soql);
    if (!result.records || !result.records.length)
      return res.status(401).json({ error: 'Number not registered. Contact Nutty Nirvana.' });

    const acc = result.records[0];
    return res.json({ accountId: acc.Id, name: acc.Name, phone, balance: acc.Account_Balance__c || 0 });
  } catch (e) {
    return res.status(500).json({ error: 'SF Error: ' + e.message });
  }
};