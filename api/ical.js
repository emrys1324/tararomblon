/* GET /api/ical?stay=ID&key=KEY — this stay's Tara Romblon bookings as an iCal calendar. Paste the link into Airbnb (Availability → Connect calendars → Import calendar). */
const { createCore } = require('./_lib/shared');
const { createEnv } = require('./_lib/env');
module.exports = async function handler(req, res) {
  try {
    const q = req.query || {}, text = await createCore(createEnv()).icsFeed(String(q.stay || ''), String(q.key || ''));
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Disposition', 'inline; filename="tara-romblon.ics"');
    return res.status(200).send(text);
  } catch (e) { return res.status(404).send('Not found'); }
};
