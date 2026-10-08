// MorrMoto adapter: JSON-LD / schema.org Event extractor (+ conservative OpenGraph fallback).
// Pure functions. Runs in the browser, Node and Vercel functions. Never guesses: missing = null.
const EVENT_TYPES = /(^|:)(Event|SportsEvent|SocialEvent|ExhibitionEvent|Festival|BusinessEvent|EducationEvent|ComedyEvent|MusicEvent)$/;

const decode = s => s == null ? s : String(s)
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function flatten(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) { node.forEach(n => flatten(n, out)); return out; }
  out.push(node);
  if (node['@graph']) flatten(node['@graph'], out);
  return out;
}
const typeOf = n => [].concat(n['@type'] || []).map(String);
const isEvent = n => typeOf(n).some(t => EVENT_TYPES.test(t));
const first = v => Array.isArray(v) ? v[0] : v;

// ISO 8601 → { date, time } using the wall-clock time the source states (no timezone conversion).
export function splitDateTime(v) {
  if (!v || typeof v !== 'string') return { date: null, time: null };
  const m = v.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return { date: null, time: null };
  return { date: m[1], time: m[2] ? `${m[2]}:${m[3]}` : null };
}

function place(loc) {
  loc = first(loc);
  if (!loc) return {};
  if (typeof loc === 'string') return { venue: decode(loc) };
  const a = first(loc.address);
  const addr = typeof a === 'string' ? { street: decode(a) } : a ? { street: decode(a.streetAddress), city: decode(a.addressLocality), state: decode(a.addressRegion), postal: decode(a.postalCode) } : {};
  const g = loc.geo || {};
  const lat = g.latitude != null ? +g.latitude : null, lng = g.longitude != null ? +g.longitude : null;
  return { venue: decode(loc.name), address: addr.street || null, city: addr.city || null, state: addr.state || null, postal: addr.postal || null,
    latitude: Number.isFinite(lat) ? lat : null, longitude: Number.isFinite(lng) ? lng : null };
}

function offers(o) {
  const list = [].concat(o || []);
  if (!list.length) return {};
  const prices = list.map(x => x && x.price != null ? Number(String(x.price).replace(/[^0-9.]/g, '')) : null).filter(x => Number.isFinite(x));
  const cur = list.find(x => x && x.priceCurrency)?.priceCurrency || 'USD';
  const url = list.find(x => x && x.url)?.url || null;
  const avail = list.map(x => x && x.availability).filter(Boolean).join(' ');
  if (!prices.length) return { registration_url: url, sold_out: /SoldOut/i.test(avail) || null };
  const lo = Math.min(...prices), hi = Math.max(...prices);
  const sym = cur === 'USD' ? '$' : cur + ' ';
  return { price: hi === 0 ? 'Free' : lo === hi ? `${sym}${lo}` : `${sym}${lo}–${sym}${hi}`, free: hi === 0 ? true : lo > 0 ? false : null,
    registration_url: url, sold_out: /SoldOut/i.test(avail) || null };
}

export function eventFromJsonLd(n, pageUrl) {
  const s = splitDateTime(n.startDate), e = splitDateTime(n.endDate), p = place(n.location), o = offers(n.offers);
  const org = first(n.organizer);
  const status = String(n.eventStatus || '');
  return {
    name: decode(n.name) || null,
    description: decode(n.description)?.slice(0, 600) || null,
    start_date: s.date, start_time: s.time, end_date: e.date && e.date !== s.date ? e.date : null, end_time: e.time,
    venue: p.venue || null, address: p.address || null, city: p.city || null, state: p.state || null, latitude: p.latitude ?? null, longitude: p.longitude ?? null,
    organizer: org ? decode(typeof org === 'string' ? org : org.name) || null : null,
    price: o.price || null, free: n.isAccessibleForFree === true || n.isAccessibleForFree === 'True' ? true : (o.free ?? null),
    registration_url: o.registration_url || null,
    image_url: (() => { const i = first(n.image); return typeof i === 'string' ? i : i?.url || null; })(),
    lifecycle: /Cancelled/i.test(status) ? 'canceled' : /Postponed/i.test(status) ? 'postponed' : /Rescheduled/i.test(status) ? 'updated' : o.sold_out ? 'sold_out' : null,
    source_url: n.url || pageUrl || null,
    evidence: 'schema.org/Event JSON-LD on the page'
  };
}

export function extractJsonLd(html, pageUrl) {
  const out = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try { flatten(JSON.parse(m[1].trim())).filter(isEvent).forEach(n => out.push(eventFromJsonLd(n, pageUrl))); } catch (_) { /* malformed block: skip, never guess */ }
  }
  return out;
}

// OpenGraph gives a title/image only. Dates are never inferred from it.
export function extractOpenGraph(html) {
  const meta = k => { const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]+content=["']([^"']+)["']`, 'i')) || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${k}["']`, 'i')); return m ? decode(m[1]) : null; };
  const name = meta('og:title') || (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || null;
  return { name: name ? decode(name) : null, description: meta('og:description'), image_url: meta('og:image'), evidence: 'OpenGraph tags only (no structured event data)' };
}

export const adapter = {
  key: 'jsonld', method: 'structured_data', automatable: 'yes',
  async run({ source, fetchText }) {
    const html = await fetchText(source.url);
    return extractJsonLd(html, source.url).map(e => ({ ...e, source_id: source.id }));
  }
};
