// POST /api/track — product metrics beacon. Until Supabase is connected, events land in Vercel function logs.
export default async function handler(req, res) {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 4000) break; }
  try { const e = JSON.parse(body); console.log('[mm-metric]', JSON.stringify({ name: String(e.name).slice(0, 40), id: e.id || null, sid: e.sid || null, at: e.at || new Date().toISOString(), props: e })); } catch (_) {}
  res.statusCode = 204; res.end();
}
