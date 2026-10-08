# MorrMoto Launch Readiness: Launch Candidate 01
Assessed 2026-10-04 from the repository and the in-editor build. **Production was not inspected in this pass.** Everything below marked "not verified on production" needs a check on www.morrmoto.com after deploy.

## Overall status: ALPHA READY
The product works end to end and the trust foundations exist. It is not ready for a public beta: inventory is thin (8 published events), coverage has never been measured, and production hasn't been tested on a real phone after the last several deploys.

| Area | Result |
|---|---|
| Product | PASS. All V1 surfaces exist: What's Moving, Nearby, This Weekend, Find, Event detail, Saved, Add an event, How it works, Report/correct, Organizer request |
| Mobile | NOT VERIFIED. Built mobile-first; no pass at 320/375/390/393/430 on a real device since the latest changes |
| Event coverage | NOT MEASURABLE YET |
| Event accuracy | NOT MEASURABLE YET |
| Source health | FAIL. Admin shows sources and last-checked dates from the seed capture. Live adapter failures, stale-source alerts and cron failures aren't surfaced |
| Trust | PASS with gaps. Source links, "From the source", freshness, reports and organizer requests are in place. There's no admin queue for reports yet (they're stored in Supabase/logs) |
| Imagery | FAIL for launch polish. No licensed photography. Event-page images credited, branded fallbacks only |
| Light mode | PASS (calculated contrast). One orange per theme: #FF4A00 dark, #B23600 light |
| Dark mode | PASS |
| Accessibility | PARTIAL. Automated scan passed earlier. Keyboard-only and screen-reader passes not done |
| Performance | NOT MEASURED. No Lighthouse/field data. support.js + inline engine load on first paint |
| SEO | PASS on paper. Title/meta/canonical/OG, robots.txt, sitemap, server-rendered /events, /austin, category and weekend pages, Event JSON-LD. Not verified on production |
| Analytics | PASS. Vercel Web Analytics plus /api/track events (incl. report/owner). Events are only in logs until a store is added |
| Security | PARTIAL. Server-side validation, honeypot, per-instance rate limit on /api/report. The rate limit isn't shared across instances. /api/read-link and Add Event have no rate limit |
| Legal / trust pages | REQUIRES REVIEW. Privacy, Terms, Contact + takedowns drafted in plain language and marked for legal review |

## Launch metrics
- **Coverage:** NOT MEASURABLE YET. Needs a manual ground-truth list for one Austin weekend (see method below).
- **Accuracy:** NOT MEASURABLE YET. Needs that same list checked field by field (date, time, venue, cost).
- **Duplicates:** the engine holds Likely events with open duplicate questions, so published unresolved duplicates = 0 by rule. Real-world duplicate rate is unmeasured.
- **Freshness:** seed events were all checked 2026-10-04. Live-feed freshness isn't measurable until the cron has run for a week.
- **Broken sources:** not measurable. Adapter run results aren't persisted per source.
- Active sources: 37 listed. Upcoming published events (30 days): 8. This weekend: 1. Awaiting review: about 20 "Needs Review" in the seed run. Conflicts: shown in /admin.

### Ground-truth method (run before beta)
1. Pick a weekend. Before looking at MorrMoto, list every legitimate event from: COTA, Harris Hill, MotorsportReg (Austin), SCCA Texas Region, Austin Cars & Coffee/club pages, 3 bike-night venues, Facebook events search "Austin car show", Eventbrite "Austin car".
2. Record each event's name, date, start time, venue, cost.
3. Compare with MorrMoto's published list: found / missed / unique finds / false positives / duplicates / wrong details / stale.
4. Coverage = found ÷ total known. Accuracy = correct critical fields ÷ checked. Keep MorrMoto's unique finds out of the denominator unless they're verified legitimate.

## P0: blocks public launch
1. **Inventory.** 8 events doesn't deliver "I didn't know all this was happening." Confirm the cron is running and adding legitimate events daily, then run the ground-truth weekend.
2. **Production inspection.** Load www.morrmoto.com on a phone in light and dark mode. Check what view-source shows (no raw {{ }} visible), /events/…, /austin/this-weekend, /sitemap.xml, /robots.txt, /how-it-works.
3. **Run db/migrations/005_reports.sql** so reports are stored, not just logged.

## P1: before launch
- Admin queue for event_reports (open/resolve) and organizer email verification.
- Source-health panel: per-adapter last success, failure count, events found per run; alert when the cron fails or a primary source returns 0.
- Rate limiting shared across instances (Supabase or Vercel KV) on /api/report, /api/read-link, Add Event.
- Keyboard and VoiceOver pass on detail panel, sheets, map; focus trapping in sheets.
- Nearby: explicit Map/List switch on mobile.
- ///. progression during Add Event link reading.
- Legal review of Privacy/Terms; decide whether analytics consent is needed for your audience.
- Lighthouse on mobile (target LCP < 2.5s on 4G).

## P2: shortly after
- Venue and organizer pages once 3+ events per venue/organizer exist.
- Georgetown / Round Rock city pages when inventory supports them.
- Persist /api/track events to a table; analytics dashboard.
- Licensed photography for top categories; more fallback compositions.
- Update /system with the report sheet, trust pages and the final light-mode orange.

## P3: future
- Organizer self-serve updates, additional cities, notifications for saved events.

## Changed in this pass
- Mobile bottom nav is now 4 tabs (What's Moving, Nearby, This Weekend, Saved). Find and Add an event moved to the header.
- Every event: **Something wrong?** (wrong time/location, canceled, postponed, duplicate, ended, bad link, not a motor event, other) and **This is my event** (update / remove / add official link, email required).
- /api/report: validation, sanitizing, honeypot, rate limit, stored in event_reports (migration 005) or logged.
- New server-rendered pages: /how-it-works, /privacy, /terms, /contact (with takedown form).
- noindex on /system, /admin, /direction (meta + X-Robots-Tag).
