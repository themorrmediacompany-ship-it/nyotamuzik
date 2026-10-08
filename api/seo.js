// Server-rendered pages for people and search engines: /events/:slug, /austin, /austin/:category, /austin/this-weekend, /sitemap.xml
import { run } from '../engine/core.js';
import * as seed from '../engine/data.js';
import { configured, upcomingCandidates } from '../lib/db.js';
import { classify } from '../engine/genres.js';
import { publish, eventPage, weekendPage, listPage, sitemap, notFound, CATS, TRUST } from '../lib/seo.js';

const todayCT = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
async function load(today) {
  const data = { SOURCES: [...seed.SOURCES], CANDIDATES: [...seed.CANDIDATES], WINDOW: { start: today, end: new Date(Date.parse(today) + 30 * 864e5).toISOString().slice(0, 10) } };
  if (configured()) try {
    const rows = await upcomingCandidates(today), seen = new Set();
    for (const r of rows || []) { const p = r.payload || {}, sid = 'web:' + r.host;
      if (!classify([p.name, p.description, p.organizer].filter(Boolean).join(' ')).motorized) continue;
      if (!seen.has(sid)) { seen.add(sid); data.SOURCES.push({ id: sid, name: r.host, url: 'https://' + r.host, type: 'Web discovery', primary: false, area: '—', categories: [], method: r.source_kind, freq: 'Daily', last_checked: String(r.last_checked_at).slice(0, 10), reliability: 0.62, active: true }); }
      data.CANDIDATES.push({ id: 'w' + r.id, source_id: sid, url: r.url, raw_title: p.name, page_age_days: null, evidence: p.evidence || 'Event page', discovered_at: r.discovered_at, last_checked_at: r.last_checked_at,
        extracted: { event_name: p.name, start_date: p.start_date, end_date: p.end_date, start_time: p.start_time, end_time: p.end_time, venue: p.venue, street_address: p.address, city: p.city, latitude: p.latitude, longitude: p.longitude, organizer: p.organizer, price: p.price, free: p.free, registration_url: p.registration_url, image_url: p.image_url, event_type: p.event_type, vehicle_type: p.vehicle_type } }); }
  } catch (e) { /* live data optional: seed still renders */ }
  return publish(run(data), today);
}
export default async function handler(req, res) {
  const q = req.query || {}, today = todayCT();
  if (q.p === 'trust' && TRUST[q.page]) { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 's-maxage=86400'); return res.end(TRUST[q.page]()); }
  try {
    const pub = await load(today);
    let html, status = 200, type = 'text/html; charset=utf-8';
    if (q.p === 'sitemap') { html = sitemap(pub); type = 'application/xml; charset=utf-8'; }
    else if (q.p === 'event') { const e = pub.find(x => x.slug === q.slug); if (e) html = eventPage(e, pub); else { html = notFound(); status = 404; } }
    else if (q.p === 'weekend') html = weekendPage(pub, today);
    else if (q.p === 'list') { if (q.cat && !CATS[q.cat]) { html = notFound(); status = 404; } else html = listPage(pub, q.cat || null); }
    else { html = notFound(); status = 404; }
    res.statusCode = status; res.setHeader('Content-Type', type); res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400'); res.end(html);
  } catch (e) { res.statusCode = 500; res.setHeader('Content-Type', 'text/plain'); res.end('MorrMoto hit a snag rendering this page.'); }
}
