// Vercel serverless function: GET /api/read-link?url=...
// Fetches ONE public page server-side and returns only what the page states (JSON-LD Event, else OpenGraph title).
// Never guesses missing fields. Results go into the review queue — never straight to publish.
import { extractJsonLd, extractOpenGraph } from '../engine/adapters/jsonld.js';

const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?|\[?f[cd]|metadata\.google)/i;
const BLOCKED = /(^|\.)(instagram\.com|facebook\.com|fb\.me|x\.com|twitter\.com|tiktok\.com)$/i;
const MAX = 1_500_000;

export default async function handler(req, res) {
  const send = (code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); };
  let u;
  try { u = new URL(String((req.query && req.query.url) || new URL(req.url, 'http://x').searchParams.get('url') || '')); } catch { return send(400, { ok: false, error: 'invalid_url' }); }
  if (!/^https?:$/.test(u.protocol) || PRIVATE.test(u.hostname)) return send(400, { ok: false, error: 'url_not_allowed' });
  if (BLOCKED.test(u.hostname)) return send(200, { ok: false, error: 'restricted_source', note: 'Social platforms can’t be read automatically. Enter the details by hand.' });

  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 7000);
  try {
    const r = await fetch(u.href, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'MorrMotoLinkReader/0.1 (+https://morrmoto.com/bot; single page, user-requested)', Accept: 'text/html,application/xhtml+xml' } });
    if (!r.ok) return send(200, { ok: false, error: 'fetch_failed', status: r.status });
    if (!/html/i.test(r.headers.get('content-type') || '')) return send(200, { ok: false, error: 'not_html' });
    const html = (await r.text()).slice(0, MAX);
    const events = extractJsonLd(html, u.href);
    if (events.length) {
      const today = new Date().toISOString().slice(0, 10);
      const e = events.find(x => x.start_date && x.start_date >= today) || events[0];
      return send(200, { ok: true, via: 'json-ld', fields: e, more: events.length - 1 });
    }
    const og = extractOpenGraph(html);
    return send(200, { ok: !!og.name, via: 'opengraph', fields: { name: og.name, description: og.description, image_url: og.image_url }, note: 'No structured event data on this page. Date, time and place weren’t stated, so we left them blank.' });
  } catch (e) {
    return send(200, { ok: false, error: e.name === 'AbortError' ? 'timeout' : 'fetch_error' });
  } finally { clearTimeout(t); }
}
