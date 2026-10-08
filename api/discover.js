// Daily discovery job. Vercel Cron → GET /api/discover (see vercel.json "crons").
// 1) Runs every source adapter that can be automated (JSON-LD / ICS / RSS).
// 2) If BRAVE_API_KEY is set, searches the web for Austin-area motor events and reads each result's schema.org Event data.
// 3) Keeps only dated, motor-related events. Captures the event page's own image (JSON-LD image or og:image) with its source URL.
// 4) If SUPABASE_URL + SUPABASE_SERVICE_KEY are set, upserts into discovered_candidates. The client engine dedupes + scores them.
import { SOURCES } from '../engine/data.js';
import { ADAPTERS, adapterFor } from '../engine/adapters/index.js';
import { extractJsonLd, extractOpenGraph } from '../engine/adapters/jsonld.js';
import { classify, nearAustin } from '../engine/genres.js';
import { configured, upsertCandidates, logRun, upcomingCandidates, deleteIds } from '../lib/db.js';

// Learning events only count when they put you behind the wheel or on the bike: rider courses, licensing, driving schools, HPDE.
const DRIVE_LEARN = /\b(msf|rider (course|training)|riding (course|school|class)|basic rider|motorcycle (license|licence|safety|training)|driv(ing|er) (school|course|training|clinic)|performance driving|hpde|car control|teen driver|track (school|day|night)|racing school|skills (clinic|day)|off-?road (training|course|school)|autocross school)\b/i;
const CLASS_WORDS = /\b(workshop|seminar|webinar|class|tech day|tech session|clinic|lecture|info session|meeting)\b/i;
const isGenericClass = t => CLASS_WORDS.test(t || '') && !DRIVE_LEARN.test(t || '');
const QUERIES = [
  // cars + shows
  'Austin car meet this weekend', 'Austin cars and coffee', 'Austin car show', 'Austin auto show', 'Austin cruise night', 'Austin classic car show', 'Austin hot rod show', 'Austin lowrider show', 'Austin JDM meet', 'Austin Porsche BMW club event', 'Austin Mustang Corvette club event', 'Austin exotic car event', 'Austin EV car meetup',
  'Round Rock car show', 'Georgetown TX car show', 'Cedar Park car meet', 'Pflugerville car show', 'Buda Kyle car show', 'San Marcos car show', 'New Braunfels car show', 'Dripping Springs car show', 'Bastrop car show', 'Lockhart car show', 'Temple Belton car show', 'Fredericksburg car show', 'Austin swap meet auto parts',
  // two wheels
  'Austin bike night motorcycle', 'Austin motorcycle group ride', 'Texas motorcycle rally', 'Central Texas biker rally', 'Austin motorcycle show', 'Austin vintage motorcycle event', 'Hill Country motorcycle ride event', 'Austin motorcycle safety course MSF', 'Austin scooter rally', 'Central Texas motocross race', 'Texas enduro hare scramble', 'Texas flat track race',
  // 4x4 + off-road
  'Central Texas off road event jeep', 'Texas jeep jamboree', 'Central Texas off road park events', 'Texas ATV UTV ride event', 'Central Texas mud bog', 'Texas overland expo meetup', 'Austin Bronco club event', 'Austin truck show', 'Austin monster truck', 'Central Texas tractor pull', 'Central Texas demolition derby',
  // racing + track
  'Circuit of the Americas events', 'Harris Hill Raceway events', 'Thunderhill Raceway Kyle', 'Austin track day HPDE', 'Austin performance driving school HPDE', 'Texas autocross Austin SCCA', 'Texas drift event Austin', 'Central Texas drag racing', 'Central Texas dirt track racing', 'Texas rally race', 'Austin karting race', 'San Antonio motorsports event'
];
const BLOCK = /(^|\.)(instagram\.com|facebook\.com|fb\.me|x\.com|twitter\.com|tiktok\.com|youtube\.com|reddit\.com|pinterest\.com)$/i;
const UA = 'MorrMotoBot/0.1 (+https://morrmoto.com/bot)';

async function fetchText(url, ms = 6000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,text/calendar,application/rss+xml' }, redirect: 'follow' }); if (!r.ok) throw new Error('HTTP ' + r.status); return (await r.text()).slice(0, 1_500_000); }
  finally { clearTimeout(t); }
}

