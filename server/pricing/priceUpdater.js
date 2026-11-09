const db = require('../db');
const {
  syncRealOnePiecePrices,
  syncRealTcgPlayerMarket
} = require('./realPrices');
const { syncPrioritySets } = require('./syncAllSets');

/**
 * Fetch and update actual market prices across TCGPlayer and marketplace APIs.
 */
async function updatePrices(gameId = null) {
  console.log(`[Price Updater] Starting verified real price sync (target: ${gameId || 'all'})...`);
  const results = {};

  try {
    if (!gameId || gameId === 'onepiece') {
      results.onepiece = await syncRealOnePiecePrices();
    }
    // High-precision set-by-set synchronization across Pokemon, Gundam, and Fusion World
    const setSyncRes = await syncPrioritySets();
    results.setSync = setSyncRes.totalCardsMatched;

    const totalVerified = db.prepare("SELECT COUNT(*) as c FROM price_history WHERE source LIKE 'tcgplayer%'").get().c;

    db.prepare(`
      INSERT INTO sync_logs (job_type, game_id, status, details)
      VALUES (?, ?, ?, ?)
    `).run(
      'pricing',
      gameId || 'all',
      'success',
      `Verified real TCGPlayer price sync completed. Total verified records in DB: ${totalVerified}`
    );

    console.log('[Price Updater] Real price sync finished:', results);
    return { success: true, results, totalVerified };
  } catch (err) {
    console.error('[Price Updater] Failed to sync real prices:', err);
    db.prepare(`
      INSERT INTO sync_logs (job_type, game_id, status, details)
      VALUES (?, ?, ?, ?)
    `).run(
      'pricing',
      gameId || 'all',
      'error',
      err.message
    );
    throw err;
  }
}

module.exports = { updatePrices };
