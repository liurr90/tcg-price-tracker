const db = require('../db');
const { syncSetPrices } = require('./syncSetPrices');
const { getTcgSetName } = require('./setMapping');

/**
 * High-priority target sets to sync first across all card games.
 */
const PRIORITY_SETS = [
  // --- Pokémon Modern (2022 - 2026) ---
  'pokemon-me5',       // Pitch Black
  'pokemon-me55',      // 30th Celebration
  'pokemon-me55c',     // 30th Celebration Classic Collection
  'pokemon-zsv10pt5',  // Black Bolt
  'pokemon-sv8pt5',    // Prismatic Evolutions
  'pokemon-sv8',       // Surging Sparks
  'pokemon-sv7',       // Stellar Crown
  'pokemon-sv6pt5',    // Shrouded Fable
  'pokemon-sv6',       // Twilight Masquerade
  'pokemon-sv5',       // Temporal Forces
  'pokemon-sv4pt5',    // Paldean Fates
  'pokemon-sv4',       // Paradox Rift
  'pokemon-sv3pt5',    // Scarlet & Violet 151
  'pokemon-sv3',       // Obsidian Flames
  'pokemon-sv2',       // Paldea Evolved
  'pokemon-sv1',       // Scarlet & Violet Base
  'pokemon-swsh12pt5', // Crown Zenith
  'pokemon-swsh12',    // Silver Tempest
  'pokemon-swsh11',    // Lost Origin
  'pokemon-swsh10',    // Astral Radiance
  'pokemon-swsh9',     // Brilliant Stars
  'pokemon-swsh7',     // Evolving Skies
  'pokemon-swsh45',    // Shining Fates

  // --- Pokémon Vintage & Classic ---
  'pokemon-base1',     // Base Set
  'pokemon-base2',     // Jungle
  'pokemon-base3',     // Fossil
  'pokemon-base4',     // Base Set 2
  'pokemon-base5',     // Team Rocket
  'pokemon-base6',     // Legendary Collection
  'pokemon-gym1',      // Gym Heroes
  'pokemon-gym2',      // Gym Challenge
  'pokemon-neo1',      // Neo Genesis
  'pokemon-neo2',      // Neo Discovery
  'pokemon-neo3',      // Neo Revelation
  'pokemon-neo4',      // Neo Destiny
  'pokemon-ex1',       // EX Ruby & Sapphire
  'pokemon-ex8',       // Deoxys
  'pokemon-dp1',       // Diamond & Pearl
  'pokemon-bw1',       // Black & White
  'pokemon-xy12',      // Evolutions

  // --- Gundam Card Game (All Sets) ---
  'gundam-GD01',
  'gundam-GD02',
  'gundam-GD03',
  'gundam-GD04',
  'gundam-GD05',
  'gundam-GD06',
  'gundam-ST01',
  'gundam-ST02',
  'gundam-ST03',
  'gundam-ST04',
  'gundam-ST05',
  'gundam-ST06',
  'gundam-ST07',
  'gundam-ST08',
  'gundam-ST09',
  'gundam-ST10',
  'gundam-ST11',
  'gundam-ST12',
  'gundam-ST13',
  'gundam-ST14',
  'gundam-EB01',

  // --- Dragon Ball Super: Fusion World (All Major Sets) ---
  'fusionworld-FB01',
  'fusionworld-FB02',
  'fusionworld-FB03',
  'fusionworld-FB04',
  'fusionworld-FB05',
  'fusionworld-FB06',
  'fusionworld-FS01',
  'fusionworld-FS02',
  'fusionworld-FS03',
  'fusionworld-FS04',
  'fusionworld-FS05',
  'fusionworld-FS06',
  'fusionworld-FS07',
  'fusionworld-FS08',
  'fusionworld-FS09',
  'fusionworld-FS10',
  'fusionworld-FS11',
  'fusionworld-FS12',
  'fusionworld-FS13',
  'fusionworld-FS14',

  // Riftbound TCG
  'riftbound-origins',
  'riftbound-radiance',
  'riftbound-unleashed',
  'riftbound-spiritforged',
  'riftbound-vendetta',
  'riftbound-riftbound-organized-play-promotional-cards',
  'riftbound-t1-2025-worlds-champion-bundles'
];

/**
 * Run set-level sync for a given list of set IDs (or all priority sets)
 */
async function syncPrioritySets(setIds = PRIORITY_SETS) {
  console.log(`[Batch Sync] Starting real-price synchronization for ${setIds.length} sets...`);
  const results = [];
  let totalCardsMatched = 0;

  for (let i = 0; i < setIds.length; i++) {
    const setId = setIds[i];
    try {
      console.log(`[Batch Sync] (${i + 1}/${setIds.length}) Syncing ${setId}...`);
      const res = await syncSetPrices(setId);
      results.push(res);
      totalCardsMatched += res.matched;
      console.log(`  ✓ ${res.setName} -> Matched ${res.matched}/${res.total} (${res.coveragePct}%)`);
      // Brief rate-limit buffer between sets
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error(`  ✗ Failed to sync set ${setId}:`, err.message);
      results.push({ setId, error: err.message, matched: 0 });
    }
  }

  console.log(`[Batch Sync] Completed! Ingested verified prices for ${totalCardsMatched} cards across ${results.length} sets.`);
  return { results, totalCardsMatched };
}

module.exports = {
  PRIORITY_SETS,
  syncPrioritySets
};

if (require.main === module) {
  syncPrioritySets().then(() => {
    console.log('[Batch Sync] Process finished successfully.');
    process.exit(0);
  }).catch(err => {
    console.error('[Batch Sync] Process failed:', err);
    process.exit(1);
  });
}
