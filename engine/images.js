// MorrMoto image selection + delivery. Pure, framework-free.
// Priority for a REAL event: event/organizer source → venue/organizer first-party → MorrMoto graphic fallback.
// Licensed/editorial library images are for category + editorial moments only. They are never attached to a specific event.
export const WIDTHS = [320, 480, 640, 960, 1280, 1600, 1920];
const PRODUCT_USAGE = new Set(['event-source', 'venue', 'licensed-editorial', 'morrmoto-editorial']);

export function imageForEvent(ev, lib = []) {
  const ok = i => i && PRODUCT_USAGE.has(i.usage);
  const own = lib.find(i => ok(i) && i.usage === 'event-source' && i.event_id === ev.id);
  if (own) return { kind: 'photo', image: own };
  const venue = lib.find(i => ok(i) && i.usage === 'venue' && (i.venue_id && i.venue_id === ev.venue_id || i.organizer_id && i.organizer_id === ev.organizer_id));
  if (venue) return { kind: 'photo', image: venue, note: 'Venue photo, not from this event' };
  return { kind: 'fallback', variant: fallbackVariant(ev.id) };
}

// Editorial/category imagery: rotate across the library so repeat sessions don't show the same five photos.
export function editorialFor(tag, lib = [], seed = 0) {
  const pool = lib.filter(i => PRODUCT_USAGE.has(i.usage) && i.usage !== 'event-source' && (i.categories || []).concat(i.places || []).includes(tag));
  return pool.length ? pool[seed % pool.length] : null;
}

// Four fallback compositions, stable per event.
export function fallbackVariant(id = '') {
  let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ['date', 'route', 'coords', 'type'][h % 4];
}

// Responsive delivery through Vercel Image Optimization (AVIF/WebP negotiated automatically).
// Local paths and allow-listed remote hosts only (vercel.json → images).
export function srcset(path, { ratio = '4/3', sizes = '(max-width: 640px) 100vw, 50vw', q = 70, max = 1920 } = {}) {
  const enc = encodeURIComponent(path.startsWith('http') ? path : '/' + path.replace(/^\//, ''));
  const ws = WIDTHS.filter(w => w <= max);
  return {
    src: `/_vercel/image?url=${enc}&w=${ws[Math.min(2, ws.length - 1)]}&q=${q}`,
    srcSet: ws.map(w => `/_vercel/image?url=${enc}&w=${w}&q=${q} ${w}w`).join(', '),
    sizes, style: `aspect-ratio:${ratio};object-fit:cover;width:100%;height:auto`, loading: 'lazy', decoding: 'async'
  };
}

export const objectPosition = i => `${Math.round((i.focal_x ?? 0.5) * 100)}% ${Math.round((i.focal_y ?? 0.5) * 100)}%`;

// Coverage QA: counts per tag vs targets, so bias and gaps are visible.
export function coverage(lib, targets) {
  const usable = lib.filter(i => PRODUCT_USAGE.has(i.usage));
  const count = (key, list) => list.map(t => ({ tag: t, n: usable.filter(i => (i[key] || []).includes(t)).length }));
  return { usable: usable.length, total: lib.length, categories: count('categories', targets.categories), places: count('places', targets.places), times: count('times', targets.times) };
}
