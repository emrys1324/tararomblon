/* POST /api/hitpay-webhook — register this URL in HitPay > Developers > Webhook Endpoints
   for the event payment_request.completed, and copy that endpoint's salt into HITPAY_SALT. */
const { createCore } = require('./_lib/shared');
const { createEnv, hitpaySignatureOk } = require('./_lib/env');

function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const raw = await rawBody(req);
  if (!hitpaySignatureOk(raw, req.headers['hitpay-signature'])) return res.status(401).json({ error: 'Invalid signature' });
  let p = {}; try { p = JSON.parse(raw); } catch (e) { return res.status(400).json({ error: 'Bad JSON' }); }
  const ref = p.reference_number || (p.payment_request && p.payment_request.reference_number) || '';
  try {
    /* The signed webhook tells us which booking; the core then re-checks the payment with HitPay before confirming it. */
    if (ref) await createCore(createEnv()).paymentWebhook(String(ref));
    return res.status(200).json({ received: true });
  } catch (e) {
    console.error('webhook', e);
    return res.status(500).json({ error: 'Try again' }); // HitPay retries non-200 responses
  }
};
