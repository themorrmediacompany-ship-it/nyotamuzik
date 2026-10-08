// GET /api/events → live candidates found by the daily job, in the same shape as engine/data.js CANDIDATES.
// The app merges them with the seed capture and runs the same dedupe/confidence engine, so nothing is published unchecked.
import { configured, upcomingCandidates } from '../lib/db.js';
import { classify } from '../engine/genres.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
  if (!configured()) return res.end(JSON.stringify({ ok: false, reason: 'database_not_configured' }));
  try {
    const rows = await upcomingCandidates(new Date().toISOString().slice(0, 10));
    const sources = new Map(), candidates = [];
    for (const r of rows || []) {
      const p = r.payload || {}, sid = 'web:' + r.host;
      if (!classify([p.name, p.description, p.organizer].filter(Boolean).join(' ')).motorized) continue;
      if (!sources.has(sid)) sources.set(sid, { id: sid, name: r.host, url: 'https://' + r.host, type: r.source_kind === 'web-search' ? 'Web discovery' : 'Automated source', primary: false, area: '—', categories: [], method: r.source_kind, freq: 'Daily', last_checked: String(r.last_checked_at).slice(0, 10), reliability: 0.62, active: true, notes: 'Found by the daily discovery job.' });
      candidates.push({ id: 'w' + r.id, source_id: sid, url: r.url, raw_title: p.name, page_age_days: null,
        evidence: `${p.evidence || 'Event page'}${p.description ? ': ' + p.description.slice(0, 220) : ''}`,
        discovered_at: r.discovered_at, last_checked_at: r.last_checked_at,
        extracted: { event_name: p.name, start_date: p.start_date, end_date: p.end_date, start_time: p.start_time, end_time: p.end_time, venue: p.venue, street_address: p.address, city: p.city, latitude: p.latitude, longitude: p.longitude, organizer: p.organizer, price: p.price, free: p.free, registration_url: p.registration_url, image_url: p.image_url, image_source_url: p.image_source_url, event_type: p.event_type, vehicle_type: p.vehicle_type } });
    }
    res.end(JSON.stringify({ ok: true, updated_at: new Date().toISOString(), sources: [...sources.values()], candidates }));
  } catch (e) { res.statusCode = 200; res.end(JSON.stringify({ ok: false, reason: String(e.message || e) })); }
}
