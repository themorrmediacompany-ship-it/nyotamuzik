## If the site shows raw {{ }} text or "We lost the signal"

Vercel is serving the files one folder too deep, for example at `/vercel/support.js` instead of `/support.js`. Fix it once and it stays fixed:
- Vercel → your project → Settings → Build and Deployment → **Root Directory** → type `vercel` → Save → redeploy.
- Or upload only the folder that directly contains `index.html`.

# MorrMoto, static preview build

Plain static site: no build step, no server, no database.

| Route | Page |
|---|---|
| `/` | Consumer app (Discover, Map, This Weekend, Saved, Add) |
| `/system` | Living design system |
| `/admin` | Discovery engine / review console |
| `/map` | Map frame used inside the app |
| `/api/read-link?url=` | Link reader (serverless). Fetches one public page and returns only what its schema.org Event data states |

## Deploy

**CLI**
```
npm i -g vercel
cd vercel
vercel        # preview
vercel --prod # production
```
Framework preset: **Other**. Build command: none. Output directory: `.` (the default).

**Dashboard:** push this folder to a GitHub repo, then go to vercel.com/new, import it, choose Framework **Other**, and deploy.

**Local:** `npx vercel dev` runs the site and the link reader. `npx serve .` serves the static pages only.

**Discovery runner:** `npm run discover` runs every source whose adapter can be automated today (JSON-LD / ICS / RSS), respects robots.txt, and writes `out/candidates.json`. Nothing gets published.

## What's real, what isn't
- Event data is the Phase 1 manual capture in `engine/data.js`: real sources and URLs, captured by hand. There's no live crawling yet.
- Saved events, area, preferences and submissions live in the visitor's localStorage. Nothing is sent to a server.
- The link reader works on the deployed site through `/api/read-link`. Without it (static preview), it only recognises URLs already in the capture.
- Runtime dependencies load from CDNs: React and Babel (unpkg), Leaflet, Phosphor icons and Google Fonts. The map uses CARTO dark tiles on OpenStreetMap, and attribution is kept.
- Fonts are stand-ins: Archivo Italic for the wordmark, Anton for Druk, Inter for Neue Haas Grotesk. JetBrains Mono is final.

## Next for production
Supabase (`db/schema.sql`), port the engine to TypeScript, scheduled discovery jobs, and a link reader on a serverless function.

## Turn on daily discovery (the self-updating part)

Vercel runs `/api/discover` every day at 6am Central (`vercel.json → crons`). It does three things:
- runs the source adapters
- searches the web for Austin-area motor events
- reads each result's event data and image, and stores what it finds

The app then loads those finds through `/api/events`, merges them with the seed capture, and runs the same dedupe and trust engine.

**Without these settings, the job runs but finds and stores nothing.** Set them in Vercel → Settings → Environment Variables:

| Variable | What it's for | Where to get it |
|---|---|---|
| `SUPABASE_URL` | Database URL | supabase.com → New project → Settings → API |
| `SUPABASE_SERVICE_KEY` | Server-side write key (keep it secret) | Same page, the "service_role" key |
| `BRAVE_API_KEY` | Daily web search | api.search.brave.com (free tier available) |
| `CRON_SECRET` | Stops strangers triggering the job | Any long random string |

Then, in the Supabase SQL editor, run these in order: `db/schema.sql`, `db/migrations/002_product_phase1.sql`, `003_images.sql`, `004_discovery.sql`.

To test it, open `/api/discover` (with the header `Authorization: Bearer <CRON_SECRET>`). The JSON shows what was found and stored, and which settings are missing.
