const db = require('../server/db');
const { updateCardPsaPrices } = require('../server/pricing/gradedPricing');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    limit: 150,
    perSet: 2,
    minPrice: 20,
    game: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[++i], 10);
    } else if (args[i] === '--perSet' && args[i + 1]) {
      options.perSet = parseInt(args[++i], 10);
    } else if (args[i] === '--minPrice' && args[i + 1]) {
      options.minPrice = parseFloat(args[++i]);
    } else if (args[i] === '--game' && args[i + 1]) {
      options.game = args[++i];
    }
  }

  return options;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const opts = parseArgs();
  console.log(`[PSA Sync] Starting PSA 10/9 sync with options:`, opts);

  let gameFilter = '';
  const params = [opts.minPrice];
  if (opts.game) {
    gameFilter = 'AND c.game_id = ?';
    params.push(opts.game);
  }

  // Query top N cards per set, sorted by market price
  const query = `
    WITH RankedCards AS (
      SELECT c.id, c.name, c.card_number, c.game_id, c.set_id, s.name as set_name,
             p.market_price, p.graded_psa10, p.graded_psa9,
             ROW_NUMBER() OVER (PARTITION BY c.set_id ORDER BY p.market_price DESC NULLS LAST) as rank_in_set
      FROM cards c
      JOIN sets s ON c.set_id = s.id
      LEFT JOIN price_history p ON p.id = (
        SELECT id FROM price_history WHERE card_id = c.id ORDER BY recorded_at DESC, id DESC LIMIT 1
      )
      WHERE p.market_price IS NOT NULL AND p.market_price >= ? ${gameFilter}
    )
    SELECT * FROM RankedCards
    WHERE rank_in_set <= ${opts.perSet}
    ORDER BY market_price DESC
    LIMIT ${opts.limit}
  `;

  const candidates = db.prepare(query).all(...params);
  console.log(`[PSA Sync] Found ${candidates.length} grail candidates to check for PSA grading.`);

  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < candidates.length; i++) {
    const card = candidates[i];
    const progress = `[${i + 1}/${candidates.length}]`;

    // If card already has PSA 10 and PSA 9 stored, skip to conserve requests
    if (card.graded_psa10 && card.graded_psa9) {
      console.log(`${progress} Skipped (already has PSA data): ${card.name} (${card.card_number}) -> PSA 10: $${card.graded_psa10}`);
      skippedCount++;
      continue;
    }

    try {
      const result = await updateCardPsaPrices(card.id);
      if (result && (result.psa10 || result.psa9)) {
        updatedCount++;
        console.log(`${progress} ✅ ${card.game_id} | ${card.name} (${card.card_number}) [${card.set_name}]: PSA 10: $${result.psa10 || '--'} | PSA 9: $${result.psa9 || '--'}`);
      } else {
        console.log(`${progress} ⚪ No PSA comps found for: ${card.name} (${card.card_number}) [${card.set_name}]`);
      }
    } catch (err) {
      failedCount++;
      console.error(`${progress} ❌ Error updating ${card.id}:`, err.message);
    }

    // Pacing delay (300ms)
    await sleep(300);
  }

  console.log('\n[PSA Sync Complete]');
  console.log(`Total processed: ${candidates.length}`);
  console.log(`Updated with PSA values: ${updatedCount}`);
  console.log(`Skipped (already had data): ${skippedCount}`);
  console.log(`Failed / Not found: ${candidates.length - updatedCount - skippedCount}`);
}

main().catch(err => {
  console.error('[PSA Sync Fatal]', err);
  process.exit(1);
});
