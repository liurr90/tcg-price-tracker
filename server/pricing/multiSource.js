const db = require('../db');

/**
 * Normalizes and formats raw source codes into human-readable metadata
 */
function formatSourceMeta(sourceCode) {
  const code = (sourceCode || '').toLowerCase();

  if (code.includes('tcgplayer')) {
    return {
      id: sourceCode,
      code: 'tcgplayer',
      name: 'TCGPlayer Marketplace',
      shortName: 'TCGPlayer',
      region: 'US / Global',
      badgeClass: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60',
      iconType: 'store'
    };
  }

  if (code.includes('cardmarket')) {
    return {
      id: sourceCode,
      code: 'cardmarket',
      name: 'Cardmarket (EU)',
      shortName: 'Cardmarket',
      region: 'Europe',
      badgeClass: 'bg-blue-950/80 text-blue-300 border-blue-800/60',
      iconType: 'globe'
    };
  }

  if (code.includes('ebay')) {
    return {
      id: sourceCode,
      code: 'ebay',
      name: 'eBay Last Solds & Comps',
      shortName: 'eBay Sales',
      region: 'Auction / P2P',
      badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
      iconType: 'gavel'
    };
  }

  return {
    id: sourceCode,
    code: 'other',
    name: sourceCode.replace(/_/g, ' ').toUpperCase(),
    shortName: sourceCode,
    region: 'Direct',
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
    iconType: 'store'
  };
}

/**
 * Computes discrepancy statistics across multiple market sources for a card
 */
function computeSourceDiscrepancy(sourcesList = []) {
  if (!sourcesList || sourcesList.length <= 1) {
    return {
      hasDiscrepancy: false,
      sourcesCount: sourcesList.length,
      spreadUsd: 0,
      spreadPercent: 0,
      cheapestSource: sourcesList[0] || null,
      highestSource: sourcesList[0] || null
    };
  }

  // Filter sources with valid market price
  const valid = sourcesList.filter(s => s.market_price !== null && s.market_price !== undefined && s.market_price > 0);
  if (valid.length <= 1) {
    return {
      hasDiscrepancy: false,
      sourcesCount: valid.length,
      spreadUsd: 0,
      spreadPercent: 0,
      cheapestSource: valid[0] || null,
      highestSource: valid[0] || null
    };
  }

  // Find min and max
  let min = valid[0];
  let max = valid[0];

  for (const s of valid) {
    if (s.market_price < min.market_price) min = s;
    if (s.market_price > max.market_price) max = s;
  }

  const spreadUsd = parseFloat((max.market_price - min.market_price).toFixed(2));
  const spreadPercent = min.market_price > 0 
    ? parseFloat(((spreadUsd / min.market_price) * 100).toFixed(1))
    : 0;

  return {
    hasDiscrepancy: spreadUsd > 0.05,
    sourcesCount: valid.length,
    spreadUsd,
    spreadPercent,
    cheapestSource: min,
    highestSource: max
  };
}

module.exports = { formatSourceMeta, computeSourceDiscrepancy };
