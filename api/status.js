// GET /api/status → is the daily job running? Last 7 runs + how many upcoming finds are stored. Aggregate numbers only.
import { configured, recentRuns, countUpcoming } from '../lib/db.js';
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
  const env = { database: configured(), search: !!process.env.BRAVE_API_KEY, cron_secret: !!process.env.CRON_SECRET };
  if (!configured()) return res.end(JSON.stringify({ ok: false, reason: 'database_not_configured', env }));
  try {
    const runs = await recentRuns(7), last = runs[0];
    const hrs = last ? Math.round((Date.now() - new Date(last.ran_at)) / 36e5) : null;
    res.end(JSON.stringify({ ok: true, healthy: hrs !== null && hrs <= 26 && !last.store_error, hours_since_last_run: hrs, upcoming_stored: await countUpcoming(new Date().toISOString().slice(0, 10)), env, runs }, null, 2));
  } catch (e) { res.end(JSON.stringify({ ok: false, reason: String(e.message || e), env })); }
}
