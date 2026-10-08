// MorrMoto adapter: iCalendar (RFC 5545) feeds. Pure parser + adapter wrapper.
const unfold = t => t.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
const unesc = s => s == null ? null : s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim() || null;

function dt(v) {
  if (!v) return { date: null, time: null };
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!m) return { date: null, time: null };
  // UTC ("Z") times are kept as stated and flagged; a server-side pass converts with the source's TZID.
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: m[4] ? `${m[4]}:${m[5]}` : null, utc: /Z$/.test(v) };
}

export function parseICS(text) {
  const lines = unfold(text).split('\n');
  const out = []; let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') { if (cur) out.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = line.indexOf(':'); if (i < 0) continue;
    const [name, ...params] = line.slice(0, i).split(';');
    cur[name.toUpperCase()] = { v: line.slice(i + 1), params };
  }
  return out.map(e => {
    const s = dt(e.DTSTART?.v), en = dt(e.DTEND?.v), status = e.STATUS?.v || '';
    return {
      name: unesc(e.SUMMARY?.v), description: unesc(e.DESCRIPTION?.v)?.slice(0, 600) || null,
      start_date: s.date, start_time: s.time, end_date: en.date && en.date !== s.date ? en.date : null, end_time: en.time,
      venue: unesc(e.LOCATION?.v), address: null, city: null,
      source_url: unesc(e.URL?.v), recurrence: e.RRULE?.v || null, uid: e.UID?.v || null,
      lifecycle: /CANCELLED/i.test(status) ? 'canceled' : null,
      flags: s.utc ? ['utc_time_needs_tz'] : [], evidence: 'iCalendar feed'
    };
  });
}

export const adapter = {
  key: 'ics', method: 'ics', automatable: 'yes',
  async run({ source, fetchText }) {
    return parseICS(await fetchText(source.feed_url || source.url)).map(e => ({ ...e, source_id: source.id, source_url: e.source_url || source.url }));
  }
};
