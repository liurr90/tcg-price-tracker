const cron = require('node-cron');
const { updatePrices } = require('./pricing/priceUpdater');
const db = require('./db');

let isRunning = false;
let lastScheduledRun = null;
let nextScheduledRun = 'Twice daily at 06:00 and 18:00';

function startScheduler() {
  console.log('[Scheduler] Initializing automated price update cron (Twice daily: 06:00 & 18:00)...');

  // Runs at minute 0 past hour 6 and 18 every day
  cron.schedule('0 6,18 * * *', async () => {
    if (isRunning) {
      console.log('[Scheduler] Price update job already running, skipping trigger.');
      return;
    }
    isRunning = true;
    lastScheduledRun = new Date().toISOString();
    console.log(`[Scheduler] Cron triggered at ${lastScheduledRun}`);

    try {
      const result = updatePrices();
      console.log('[Scheduler] Automated price update succeeded:', result);
    } catch (err) {
      console.error('[Scheduler] Automated price update failed:', err);
      db.prepare(`
        INSERT INTO sync_logs (job_type, game_id, status, details)
        VALUES (?, ?, ?, ?)
      `).run('pricing_cron', 'all', 'error', err.message);
    } finally {
      isRunning = false;
    }
  });
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

module.exports = { startScheduler, getSchedulerStatus };
