/**
 * Reconcile and fix distorted lowest prices for One Piece products and cards
 * caused by non-English / Japanese listings or pack lots on TCGPlayer.
 */

const db = require('../db');
const { fetchVerifiedLowestListing } = require('../pricing/listingFilter');

async function reconcileOnePiecePrices() {
  console.log('[Reconcile] Finding One Piece prices with severe low_price discrepancies...');

  // Select all One Piece records where low_price is suspiciously low (< 65% of market_price)
  const distortedPrices = db.prepare(`
    SELECT p.id as price_id, p.card_id, p.market_price, p.low_price, p.source_url,
           c.name, c.is_sealed, c.is_case
    FROM price_history p
    JOIN cards c ON c.id = p.card_id
    WHERE c.game_id = 'onepiece' 
      AND p.market_price > 10 
      AND p.low_price < (p.market_price * 0.65)
    ORDER BY (p.market_price - p.low_price) DESC
  `).all();

  console.log(`[Reconcile] Found ${distortedPrices.length} distorted One Piece price records.`);

  const updatePrice = db.prepare('UPDATE price_history SET low_price = ? WHERE id = ?');
  let fixedCount = 0;
  let verifiedFromApiCount = 0;

  for (const item of distortedPrices) {
    // Try to extract productId from card_id or source_url
    let productId = null;
    const cardIdMatch = item.card_id.match(/^[a-z]+-(\d+)$/);
    if (cardIdMatch) {
      productId = cardIdMatch[1];
    } else if (item.source_url) {
      const urlMatch = item.source_url.match(/product\/(\d+)/);
      if (urlMatch) productId = urlMatch[1];
    }

    let newLow = null;

    if (productId) {
      try {
        const verified = await fetchVerifiedLowestListing(productId, { isSealed: Boolean(item.is_sealed) });
        if (verified && verified.lowestPrice && verified.lowestPrice >= (item.market_price * 0.45)) {
          newLow = verified.lowestPrice;
          verifiedFromApiCount++;
          console.log(`  [Verified API] ${item.name} (${productId}): $${item.low_price} -> $${newLow} (Market: $${item.market_price}, Foreign filtered: ${verified.foreignCount})`);
        }
      } catch (err) {
        // Fall back below
      }
    }

    if (!newLow) {
      // Default to realistic baseline (85% of market price)
      newLow = parseFloat((item.market_price * 0.85).toFixed(2));
      console.log(`  [Adjusted 85%] ${item.name}: $${item.low_price} -> $${newLow} (Market: $${item.market_price})`);
    }

    updatePrice.run(newLow, item.price_id);
    fixedCount++;
  }

  console.log(`[Reconcile] Done! Updated ${fixedCount} price records (${verifiedFromApiCount} directly verified from clean English listings).`);
}

if (require.main === module) {
  reconcileOnePiecePrices()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[Reconcile] Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { reconcileOnePiecePrices };
