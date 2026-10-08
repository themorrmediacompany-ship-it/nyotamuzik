// MorrMoto adapter: RSS / Atom. Feeds announce posts, not event dates.
// Items become candidates WITHOUT a date (pubDate is when it was posted) and go to review or a follow-up page fetch.
const tag = (s, t) => { const m = s.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, 'i')); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null; };

export function parseRSS(xml) {
  const items = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) || [];
  return items.map(it => {
    const link = tag(it, 'link') || (it.match(/<link[^>]+href=["']([^"']+)/i) || [])[1] || null;
    return { name: tag(it, 'title'), description: tag(it, 'description') || tag(it, 'summary'), source_url: link,
      start_date: null, start_time: null, posted_at: tag(it, 'pubDate') || tag(it, 'updated'),
      flags: ['needs_date', 'follow_link'], evidence: 'RSS item (post date is not the event date)' };
  });
}

export const adapter = {
  key: 'rss', method: 'rss', automatable: 'yes',
  async run({ source, fetchText }) { return parseRSS(await fetchText(source.feed_url || source.url)).map(e => ({ ...e, source_id: source.id })); }
};
