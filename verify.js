const { sfQuery } = require('./_sf');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).end();

  const { phone } = req.body;
  if (!phone || phone.length !== 10) {
    return res.status(400).json({ error: 'Invalid phone number.' });
  }

  try {
    // Search by last 10 digits to handle different formats
    const soql = `
      SELECT Id, Name, Phone, Account_Balance__c
      FROM Account
      WHERE RecordType.Name = 'Client'
      AND (Phone LIKE '%${phone}'
           OR Phone = '${phone}'
           OR Phone = '+91${phone}'
           OR Phone = '91${phone}')
      LIMIT 1
    `;
    const result = await sfQuery(soql);

    if (!result.records || result.records.length === 0) {
      return res.status(401).json({
        error: 'Mobile number not registered with us. Contact Nutty Nirvana.'
      });
    }

    const acc = result.records[0];
    return res.json({
      accountId: acc.Id,
      name:      acc.Name,
      phone:     phone,
      balance:   acc.Account_Balance__c || 0
    });
  } catch (e) {
    console.error('Verify error:', e);
    return res.status(500).json({ error: 'Server error. Try again.' });
  }
};