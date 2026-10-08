// Discovery runner (Node 18+). `node scripts/discover.mjs [sourceId ...]`
// Runs every source whose adapter is automatable today, respecting robots.txt, and writes out/candidates.json.
// It does NOT publish: candidates feed engine/core.js (dedupe + confidence) and the admin review queue.
import { writeFile, mkdir } from 'node:fs/promises';
import { SOURCES } from '../engine/data.js';
import { ADAPTERS, adapterFor } from '../engine/adapters/index.js';

const UA = 'MorrMotoBot/0.1 (+https://morrmoto.com/bot)';
const robotsCache = new Map();
async function allowed(url) {
  const u = new URL(url), key = u.origin;
  if (!robotsCache.has(key)) {
    let rules = [];
    try { const t = await (await fetch(key + '/robots.txt', { headers: { 'User-Agent': UA } })).text(); let on = false;
      for (const l of t.split('\n')) { const [k, ...v] = l.split(':'); const val = v.join(':').trim(); if (/^user-agent$/i.test(k.trim())) on = val === '*' || /morrmoto/i.test(val); else if (on && /^disallow$/i.test(k.trim()) && val) rules.push(val); } } catch {}
    robotsCache.set(key, rules);
  }
  return !robotsCache.get(key).some(p => u.pathname.startsWith(p));
}
const fetchText = async url => { if (!(await allowed(url))) throw new Error('robots.txt disallows ' + url); const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); };

const only = process.argv.slice(2);
const checks = [], candidates = [];
for (const s of SOURCES.filter(s => !only.length || only.includes(s.id))) {
  const a = adapterFor(s), ad = ADAPTERS[a.key], started = new Date().toISOString();
  if (ad.automatable !== 'yes') { checks.push({ source_id: s.id, adapter: a.key, status: a.status, skipped: true, reason: a.next, started }); continue; }
  try { const found = await ad.run({ source: s, fetchText }); candidates.push(...found.map(c => ({ ...c, discovered_at: started, last_checked_at: started, adapter: a.key })));
    checks.push({ source_id: s.id, adapter: a.key, started, finished: new Date().toISOString(), items_found: found.length }); }
  catch (e) { checks.push({ source_id: s.id, adapter: a.key, started, error: String(e.message || e) }); }
}
await mkdir('out', { recursive: true });
await writeFile('out/candidates.json', JSON.stringify({ ran_at: new Date().toISOString(), checks, candidates }, null, 2));
console.log(`checked ${checks.length} sources · ${candidates.length} candidates · ${checks.filter(c => c.skipped).length} skipped (not automatable yet)`);
