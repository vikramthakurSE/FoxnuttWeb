const { sfQuery, sfInsert } = require('./_sf');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).end();

  const { accountId, lineItems, deliveryDate } = req.body;

  if (!accountId || !lineItems || !lineItems.length) {
    return res.status(400).json({ error: 'Missing order details.' });
  }

  try {
    // Get RecordType ID for Sale
    const rtRes = await sfQuery(
      `SELECT Id FROM RecordType
       WHERE SObjectType = 'Sale__c' LIMIT 1`
    );

    // Build Sale record
    const today = new Date().toISOString().split('T')[0];
    const saleRecord = {
      Client__c:       accountId,
      Sale_Date__c:    today,
      Order_Status__c: 'Confirmed'
    };
    if (deliveryDate) {
      saleRecord.Expected_Delivery_Date__c = deliveryDate;
    }

    // Insert Sale
    const saleResult = await sfInsert('Sale__c', saleRecord);
    if (!saleResult.id) {
      throw new Error('Sale creation failed: ' + JSON.stringify(saleResult));
    }
    const saleId = saleResult.id;

    // Insert Line Items
    for (const item of lineItems) {
      await sfInsert('Sale_Line_Item__c', {
        Sale__c:        saleId,
        Brand__c:       item.brand,
        Packet_Type__c: item.type,
        Quantity__c:    item.quantity,
        Rate_Per_Kg__c: item.rate
      });
    }

    // Get sale name (auto-number)
    const saleDetails = await sfQuery(
      `SELECT Name FROM Sale__c WHERE Id = '${saleId}' LIMIT 1`
    );
    const saleName = saleDetails.records?.[0]?.Name || saleId;

    return res.json({
      success:  true,
      saleId,
      saleName
    });
  } catch (e) {
    console.error('Place order error:', e);
    return res.status(500).json({ error: e.message || 'Order failed. Try again.' });
  }
};