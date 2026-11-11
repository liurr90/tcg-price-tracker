const cron = require('node-cron');
const { updatePrices } = require('./pricing/priceUpdater');
const db = require('./db');

let isRunning = false;
let lastScheduledRun = null;
let nextScheduledRun = 'Twice daily at 06:00 and 18:00 (with automatic wake-up catchup)';

async function triggerSync(triggerType = 'cron') {
  if (isRunning) {
    console.log(`[Scheduler] Price update job already running, skipping ${triggerType} trigger.`);
    return;
  }
  isRunning = true;
  lastScheduledRun = new Date().toISOString();
  console.log(`[Scheduler] Starting price sync (${triggerType}) at ${lastScheduledRun}`);

  try {
    const result = await updatePrices();
    console.log(`[Scheduler] Price update (${triggerType}) succeeded:`, result);
  } catch (err) {
    console.error(`[Scheduler] Price update (${triggerType}) failed:`, err);
    try {
      db.prepare(`
        INSERT INTO sync_logs (job_type, game_id, status, details)
        VALUES (?, ?, ?, ?)
      `).run('pricing_cron', 'all', 'error', err.message);
    } catch {}
  } finally {
    isRunning = false;
  }
}

/**
 * Checks if a scheduled execution was missed (e.g. while the computer was asleep/offline)
 * and immediately catches up if more than 12 hours have passed since the last successful sync.
 */
function checkCatchup() {
  try {
    const latestLog = db.prepare(`
      SELECT timestamp FROM sync_logs 
      WHERE job_type IN ('pricing', 'pricing_cron') AND status = 'success'
      ORDER BY id DESC LIMIT 1
    `).get();

    const todayStr = new Date().toISOString().split('T')[0];
    const lastDate = latestLog ? latestLog.timestamp.split(' ')[0] : null;

    const now = Date.now();
    const lastTime = latestLog ? new Date(latestLog.timestamp.replace(' ', 'T') + 'Z').getTime() : 0;
    const hoursSinceLast = (now - lastTime) / (1000 * 60 * 60);

    // If more than 12 hours or on a new day without a sync today, trigger catch-up!
    if ((hoursSinceLast >= 12 || lastDate !== todayStr) && !isRunning) {
      console.log(`[Scheduler] Catch-up needed: ${hoursSinceLast.toFixed(1)}h since last sync (last: ${latestLog?.timestamp || 'never'}). Starting catch-up...`);
      triggerSync('wake_catchup');
    }
  } catch (err) {
    console.error('[Scheduler] Catchup check error:', err.message);
  }
}

function startScheduler() {
  console.log('[Scheduler] Initializing automated price update cron (Twice daily: 06:00 & 18:00 with auto-catchup)...');

  // Standard fixed cron: runs at 06:00 and 18:00 every day
  cron.schedule('0 6,18 * * *', () => {
    triggerSync('scheduled_cron');
  });

  // Check on startup after 5 seconds
  setTimeout(checkCatchup, 5000);

  // Periodically check every 15 minutes to catch up if the computer was asleep during scheduled cron
  setInterval(checkCatchup, 15 * 60 * 1000);
}

function getSchedulerStatus() {
  const latestLog = db.prepare(`
    SELECT * FROM sync_logs 
    WHERE job_type IN ('pricing', 'pricing_cron') 
    ORDER BY id DESC LIMIT 1
  `).get();

  return {
    isRunning,
    schedule: nextScheduledRun,
    lastRun: lastScheduledRun || (latestLog ? latestLog.timestamp : null),
    latestStatus: latestLog ? latestLog.status : 'idle'
  };
}

module.exports = { startScheduler, getSchedulerStatus, triggerSync };
