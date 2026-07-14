const { sfQuery } = require('./_sf');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const soql = `
      SELECT Id, Brand__c, Packet_Type__c,
             Selling_Price__c, Remaining_Quantity__c
      FROM Inventory__c
      WHERE Remaining_Quantity__c > 0
      AND Selling_Price__c != null
      ORDER BY Brand__c, Packet_Type__c
    `;
    const result = await sfQuery(soql);

    const products = (result.records || []).map(inv => ({
      id:        inv.Id,
      key:       (inv.Brand__c + '_' + inv.Packet_Type__c)
                  .replace(/\s+/g, '_'),
      brand:     inv.Brand__c,
      type:      inv.Packet_Type__c,
      price:     inv.Selling_Price__c,
      available: inv.Remaining_Quantity__c
    }));

    return res.json({ products });
  } catch (e) {
    console.error('Catalog error:', e);
    return res.status(500).json({ error: 'Could not load products.' });
  }
};