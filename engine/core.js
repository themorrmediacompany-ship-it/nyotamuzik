// MorrMoto Discovery Engine — deterministic core.
// Pure functions. The same logic ports 1:1 to the TypeScript server pipeline.

export const TAXONOMY = {
  vehicle: ['Cars','Motorcycles','Trucks','Off-road','Classics','Exotics','JDM','Euro','American','EV','Mixed'],
  event: ['Meet','Cars & Coffee','Bike Night','Group Ride','Cruise','Show','Race','Track Day','Autocross','Drag','Karting','Off-road','Rally','Course','Swap Meet','Dealer Event','Club Event','Major Motorsport','Driving Experience','Other'],
  regions: ['Georgetown','Round Rock','Hutto','Cedar Park / Leander','Pflugerville','Austin','South Austin','Buda / Kyle','Worth the Drive']
};

export const DEFAULT_CFG = { verified: 0.80, likely: 0.60, autoMerge: 0.78, possibleDup: 0.50, minIndependent: 2 };

const CITY_REGION = { georgetown:'Georgetown','round rock':'Round Rock',hutto:'Hutto','cedar park':'Cedar Park / Leander',leander:'Cedar Park / Leander',pflugerville:'Pflugerville',austin:'Austin','del valle':'Austin',buda:'Buda / Kyle',kyle:'Buda / Kyle','san marcos':'Worth the Drive',burnet:'Worth the Drive','marble falls':'Worth the Drive','dripping springs':'Worth the Drive' };
export const regionOf = x => x.region || (x.city ? (CITY_REGION[x.city.toLowerCase()] || 'Out of region') : 'Unknown');

const D = s => new Date(s + 'T12:00:00Z');
const ISO = d => d.toISOString().slice(0, 10);
const DAY = 864e5;

export function expandRecurrence(r, start, end) {
  const s = D(start), e = D(end), out = [];
  for (let i = -1; i < 4; i++) {
    const y = s.getUTCFullYear(), m = s.getUTCMonth() + i;
    const first = new Date(Date.UTC(y, m, 1, 12));
    const off = (r.weekday - first.getUTCDay() + 7) % 7;
    for (const n of r.nth) {
      const d = new Date(Date.UTC(y, m, 1 + off + (n - 1) * 7, 12));
      if (d.getUTCMonth() === first.getUTCMonth() && d >= s) out.push(ISO(d));
    }
  }
  out.sort();
  const inWin = out.filter(d => D(d) <= e);
  return inWin.length ? { dates: inWin, beyond: false } : { dates: out.slice(0, 1), beyond: true };
}

