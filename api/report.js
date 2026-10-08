// POST /api/report — corrections and organizer requests. Validated, rate-limited, honeypotted; stored for human review.
const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
const hits = new Map(); // per-instance rate limit: 6 per 10 minutes per IP
const REASONS = ['Wrong time','Wrong location','Canceled','Postponed','Duplicate','Event ended','Bad link','Not a motor event','Other','Update this event','Remove this event','Add official link or image','Contact','Takedown'];
const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').trim().slice(0, n);
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
  const out = (code, o) => { res.statusCode = code; res.end(JSON.stringify(o)); };
  if (req.method !== 'POST') return out(405, { ok: false, reason: 'method' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown', now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 6e5); if (list.length >= 6) return out(429, { ok: false, reason: 'rate_limited' });
  list.push(now); hits.set(ip, list);
  let b = req.body; if (typeof b === 'string') try { b = JSON.parse(b); } catch { b = null; }
  if (!b || typeof b !== 'object') return out(400, { ok: false, reason: 'bad_body' });
  if (b.hp) return out(200, { ok: true }); // honeypot: pretend success
  const reason = clean(b.reason, 60), kind = ['correction', 'organizer', 'contact'].includes(b.kind) ? b.kind : 'correction';
  const email = clean(b.email, 200);
  if (!REASONS.includes(reason)) return out(400, { ok: false, reason: 'bad_reason' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return out(400, { ok: false, reason: 'bad_email' });
  if ((kind === 'organizer' || kind === 'contact') && !email) return out(400, { ok: false, reason: 'email_required' });
  const row = { kind, reason, event_id: clean(b.event_id, 80) || null, event_title: clean(b.event_title, 200) || null, note: clean(b.note, 600) || null, email: email || null, page: clean(b.page, 200) || null, status: 'open', ip_hash: await hash(ip) };
  if (!URL_ || !KEY) { console.log('[report]', JSON.stringify(row)); return out(200, { ok: true, stored: 'log' }); }
  try {
    const r = await fetch(URL_ + '/rest/v1/event_reports', { method: 'POST', headers: { apikey: KEY, ...(String(KEY).startsWith('eyJ') ? { Authorization: 'Bearer ' + KEY } : {}), 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(row) });
    if (!r.ok) { console.error('[report] store failed', r.status, (await r.text()).slice(0, 200)); console.log('[report]', JSON.stringify(row)); }
    return out(200, { ok: true });
  } catch (e) { console.error('[report] error', String(e)); console.log('[report]', JSON.stringify(row)); return out(200, { ok: true, stored: 'log' }); }
}
async function hash(s) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('mm:' + s)); return [...new Uint8Array(d)].slice(0, 8).map(x => x.toString(16).padStart(2, '0')).join(''); }
