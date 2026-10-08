// MorrMoto source-adapter registry.
// Every source maps to ONE replaceable adapter. No universal scraper.
//
// Contract (all adapters):
//   key          string  unique id
//   method       'api'|'rss'|'ics'|'structured_data'|'public_html'|'search_discovery'|'manual'|'community_submission'
//   automatable  'yes' | 'with-permission' | 'no'
//   run({ source, fetchText }) -> Promise<CandidateDraft[]>   (fetchText is injected: server-side, robots-aware)
// A CandidateDraft uses the extraction field names from db/schema.sql. Unknown = null. Never guessed.

import { adapter as jsonld } from './jsonld.js';
import { adapter as ics } from './ics.js';
import { adapter as rss } from './rss.js';

const manual = { key: 'manual-capture', method: 'manual', automatable: 'no',
  async run() { throw new Error('Manual capture: records are entered by a researcher (engine/data.js). Not fetched.'); } };
const community = { key: 'community', method: 'community_submission', automatable: 'no',
  async run() { throw new Error('Community submissions arrive via /api/read-link and the Add Event form.'); } };
const htmlConfigured = { key: 'html:configured', method: 'public_html', automatable: 'with-permission',
  async run() { throw new Error('Needs a per-source selector config and a ToS/robots review before it can run.'); } };
const msr = { key: 'html:motorsportreg-venue', method: 'public_html', automatable: 'with-permission',
  async run() { throw new Error('MotorsportReg: request calendar/API access. Until then, entries are captured by hand.'); } };
const social = { key: 'social', method: 'search_discovery', automatable: 'no',
  async run() { throw new Error('Instagram/Facebook: no permitted automated access. Use community submissions + organizer outreach.'); } };

export const ADAPTERS = Object.fromEntries([jsonld, ics, rss, manual, community, htmlConfigured, msr, social].map(a => [a.key, a]));

// Phase 1 assignment for each source in engine/data.js, based on its recorded access method.
// `status` is honest: today every source is still captured by hand.
export function adapterFor(src) {
  const m = (src.method || '').toLowerCase(), u = src.url || '';
  if (/instagram|facebook/.test(u) || /social/.test(m)) return { key: 'social', status: 'restricted', next: 'Organizer outreach + community submissions' };
  if (/motorsportreg/.test(u)) return { key: 'html:motorsportreg-venue', status: 'awaiting-permission', next: 'Request MSR calendar/API access' };
  if (/\bics\b|ical/.test(m)) return { key: 'ics', status: 'ready-to-automate', next: 'Point at the feed URL' };
  if (/rss/.test(m)) return { key: 'rss', status: 'ready-to-automate', next: 'Add follow-link page fetch for dates' };
  if (/structured|json-ld|jsonld/.test(m)) return { key: 'jsonld', status: 'ready-to-automate', next: 'Verify JSON-LD on the live page' };
  if (/html/.test(m)) return { key: 'html:configured', status: 'needs-config', next: 'Write selectors + ToS/robots review' };
  return { key: 'manual-capture', status: 'manual', next: 'Find a feed or structured page' };
}

export const STATUS_LABEL = {
  'ready-to-automate': 'Ready to automate', 'needs-config': 'Needs adapter config', 'awaiting-permission': 'Awaiting permission',
  restricted: 'Restricted', manual: 'Manual only'
};