const STOP = new Set(['the','a','of','at','in','and','monthly','annual','tx','texas','2025','2026','@','—','-','&']);
export const tokens = s => (s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(t => t && !STOP.has(t));
const bigrams = s => { const t = tokens(s).join(' '), b = new Set(); for (let i = 0; i < t.length - 1; i++) b.add(t.slice(i, i + 2)); return b; };
const jacc = (a, b) => { const A = new Set(a), B = new Set(b); if (!A.size || !B.size) return 0; let i = 0; A.forEach(x => B.has(x) && i++); return i / (A.size + B.size - i); };
const dice = (a, b) => { const A = bigrams(a), B = bigrams(b); if (!A.size || !B.size) return 0; let i = 0; A.forEach(x => B.has(x) && i++); return 2 * i / (A.size + B.size); };
export const textSim = (a, b) => Math.max(jacc(tokens(a), tokens(b)), dice(a, b));
const addrKey = a => { if (!a) return null; const n = (a.match(/\d+/) || [''])[0]; const w = tokens(a.replace(/baghdad/i, 'bagdad')).filter(t => !/^\d+$/.test(t) && !['rd','road','ave','st','w','e','s','n','frontage','interstate','i'].includes(t))[0] || ''; return n + ' ' + w; };

export function buildOccurrences(cands, sources, win) {
  const S = Object.fromEntries(sources.map(s => [s.id, s]));
  const out = [];
  for (const c of cands) {
    const e = c.extracted, src = S[c.source_id];
    const base = { cid: c.id, cand: c, src, url: c.url, ...e, title: e.event_name || c.raw_title, region: regionOf(e) };
    if (e.start_date) out.push({ ...base, oid: c.id, date: e.start_date, end: e.end_date || e.start_date, dateBasis: 'explicit' });
    else if (c.recurrence) {
      const { dates, beyond } = expandRecurrence(c.recurrence, win.start, win.end);
      dates.forEach(d => out.push({ ...base, oid: c.id + '@' + d, date: d, end: d, beyond, dateBasis: c.recurrence.inferred ? 'pattern-inferred' : 'recurrence-stated' }));
    } else out.push({ ...base, oid: c.id, date: null, end: null, dateBasis: 'missing' });
  }
  return out;
}

export function pairScore(a, b) {
  if (a.cid === b.cid) return null;
  if (a.date && b.date) {
    const gap = Math.max(D(a.date) - D(b.end), D(b.date) - D(a.end)) / DAY;
    if (gap > 1) return null;
  }
  const undatedPair = !!a.date !== !!b.date;
  const sig = [];
  const add = (k, w, v, note) => sig.push({ k, w, v, note });
  if (a.url === b.url && a.date === b.date && a.title === b.title) add('url', 1, 1, 'Same URL');
  add('title', 0.45, textSim(a.title, b.title));
  if (a.date && b.date) { const ov = !(D(a.date) > D(b.end) || D(b.date) > D(a.end)); add('date', 0.2, ov ? 1 : 0.5, ov ? 'Dates overlap' : 'Adjacent day'); }
  const va = [a.venue, a.street_address].filter(Boolean).join(' '), vb = [b.venue, b.street_address].filter(Boolean).join(' ');
  if (va && vb) add('venue', 0.2, Math.max(textSim(va, vb), addrKey(a.street_address) && addrKey(a.street_address) === addrKey(b.street_address) ? 1 : 0));
  else if (a.city && b.city) add('city', 0.1, a.city.toLowerCase() === b.city.toLowerCase() ? 0.7 : 0);
  if (a.organizer && b.organizer) add('organizer', 0.1, textSim(a.organizer, b.organizer));
  if (a.start_time && b.start_time) add('time', 0.05, a.start_time === b.start_time ? 1 : 0);
  if (sig.some(s => s.k === 'url')) return { score: 0.97, sig };
  const w = sig.reduce((t, s) => t + s.w, 0), v = sig.reduce((t, s) => t + s.w * s.v, 0);
  let score = Math.round(v / w * 100) / 100;
  if (undatedPair) { if (score < 0.75) return null; score = Math.min(score, 0.7); sig.push({ k: 'undated', w: 0, v: 0, note: 'One record has no date — suggestion only, never auto-merged' }); }
  return { score, sig };
}

function resolve(field, occs) {
  const votes = {};
  for (const o of occs) {
    const v = o[field]; if (v == null || v === '') continue;
    const k = field === 'street_address' ? addrKey(v) : String(v).toLowerCase();
    (votes[k] ??= { v, w: 0, srcs: [] }); votes[k].w += o.src.reliability * (o.src.corroborationOnly ? 0.5 : 1); votes[k].srcs.push(o.src.name);
  }
  const arr = Object.values(votes).sort((a, b) => b.w - a.w);
  return { value: arr[0]?.v ?? null, from: arr[0]?.srcs ?? [], options: arr };
}

const independentDomains = occs => new Set(occs.map(o => o.src.publisher || new URL(o.url).hostname.replace(/^www\./, '').split('.').slice(-2).join('.'))).size;

export function confidence(ev) {
  const b = [], add = (label, v) => b.push({ label, v: Math.round(v * 100) / 100 });
  const occ = ev.occs, rel = Math.max(...occ.map(o => o.src.corroborationOnly ? o.src.reliability * 0.5 : o.src.reliability));
  add('Source reliability (best)', 0.30 * rel);
  const basis = occ.some(o => o.dateBasis === 'explicit') ? 'explicit' : occ.some(o => o.dateBasis === 'recurrence-stated') ? 'stated' : occ.some(o => o.dateBasis === 'pattern-inferred') ? 'inferred' : 'none';
  add({ explicit: 'Explicit dated listing', stated: 'Date from stated recurrence', inferred: 'Date from engine-inferred pattern', none: 'No date' }[basis], { explicit: 0.15, stated: 0.07, inferred: 0.02, none: 0 }[basis]);
  add(ev.f.street_address ? 'Street address' : ev.f.venue ? 'Venue named (no address)' : ev.f.city ? 'City only' : 'No location', ev.f.street_address ? 0.12 : ev.f.venue ? 0.07 : ev.f.city ? 0.03 : 0);
  add(ev.f.organizer ? 'Organizer identified' : 'Organizer unknown', ev.f.organizer ? 0.08 : 0);
  const keys = ['start_time','end_date','venue','organizer','registration_required'], have = keys.filter(k => ev.f[k] != null).length;
  add(`Completeness ${have}/${keys.length}`, 0.10 * have / keys.length);
  const ind = ev.independent;
  add(`${ind} independent source${ind > 1 ? 's' : ''}`, ind >= 3 ? 0.15 : ind === 2 ? 0.10 : 0);
  const ages = occ.map(o => o.cand.page_age_days).filter(x => x != null), age = ages.length ? Math.min(...ages) : null;
  add(age == null ? 'Freshness unknown' : `Freshest evidence ${age}d old`, age == null ? 0.03 : age <= 30 ? 0.10 : age <= 120 ? 0.06 : age <= 365 ? 0.03 : 0);
  add('Re-verification (not yet run)', 0);
  if (ev.conflicts.length) add(`${ev.conflicts.length} field conflict${ev.conflicts.length > 1 ? 's' : ''}`, -Math.min(0.24, 0.12 * ev.conflicts.length));
  if (ev.flags.includes('unusual_weekday')) add('Unusual weekday for event type', -0.10);
  if (ev.flags.includes('source_internal_conflict')) add('Source contradicts itself', -0.10);
  if (!ev.f.city) add('Location missing', -0.15);
  const score = Math.max(0, Math.min(1, b.reduce((t, x) => t + x.v, 0)));
  return { score: Math.round(score * 100) / 100, breakdown: b, basis };
}

export function run(data, cfg = DEFAULT_CFG, ov = {}) {
  const { SOURCES, CANDIDATES, WINDOW } = data;
  const occs = buildOccurrences(CANDIDATES, SOURCES, WINDOW);
  const idx = Object.fromEntries(occs.map((o, i) => [o.oid, i]));
  const parent = occs.map((_, i) => i), find = i => parent[i] === i ? i : (parent[i] = find(parent[i])), uni = (a, b) => { parent[find(a)] = find(b); };
  const sep = new Set((ov.separate || []).map(p => p.slice().sort().join('|')));
  const pairs = [];
  for (let i = 0; i < occs.length; i++) for (let j = i + 1; j < occs.length; j++) {
    const r = pairScore(occs[i], occs[j]); if (!r || r.score < cfg.possibleDup) continue;
    const key = [occs[i].oid, occs[j].oid].sort().join('|');
    if (sep.has(key)) continue;
    pairs.push({ a: occs[i].oid, b: occs[j].oid, ...r });
    if (r.score >= cfg.autoMerge) uni(i, j);
  }
  // Same candidate never merges with itself across dates; forced merges from reviewers:
  (ov.merge || []).forEach(([a, b]) => idx[a] != null && idx[b] != null && uni(idx[a], idx[b]));

  const groups = {};
  occs.forEach((o, i) => (groups[find(i)] ??= []).push(o));
  const today = D(WINDOW.start), wEnd = D(WINDOW.end);
  const events = Object.values(groups).map(g => {
    g.sort((x, y) => y.src.reliability - x.src.reliability);
    const id = g.map(o => o.oid).sort()[0];
    const f = {}, conflicts = [];
    ['title','date','end','start_time','end_time','venue','street_address','city','organizer','registration_required','registration_url','price','free','family_friendly','latitude','longitude'].forEach(k => {
      const r = resolve(k, g); f[k] = r.value; f['_' + k] = r.from;
      if (['date','start_time','street_address'].includes(k) && r.options.length > 1) conflicts.push({ field: k, options: r.options.map(o => ({ v: o.v, srcs: o.srcs })) });
    });
    const edit = ov.edits?.[id]; if (edit) Object.entries(edit).forEach(([k, v]) => { if (v !== '' && v != null) { f[k] = v; f['_' + k] = ['Reviewer edit']; } });
    f.region = regionOf(f.region ? f : { ...f, region: g.find(o => o.cand.extracted.region)?.cand.extracted.region });
    const uniq = arr => [...new Set(arr)];
    const ev = { id, occs: g, f, conflicts: edit ? conflicts.filter(c => !(c.field in edit)) : conflicts,
      event_type: uniq(g.flatMap(o => o.event_type || [])), vehicle_type: uniq(g.flatMap(o => o.vehicle_type || [])),
      flags: uniq(g.flatMap(o => o.cand.flags || [])), independent: independentDomains(g), beyond: g.every(o => o.beyond) };
    if (f.date && ev.event_type.some(t => ['Show','Cars & Coffee'].includes(t)) && [1,2,3,4].includes(D(f.date).getUTCDay()) && !ev.event_type.includes('Bike Night')) ev.flags.push('unusual_weekday');
    if (f.date && D(f.date) > wEnd) ev.beyond = true;
    const c = confidence(ev); ev.score = c.score; ev.breakdown = c.breakdown; ev.basis = c.basis;
    const primaryExplicit = g.some(o => o.src.primary && o.dateBasis === 'explicit');
    const o = ov.actions?.[id];
    let state, reason, lifecycle = 'Active';
    if (g.every(x => x.motorized === false)) [state, reason] = ['Rejected', 'Not motor culture'];
    else if (f.region === 'Out of region') [state, reason] = ['Rejected', 'Outside coverage area'];
    else if (f.date && D(f.end || f.date) < today) [state, reason, lifecycle] = ['Rejected', 'Expired / stale listing', 'Expired'];
    else if (g.every(x => x.src.corroborationOnly)) [state, reason] = ['Needs Review', 'Reference source only — needs a primary listing'];
    else if (!f.date) [state, reason] = ['Needs Review', 'No date found'];
    else if (ev.conflicts.length) [state, reason] = ['Needs Review', 'Conflicting ' + ev.conflicts.map(c => c.field.replace('_', ' ')).join(', ')];
    else if (ev.flags.includes('commercial')) [state, reason] = ['Needs Review', 'Commercial experience — confirm relevance'];
    else if (ev.flags.includes('unusual_weekday')) [state, reason] = ['Needs Review', 'Unusual weekday — possible bad date'];
    else if (!f.city) [state, reason] = ['Needs Review', 'Location missing'];
    else if (ev.score >= cfg.verified && (ev.independent >= cfg.minIndependent || primaryExplicit)) [state, reason] = ['Verified', ev.independent >= cfg.minIndependent ? `${ev.independent} independent sources agree` : 'Trusted primary source, explicit date'];
    else if (primaryExplicit && ev.score >= cfg.likely) [state, reason] = ['Verified', 'Trusted primary source, explicit date'];
    else if (ev.score >= cfg.likely) [state, reason] = ['Likely', 'High confidence, not independently verified'];
    else [state, reason] = ['Needs Review', 'Confidence below threshold'];
    if (o?.action === 'approve') [state, reason] = ['Verified', 'Approved by reviewer'];
    if (o?.action === 'reject') [state, reason] = ['Rejected', 'Rejected by reviewer'];
    if (o?.action === 'cancel') { lifecycle = 'Canceled'; reason = 'Marked canceled by reviewer'; }
    Object.assign(ev, { state, reason, lifecycle, reviewed: !!o });
    return ev;
  });

  const evOf = Object.fromEntries(events.flatMap(e => e.occs.map(o => [o.oid, e.id])));
  const dupes = pairs.filter(p => evOf[p.a] !== evOf[p.b]).map(p => ({ ...p, ea: evOf[p.a], eb: evOf[p.b] }));
  const seen = new Set(), possibleDupes = dupes.filter(p => { const k = [p.ea, p.eb].sort().join('|'); if (seen.has(k)) return false; seen.add(k); return true; });
  const merged = pairs.filter(p => evOf[p.a] === evOf[p.b]);
  events.forEach(e => { e.dupes = possibleDupes.filter(p => p.ea === e.id || p.eb === e.id).map(p => ({ other: p.ea === e.id ? p.eb : p.ea, score: p.score, sig: p.sig, a: p.a, b: p.b })); });
  events.sort((a, b) => (a.f.date || '9999').localeCompare(b.f.date || '9999'));

  const answer = events.filter(e => !e.beyond && e.f.date && ['Verified', 'Likely'].includes(e.state) && e.lifecycle !== 'Canceled');
  return { occs, events, pairs, merged, possibleDupes, answer };
}

export function coverage(evs) {
  const count = (list, key) => list.map(k => ({ label: k, value: evs.filter(e => key(e).includes(k)).length }));
  return {
    vehicle: count(TAXONOMY.vehicle, e => e.vehicle_type),
    event: count(TAXONOMY.event, e => e.event_type),
    region: count(TAXONOMY.regions, e => [e.f.region])
  };
}
