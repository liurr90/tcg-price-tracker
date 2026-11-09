const {
  purgeDummyPrices,
  syncRealOnePiecePrices,
  syncRealTcgPlayerMarket,
  syncRealPokemonPrices
} = require('../server/pricing/realPrices');
const db = require('../server/db');

async function main() {
  console.log('=== Transitioning to Actual TCGPlayer Verified Prices ===\n');

  // 1. Purge dummy/placeholder prices
  purgeDummyPrices();

  // 2. Sync One Piece real prices
  try {
    await syncRealOnePiecePrices();
  } catch (err) {
    console.error('One Piece sync error:', err.message);
  }

  // 3. Sync Dragon Ball Super: Fusion World real prices
  try {
    await syncRealTcgPlayerMarket('fusionworld', 'dragon-ball-super-fusion-world', 12);
  } catch (err) {
    console.error('DBS Fusion World sync error:', err.message);
  }

  // 4. Sync Gundam Card Game real prices
  try {
    await syncRealTcgPlayerMarket('gundam', 'gundam-card-game', 12);
  } catch (err) {
    console.error('Gundam sync error:', err.message);
  }

  // 5. Sync Pokémon TCG real prices
  try {
    await syncRealPokemonPrices(15);
  } catch (err) {
    console.error('Pokemon sync error:', err.message);
  }

  const realPricesCount = db.prepare("SELECT COUNT(*) as c FROM price_history WHERE source LIKE 'tcgplayer%'").get().c;
  const dummyCount = db.prepare("SELECT COUNT(*) as c FROM price_history WHERE source LIKE '%dummy%'").get().c;

  console.log('\n==============================================');
  console.log('PRICING AUDIT:');
  console.log(`  Total Verified TCGPlayer Price Records: ${realPricesCount}`);
  console.log(`  Total Dummy / False Prices in DB:       ${dummyCount}`);
  console.log('==============================================');
}

main();