function toRow(e, url, kind, ogImage) {
  if (!e || !e.name || !e.start_date) return null;
  const cls = classify([e.name, e.description, e.organizer].filter(Boolean).join(' '));
  if (!cls.motorized) return null;
  if (isGenericClass([e.name, e.description].filter(Boolean).join(' '))) return null;
  if (!nearAustin(e)) return null;
  const host = new URL(url).hostname.replace(/^www\./, '');
  return { url: e.source_url || url, start_date: e.start_date, source_kind: kind, host, last_checked_at: new Date().toISOString(),
    payload: { ...e, image_url: e.image_url || ogImage || null, image_source_url: url, vehicle_type: cls.vehicle_type, event_type: cls.event_type, genres: cls.genres } };
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) { res.statusCode = 401; return res.end('unauthorized'); }
  const t0 = Date.now(), today = new Date().toISOString().slice(0, 10), rows = [], log = [], seen = new Set();

  for (const s of SOURCES) {
    const a = adapterFor(s), ad = ADAPTERS[a.key];
    if (!ad || ad.automatable !== 'yes') continue;
    try { for (const e of await ad.run({ source: s, fetchText })) { const r = toRow(e, e.source_url || s.url, 'adapter:' + a.key); if (r) rows.push(r); } log.push({ source: s.id, ok: true }); }
    catch (err) { log.push({ source: s.id, ok: false, error: String(err.message || err).slice(0, 120) }); }
  }

  let searched = 0;
  if (process.env.BRAVE_API_KEY) {
    // Rotate the starting query daily and run 6 queries at a time, each reading its result pages in parallel.
    const off = Math.floor(Date.now() / 864e5) % QUERIES.length, order = [...QUERIES.slice(off), ...QUERIES.slice(0, off)];
    const runQuery = async q => {
      try {
        const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=10&country=us`, { headers: { 'X-Subscription-Token': process.env.BRAVE_API_KEY, Accept: 'application/json' } });
        if (!r.ok) throw new Error('brave ' + r.status);
        const j = await r.json(); searched++;
        const urls = [];
        for (const it of (j.web?.results || []).slice(0, 6)) { let host; try { host = new URL(it.url).hostname; } catch { continue; } if (seen.has(it.url) || BLOCK.test(host)) continue; seen.add(it.url); urls.push(it.url); }
        await Promise.allSettled(urls.map(async u => { const html = await fetchText(u, 5000); const og = extractOpenGraph(html); extractJsonLd(html, u).filter(e => e.start_date >= today).forEach(e => { const row = toRow(e, u, 'web-search', og.image_url); if (row) rows.push(row); }); }));
      } catch (err) { log.push({ query: q, ok: false, error: String(err.message || err).slice(0, 120) }); }
    };
    for (let i = 0; i < order.length && Date.now() - t0 < 42000; i += 6) await Promise.all(order.slice(i, i + 6).map(runQuery));
  }

  // One row per (url, start_date): Postgres rejects an upsert batch that touches the same key twice.
  const uniq = [...new Map(rows.map(r => [r.url + '|' + r.start_date, r])).values()];

  let stored = 0, storeError = null, purged = 0;
  try { stored = await upsertCandidates(uniq); } catch (e) { storeError = String(e.message || e); }
  // Re-check everything already stored against the current rules, so tightening the filter cleans up old finds too.
  try {
    const old = (await upcomingCandidates(today)) || [];
    const bad = old.filter(r => { const p = r.payload || {}; return !classify([p.name, p.description, p.organizer].filter(Boolean).join(' ')).motorized || isGenericClass([p.name, p.description].filter(Boolean).join(' ')) || !nearAustin(p); }).map(r => r.id);
    purged = await deleteIds(bad);
  } catch (e) { storeError = (storeError ? storeError + ' · ' : '') + 'purge: ' + String(e.message || e); }
  const summary = { ran_at: new Date().toISOString(), ms: Date.now() - t0, found: uniq.length, stored, purged, searched, queries: QUERIES.length, adapters_ok: log.filter(l => l.ok).length, errors: log.filter(l => !l.ok).length };
  await logRun({ ...summary, store_error: storeError ? storeError.slice(0, 500) : null, search_on: !!process.env.BRAVE_API_KEY });
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, ...summary, storeError, configured: { search: !!process.env.BRAVE_API_KEY, database: configured(), cron_secret: !!secret }, log }));
}
