const { ingestPokemon } = require('../server/ingestors/pokemon');
const { ingestOnePiece } = require('../server/ingestors/onepiece');
const { ingestFusionWorld } = require('../server/ingestors/fusionworld');
const { ingestGundam } = require('../server/ingestors/gundam');
const { updatePrices } = require('../server/pricing/priceUpdater');
const db = require('../server/db');

async function main() {
  const target = process.argv[2] || 'all';
  console.log(`=== Starting TCG Card Acquisition (Target: ${target}) ===\n`);

  try {
    if (target === 'all' || target === 'pokemon') {
      console.log('--- Ingesting Pokémon TCG ---');
      const res = await ingestPokemon();
      console.log('Pokémon Result:', res, '\n');
    }

    if (target === 'all' || target === 'onepiece') {
      console.log('--- Ingesting One Piece Card Game ---');
      const res = await ingestOnePiece();
      console.log('One Piece Result:', res, '\n');
    }

    if (target === 'all' || target === 'fusionworld') {
      console.log('--- Ingesting Dragon Ball Super: Fusion World ---');
      const res = await ingestFusionWorld();
      console.log('Fusion World Result:', res, '\n');
    }

    if (target === 'all' || target === 'gundam') {
      console.log('--- Ingesting Gundam Card Game ---');
      const res = await ingestGundam();
      console.log('Gundam Result:', res, '\n');
    }

    console.log('--- Initializing Price Points & 14-Day History ---');
    const priceRes = updatePrices();
    console.log('Price Sync Result:', priceRes, '\n');

    const totalCards = db.prepare('SELECT COUNT(*) as c FROM cards').get().c;
    const totalSets = db.prepare('SELECT COUNT(*) as c FROM sets').get().c;
    const totalPrices = db.prepare('SELECT COUNT(*) as c FROM price_history').get().c;

    console.log('==============================================');
    console.log(`ACQUISITION SUMMARY:`);
    console.log(`  Total Cards Stored Locally: ${totalCards}`);
    console.log(`  Total Sets Cataloged:      ${totalSets}`);
    console.log(`  Total Price Data Points:   ${totalPrices}`);
    console.log('==============================================');

  } catch (err) {
    console.error('Acquisition failed:', err);
    process.exit(1);
  }
}

main();
