# MorrMoto build plan: Product Phase 01

*Oct 4, 2026. The brand and design system are locked (see `/system`). This plan covers the product only.*

## 1. Repository assessment

| Area | State | Notes |
|---|---|---|
| Brand + tokens | **Done** | `brand/tokens.css`, the Motion Mark SVGs and component, the wordmark, `/system` |
| Data model | **Done; extended today** | `db/schema.sql` (candidates kept separate from canonical events) plus `db/migrations/002_product_phase1.sql` |
| Engine | **Working, pure JS** | `engine/core.js`: recurrence, dedupe (title/date/venue/address/organizer/geo/URL), field conflicts, confidence → Verified / Likely / Needs Review / Rejected, coverage. Ports 1:1 to TS |
| Inventory | **Seed: manual capture** | `engine/data.js`: 26 real sources and 50 candidates, captured by hand on Oct 4 (no live crawling). Labelled in the UI |
| Adapters | **New today** | `engine/adapters/`: JSON-LD, ICS and RSS parsers (real, pure), registry, honest status per source |
| Link reader | **New today, live on Vercel only** | `api/read-link.js`: fetches one public page server-side, JSON-LD → fields, OpenGraph title fallback, SSRF guard, social platforms blocked |
| Consumer app | **Working** | Discover, This Weekend, Map, Event Detail, Add Event, Saved, and now **Search + combined filters**, map distance rings, save on every card |
| Admin | **Working** | Overview KPIs, review queue (approve / edit / reject / merge / mark duplicate / mark canceled), sources, coverage, engine tuning. Now on brand, with adapter + automation status |

## 2. Architecture
```
sources ──adapter.run()──► event_candidates (raw evidence, never edited)
                               │  engine: normalize → dedupe → confidence
                               ▼
                        events (canonical) ◄── event_sources (1 event : N records)
                               │  public_events view → trust_label (no scores exposed)
                               ▼
               consumer app  ·  admin review queue  ·  favorites
```
- **Runtime today:** static site + one serverless function. All state (saved events, area, prefs, submissions, reviewer actions) lives in localStorage and is labelled as such.
- **Runtime target:** Supabase (Postgres + PostGIS + RLS), the engine as a TS module in a scheduled job (Vercel Cron or Supabase Edge), and the read-link function writing into `submissions` → `event_candidates`.

## 3. Database (key tables)
`cities`, `regions`, `sources` (+ health, automation, failure_count, last_success_at, last_event_found_at), `source_checks`, `venues`, `organizers`, `categories`, `vehicle_types`, `recurrence_rules`, `event_candidates`, `events` (+ featured, worth_the_drive, ticket_url, primary_source_id, search tsvector), `event_sources`, `event_categories`, `event_vehicle_types`, `duplicate_suggestions`, `review_actions`, `submissions` (+ read_via, extracted, corrected), `users` (device id now, auth later), `favorites`, `engine_config`. View: `public_events` maps internal state to the consumer labels VERIFIED / RECENTLY CONFIRMED / COMMUNITY / UPDATED / CANCELED / POSTPONED / SOLD OUT.

## 4. Routes
`/` Discover · This Weekend · Map · Search · Saved, with Event Detail and Add Event as overlays (one app shell) · `/system` · `/admin` · `/map` (map frame) · `/api/read-link`

## 5. Components
One shell. **EventCard** is one markup with variants driven by data: row (compact), rail (no-image / standard), map list, featured, canceled (struck through, "Canceled"), just found (signal point), today (Ignition date block). The date block, distance, status line, save, the Motion Mark (loading, attribution, received) and the filter pill all reuse the same tokens.

## 6. Source adapters
Each source has exactly one replaceable adapter (`engine/adapters/index.js`):

| Adapter | Automatable | Use |
|---|---|---|
| `jsonld` | yes | Venue / organizer / Eventbrite-style pages with schema.org Event |
| `ics` | yes | Club and venue calendar feeds |
| `rss` | yes | Club and news feeds (no event date: needs a follow-up fetch or review) |
| `html:configured` | after ToS/robots review | Per-source selectors |
| `html:motorsportreg-venue` | with permission | Best track-day source: request API/calendar access |
| `social` | **no** | Instagram/Facebook: organizer outreach + community submissions |
| `manual-capture` · `community` | n/a | Today's seed data and submissions |

`scripts/discover.mjs` runs every automatable source, respects robots.txt, writes `out/candidates.json`, and never publishes.

## 7. Austin source strategy
Current: 26 real sources (COTA, Harris Hill, MotorsportReg, TNiA, SCCA, GTACC, Cowboy Harley, Car Cruise Finder, GetOutGarage, Community Impact and more). Next 15–25 to research: club calendars (Porsche Club Hill Country, BMW CCA Longhorn, Lone Star Corvettes, Austin Miata Club), Cars & Coffee organizers with sites, bike nights (Central Texas HOG, dealer calendars), off-road (Hidden Falls, Barnwell Mountain), karting (Austin Karting Club), and Eventbrite/Meetup via their APIs. Every addition will be verified and none invented.

## 8. Technical risks
- **Social is where many meets live** and can't be automated. Mitigation: link submissions, organizer outreach, recurring rules.
- **Recurring meets** are dated from schedules, so they score below explicit dates and say so in the detail view.
- **Geocoding:** venue table plus a geocoder (Mapbox or Google). Approximate pins are labelled today.
- **ToS/robots:** reviewed per source before any HTML adapter goes live.
- **Time zones:** ICS UTC times are flagged for conversion.

## 9. Buildable now vs. needs credentials
**Now (done or in this build):** search + filters, link reader (on Vercel), adapters, schema, admin health.
**Needs credentials:** Supabase project URL + service key, Mapbox/Google geocoding key, Eventbrite / Meetup API tokens, MotorsportReg access, a cron schedule on Vercel.

## 10. Sequence from here
1. Supabase: apply schema + 002, then seed from `engine/data.js`.
2. Port `engine/core.js` → TS and run it in a scheduled job.
3. Turn on the JSON-LD + ICS adapters for the sources marked *Ready to automate*.
4. Point submissions at the DB, so the admin review queue reads candidates instead of localStorage.
5. Geocoding + venue table.
6. Auth-backed favorites (device id → user).
7. Grow the source registry to 40–50, then run the coverage review.
8. Accessibility + performance QA pass.
