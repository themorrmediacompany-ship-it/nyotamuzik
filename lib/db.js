// Minimal Supabase REST client for serverless functions (no SDK, no build step).
const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
export const configured = () => !!(URL_ && KEY);
// New-style secret keys (sb_secret_…) go in apikey only; legacy service_role JWTs (eyJ…) also need the Bearer header.
const h = extra => ({ apikey: KEY, ...(String(KEY).startsWith('eyJ') ? { Authorization: `Bearer ${KEY}` } : {}), 'Content-Type': 'application/json', ...extra });

export async function upsertCandidates(rows) {
  if (!configured() || !rows.length) return 0;
  const r = await fetch(`${URL_}/rest/v1/discovered_candidates?on_conflict=url,start_date`, { method: 'POST', headers: h({ Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(rows) });
  if (!r.ok) throw new Error('supabase upsert ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return rows.length;
}

export async function upcomingCandidates(today) {
  if (!configured()) return null;
  const r = await fetch(`${URL_}/rest/v1/discovered_candidates?select=*&start_date=gte.${today}&order=start_date.asc&limit=500`, { headers: h() });
  if (!r.ok) throw new Error('supabase select ' + r.status);
  return r.json();
}

export async function logRun(summary) {
  if (!configured()) return;
  try {
    const r = await fetch(`${URL_}/rest/v1/discovery_runs`, { method: 'POST', headers: h({ Prefer: 'return=minimal' }), body: JSON.stringify([summary]) });
    if (!r.ok) console.error('discovery_runs insert', r.status, (await r.text()).slice(0, 300));
  } catch (e) { console.error('discovery_runs insert', e); }
}

export async function recentRuns(n = 7) {
  if (!configured()) return null;
  const r = await fetch(`${URL_}/rest/v1/discovery_runs?select=*&order=ran_at.desc&limit=${n}`, { headers: h() });
  if (!r.ok) throw new Error('supabase runs ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

export async function countUpcoming(today) {
  if (!configured()) return null;
  const r = await fetch(`${URL_}/rest/v1/discovered_candidates?select=id&start_date=gte.${today}`, { method: 'HEAD', headers: h({ Prefer: 'count=exact' }) });
  return Number((r.headers.get('content-range') || '').split('/')[1]) || 0;
}

export async function deleteIds(ids) {
  if (!configured() || !ids.length) return 0;
  const r = await fetch(`${URL_}/rest/v1/discovered_candidates?id=in.(${ids.join(',')})`, { method: 'DELETE', headers: h({ Prefer: 'return=minimal' }) });
  if (!r.ok) throw new Error('supabase delete ' + r.status);
  return ids.length;
}
