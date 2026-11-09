// Realistic dummy price generator tailored to TCG card rarities, vintage eras, and popular Pokemon

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getRarityBasePrice(rarity = '', isAltArt = false, cardName = '') {
  const r = rarity.toLowerCase();
  const name = (cardName || '').toLowerCase();
  
  // Icon / Grail character boost
  let charMultiplier = 1.0;
  if (name.includes('charizard') || name.includes('lugia') || name.includes('umbreon') || name.includes('rayquaza')) {
    charMultiplier = 3.2;
  } else if (name.includes('gengar') || name.includes('blastoise') || name.includes('mewtwo') || name.includes('pikachu') || name.includes('luffy') || name.includes('zoro') || name.includes('goku')) {
    charMultiplier = 1.8;
  }

  // Vintage grail rarities: Gold Star, Shining, Crystal, 1st Edition Holo
  if (r.includes('gold star') || r.includes('shining') || r.includes('crystal') || r.includes('manga') || r.includes('god')) {
    return (250 + (Math.random() * 550)) * charMultiplier;
  }
  if (r.includes('special illustration') || r.includes('secret') || r.includes('scr') || r.includes('parallel') || r.includes('lr')) {
    return (45 + (Math.random() * 140)) * charMultiplier;
  }
  if (r.includes('ultra') || r.includes('sr') || r.includes('leader') || r.includes('vmax') || r.includes('ex') || r.includes('lv.x') || r.includes('prime')) {
    return (14 + (Math.random() * 38)) * charMultiplier;
  }
  if (r.includes('super rare') || r.includes('holo') || r.includes('rare holo')) {
    return (4.5 + (Math.random() * 18.5)) * charMultiplier;
  }
  if (r.includes('rare')) {
    return (1.5 + (Math.random() * 5.5)) * charMultiplier;
  }
  if (r.includes('uncommon')) {
    return 0.40 + (Math.random() * 1.40);
  }
  return 0.15 + (Math.random() * 0.70); // Common
}

/**
 * Generate 14-day price history for a given card
 */
function generatePriceHistory(card, days = 14) {
  const seed = hashString(card.id || card.card_number);
  const baseRand = (seed % 1000) / 1000;
  
  let basePrice = getRarityBasePrice(card.rarity, card.is_alt_art, card.name);
  if (card.is_alt_art) basePrice *= 2.2;

  basePrice = parseFloat((basePrice * (0.7 + baseRand * 0.6)).toFixed(2));
  if (basePrice < 0.15) basePrice = 0.25;

  const history = [];
  const now = new Date();

  let currentPrice = basePrice * 0.93;
  const driftPerDay = ((seed % 100) - 45) / 1000;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    const noise = 1 + (((seed * (i + 1)) % 100) - 50) / 1500;
    currentPrice = Math.max(0.10, currentPrice * (1 + driftPerDay) * noise);

    const marketPrice = parseFloat(currentPrice.toFixed(2));
    const lowPrice = parseFloat((marketPrice * 0.88).toFixed(2));
    const highPrice = parseFloat((marketPrice * 1.22).toFixed(2));

    // Vintage and high-end cards command much higher PSA 10 multipliers (4x - 9x)
    const psaMult = marketPrice > 50 ? (4.5 + (baseRand * 4.0)) : (3.2 + (baseRand * 2.0));
    const psa10 = marketPrice > 5 ? parseFloat((marketPrice * psaMult).toFixed(2)) : null;
    const psa9 = marketPrice > 5 ? parseFloat((marketPrice * (1.3 + (baseRand * 0.5))).toFixed(2)) : null;

    history.push({
      card_id: card.id,
      source: 'dummy_market',
      market_price: marketPrice,
      low_price: lowPrice,
      high_price: highPrice,
      graded_psa10: psa10,
      graded_psa9: psa9,
      currency: 'USD',
      recorded_at: dateStr
    });
  }

  return history;
}

module.exports = { generatePriceHistory };
