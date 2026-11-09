const db = require('../db');
const { getTcgSetName } = require('./setMapping');

const TCGPLAYER_SEARCH_API = 'https://mp-search-api.tcgplayer.com/v1/search/request?isList=true';

function normStr(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cleanCardNumber(num) {
  if (!num) return '';
  // Remove wrapping quotes, spaces
  let s = String(num).replace(/['"]/g, '').trim();
  // If it's a fractional number like 015/084 or 15/102
  if (s.includes('/')) {
    s = s.split('/')[0].trim();
  }
  // Strip leading zeros if purely numeric (e.g. 015 -> 15)
  if (/^0+[0-9]+$/.test(s)) {
    s = s.replace(/^0+/, '');
  }
  return s.toUpperCase();
}

function normRarity(r) {
  return (r || '').replace(/[\s_]/g, '').toUpperCase();
}

/**
 * Fetch all product listings for a specific set from TCGPlayer
 */
async function fetchTcgSetItems(tcgSetName) {
  const allItems = [];
  let from = 0;
  const pageSize = 50;

  while (true) {
    try {
      const res = await fetch(TCGPLAYER_SEARCH_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        body: JSON.stringify({
          algorithm: 'sales_synonym_v2',
          from,
          size: pageSize,
          filters: {
            term: {
              setName: [tcgSetName]
            }
          }
        })
      });

      if (!res.ok) {
        console.warn(`[TCG Set Sync] Request for "${tcgSetName}" returned HTTP ${res.status}`);
        break;
      }

      const data = await res.json();
      const results = data.results?.[0]?.results || [];
      if (results.length === 0) break;

      allItems.push(...results);
      if (results.length < pageSize) break;

      from += pageSize;
      // Safety limit: up to 10 pages (500 cards per set)
      if (from >= 500) break;
    } catch (err) {
      console.error(`[TCG Set Sync] Error fetching page from=${from} for "${tcgSetName}":`, err.message);
      break;
    }
  }

  return allItems;
}

/**
 * Sync prices for a single set by set ID
 */
async function syncSetPrices(setId) {
  const set = db.prepare('SELECT id, game_id, name, code FROM sets WHERE id = ?').get(setId);
  if (!set) throw new Error(`Set not found: ${setId}`);

  const tcgSetName = getTcgSetName(set.game_id, set.id, set.name);
  const dbCards = db.prepare('SELECT id, card_number, name, rarity, is_alt_art FROM cards WHERE set_id = ?').all(setId);

  if (dbCards.length === 0) {
    return { setId, setName: set.name, tcgSetName, total: 0, matched: 0, unlisted: 0 };
  }

  const tcgItems = await fetchTcgSetItems(tcgSetName);
  const todayStr = new Date().toISOString().split('T')[0];

  const insertPrice = db.prepare(`
    INSERT INTO price_history (card_id, source, market_price, low_price, high_price, currency, recorded_at, source_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let matchedCount = 0;

  const insertTx = db.transaction(() => {
    for (const card of dbCards) {
      const cardNumClean = cleanCardNumber(card.card_number);
      const baseNumClean = cleanCardNumber(card.card_number.replace(/_PR\d?$/i, '').replace(/_p\d?$/i, ''));
      const cardNameNorm = normStr(card.name);
      const cardRarityNorm = normRarity(card.rarity);
      const isSuperAlt = card.card_number.includes('_PR2') || card.card_number.includes('_p2') || cardRarityNorm.includes('**') || card.name.includes('(Super Alt-Art)');
      const isAlt = !isSuperAlt && (
        card.card_number.includes('_PR') || 
        card.card_number.includes('_p1') || 
        cardRarityNorm.includes('*') || 
        cardRarityNorm.includes('★') || 
        card.name.includes('(Alt-Art)') || 
        (Boolean(card.is_alt_art) && !/^[A-Z0-9]+-\d+$/i.test(card.card_number))
      );

      // 1. Primary match: Match by card number (filter all candidate variants with a market or listing price)
      const candidateMatches = tcgItems.filter(item => {
        const itemNumRaw = item.customAttributes?.number;
        if (!itemNumRaw) return false;
        const itemNumClean = cleanCardNumber(itemNumRaw);
        const hasPrice = (item.marketPrice !== undefined && item.marketPrice !== null) || (item.lowestPrice !== undefined && item.lowestPrice !== null);
        return (itemNumClean === cardNumClean || itemNumClean === baseNumClean) && hasPrice;
      });

      let match = null;
      if (candidateMatches.length === 1 && !isAlt && !isSuperAlt) {
        match = candidateMatches[0];
      } else if (candidateMatches.length > 0) {
        // Multi-tier resolution for parallel / alt-art cards
        if (isSuperAlt) {
          match = candidateMatches.find(item => 
            (item.productName || '').toLowerCase().includes('super alternate art') ||
            (item.productName || '').toLowerCase().includes('super alt') ||
            normRarity(item.rarityName).includes('**')
          );
        } else if (isAlt) {
          match = candidateMatches.find(item => 
            (item.productName || '').toLowerCase().includes('alternate art') && 
            !(item.productName || '').toLowerCase().includes('super alternate art')
          );
          if (!match) {
            match = candidateMatches.find(item => 
              (item.productName || '').toLowerCase().includes('parallel') &&
              !(item.productName || '').toLowerCase().includes('super')
            );
          }
          if (!match) {
            match = candidateMatches.find(item => normRarity(item.rarityName) === cardRarityNorm);
          }
        } else {
          // Base regular non-alt card
          match = candidateMatches.find(item => 
            !(item.productName || '').toLowerCase().includes('alternate art') &&
            !(item.productName || '').toLowerCase().includes('parallel') &&
            !(item.productName || '').toLowerCase().includes('(')
          ) || candidateMatches.find(item => 
            !(item.productName || '').toLowerCase().includes('alternate art') &&
            !(item.productName || '').toLowerCase().includes('super')
          );
        }

        // Tier A: Match rarityName exactly (e.g. 'LR++' === 'LR++')
        if (!match) {
          match = candidateMatches.find(item => normRarity(item.rarityName) === cardRarityNorm);
        }

        // Tier B: Product name contains the rarity tag (e.g. '(LR++)' or '(LR+)')
        if (!match && cardRarityNorm) {
          match = candidateMatches.find(item => {
            const prodUpper = (item.productName || '').toUpperCase();
            return prodUpper.includes(`(${cardRarityNorm})`) || prodUpper.includes(`[${cardRarityNorm}]`);
          });
        }

        // Tier C: Match normalized product name
        if (!match) {
          match = candidateMatches.find(item => {
            const itemProdName = normStr(item.cleanName || item.productName || '');
            return itemProdName === cardNameNorm;
          });
        }

        // Tier D: Variant resolution fallback
        if (!match) {
          if (card.is_alt_art || isSuperAlt || isAlt) {
            candidateMatches.sort((a, b) => {
              const priceA = parseFloat(a.marketPrice ?? a.lowestPrice) || 0;
              const priceB = parseFloat(b.marketPrice ?? b.lowestPrice) || 0;
              return priceB - priceA;
            });
          } else {
            candidateMatches.sort((a, b) => {
              const priceA = parseFloat(a.marketPrice ?? a.lowestPrice) || 0;
              const priceB = parseFloat(b.marketPrice ?? b.lowestPrice) || 0;
              return priceA - priceB;
            });
          }
          match = candidateMatches[0];
        }
      }

      // 2. Secondary match: Match by normalized name
      if (!match) {
        match = tcgItems.find(item => {
          const itemProdName = normStr(item.cleanName || item.productName || '');
          const isNameMatch = itemProdName === cardNameNorm || itemProdName.startsWith(cardNameNorm);
          const hasPrice = (item.marketPrice !== undefined && item.marketPrice !== null) || (item.lowestPrice !== undefined && item.lowestPrice !== null);
          return isNameMatch && hasPrice;
        });
      }

      // 3. Fallback: Contains name and number
      if (!match) {
        match = tcgItems.find(item => {
          const itemProdName = normStr(item.productName || '');
          const hasPrice = (item.marketPrice !== undefined && item.marketPrice !== null) || (item.lowestPrice !== undefined && item.lowestPrice !== null);
          return itemProdName.includes(cardNameNorm) && hasPrice;
        });
      }

      if (match) {
        const market = (match.marketPrice !== undefined && match.marketPrice !== null && parseFloat(match.marketPrice) > 0)
          ? parseFloat(match.marketPrice)
          : (match.lowestPrice ? parseFloat(match.lowestPrice) : 0);

        if (market > 0) {
          const low = match.lowestPrice ? parseFloat(match.lowestPrice) : parseFloat((market * 0.85).toFixed(2));
          const high = parseFloat((market * 1.25).toFixed(2));
          const sourceUrl = match.productId 
            ? `https://www.tcgplayer.com/product/${match.productId}` 
            : (match.customUrl ? `https://www.tcgplayer.com${match.customUrl}` : null);

          insertPrice.run(
            card.id,
            'tcgplayer_market',
            market,
            low,
            high,
            'USD',
            todayStr,
            sourceUrl
          );
          matchedCount++;
        }
      }
    }
  });

  insertTx();

  const unlistedCount = dbCards.length - matchedCount;
  return {
    setId,
    setName: set.name,
    tcgSetName,
    total: dbCards.length,
    tcgItemsCount: tcgItems.length,
    matched: matchedCount,
    unlisted: unlistedCount,
    coveragePct: parseFloat(((matchedCount / dbCards.length) * 100).toFixed(1))
  };
}

module.exports = {
  syncSetPrices,
  fetchTcgSetItems
};
