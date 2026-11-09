const { POKEMON_NAME_OVERRIDES } = require('./setMapping');
const { syncSetPrices } = require('./syncSetPrices');
const { PRIORITY_SETS } = require('./syncAllSets');

async function syncRemaining() {
  const syncedSetIds = new Set(PRIORITY_SETS);
  const remaining = Object.keys(POKEMON_NAME_OVERRIDES).filter(id => !syncedSetIds.has(id));

  console.log(`[Remaining Sets Sync] Starting sync for ${remaining.length} additional mapped Pokemon sets...`);
  let matchedTotal = 0;

  for (let i = 0; i < remaining.length; i++) {
    const setId = remaining[i];
    try {
      console.log(`(${i + 1}/${remaining.length}) Syncing ${setId}...`);
      const res = await syncSetPrices(setId);
      matchedTotal += res.matched;
      console.log(`  ✓ ${res.setName} -> Matched ${res.matched}/${res.total} (${res.coveragePct}%)`);
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error(`  ✗ Error syncing ${setId}:`, err.message);
    }
  }

  console.log(`[Remaining Sets Sync] Completed! Ingested ${matchedTotal} additional prices.`);
}

if (require.main === module) {
  syncRemaining().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { syncRemaining };
