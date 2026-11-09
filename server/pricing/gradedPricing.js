const db = require('../db');

function cleanNum(num) {
  if (!num) return '';
  return String(num).replace(/['"]/g, '').split('/')[0].replace(/^0+/, '').trim().toUpperCase();
}

function cleanCardName(name) {
  if (!name) return '';
  return name
    .replace(/\s*\(Super Alt-Art\)/gi, '')
    .replace(/\s*\(Alt-Art\)/gi, '')
    .replace(/\s*\(Manga\)/gi, '')
    .replace(/\s*\(Parallel\)/gi, '')
    .replace(/\s*\(Special Rare\)/gi, '')
    .trim();
}

/**
 * Fetch PSA 10 and PSA 9 pricing from PriceCharting for a specific card
 */
async function fetchPsaPrices(card) {
  if (!card || !card.name) return null;

  const cardName = cleanCardName(card.name);
  const cardNum = card.card_number || '';
  const numClean = cleanNum(cardNum);
  const setName = (card.set_name || '').replace(/[:\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  const imgUrl = ((card.image_url || '') + ' ' + (card.local_image_path || '')).toLowerCase();

  const isSuperAlt = cardNum.includes('_PR2') || cardNum.includes('_p2') || cardNum.includes('_r2') ||
                     imgUrl.includes('_p2') || imgUrl.includes('_r2') || imgUrl.includes('_pr2') ||
                     (card.name || '').includes('Super Alt') || (card.name || '').includes('Manga') ||
                     (card.rarity || '').includes('**') || (card.rarity || '').includes('Special');

  const isAlt = Boolean(card.is_alt_art) || cardNum.includes('_PR') || cardNum.includes('_p') || cardNum.includes('_r') ||
                imgUrl.includes('_p1') || imgUrl.includes('_r1') || imgUrl.includes('_pr1') || (card.name || '').includes('Alt');

  // Build prioritized candidate search queries
  const queries = [];
  const baseNum = cardNum.replace(/_PR\d?$/i, '').replace(/_p\d?$/i, '').replace(/_r\d?$/i, '').trim();

  if (card.game_id === 'pokemon') {
    if (numClean) queries.push(`${cardName} ${numClean}`);
    queries.push(cardName);
    if (setName) queries.push(`${cardName} ${setName}`);
    if (numClean && setName) queries.push(`${cardName} ${setName} ${numClean}`);
  } else if (card.game_id === 'onepiece') {
    if (isSuperAlt) {
      queries.push(`${cardName} ${baseNum}`);
      queries.push(`${cardName} Manga ${baseNum}`);
      queries.push(`Manga ${baseNum}`);
    } else if (isAlt) {
      queries.push(`${cardName} ${baseNum}`);
      queries.push(`${cardName} Alternate Art ${baseNum}`);
    } else {
      queries.push(`${cardName} ${baseNum}`);
    }
    queries.push(baseNum);
  } else {
    // Fusion World / Gundam
    if (isSuperAlt) {
      queries.push(`${cardName} ${baseNum}`);
      queries.push(`${cardName} Super Alternate ${baseNum}`);
    } else if (isAlt) {
      queries.push(`${cardName} ${baseNum}`);
      queries.push(`${cardName} Alternate Art ${baseNum}`);
    } else {
      queries.push(`${cardName} ${baseNum}`);
    }
    queries.push(baseNum);
  }

  for (const q of queries) {
    if (!q || q.length < 2) continue;
    try {
      const searchUrl = 'https://www.pricecharting.com/search-products?type=prices&q=' + encodeURIComponent(q);
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      if (!res.ok) continue;
      const html = await res.text();

      // Find candidate rows
      const allRows = [...html.matchAll(/<tr id="product-(\d+)"[\s\S]*?<td class="title">[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
      if (allRows.length === 0) continue;

      // Prefer English releases over Japanese unless no English version exists
      const englishRows = allRows.filter(r => !/japanese/i.test(r[2]));
      const rows = englishRows.length > 0 ? englishRows : allRows;

      let matchedRow = null;

      if (card.game_id === 'pokemon') {
        if (numClean) {
          const numPattern = new RegExp(`[#/-]${numClean}(\\b|\\s|$)`, 'i');
          matchedRow = rows.find(r => numPattern.test(r[3]) || numPattern.test(r[2]));
        }
        if (!matchedRow) {
          matchedRow = rows[0];
        }
      } else {
        if (isSuperAlt) {
          matchedRow = rows.find(r => /manga|super alternate|special|\bsp\b/i.test(r[3]) && (r[3].includes(baseNum) || r[2].includes(baseNum.toLowerCase())))
                    || rows.find(r => /manga|super alternate|special|\bsp\b/i.test(r[3]))
                    || rows.find(r => r[3].includes(baseNum) || r[2].includes(baseNum.toLowerCase()));
        } else if (isAlt) {
          matchedRow = rows.find(r => /alternate art|parallel/i.test(r[3]) && !/manga|super/i.test(r[3]))
                    || rows.find(r => r[3].includes(baseNum) || r[2].includes(baseNum.toLowerCase()));
        } else {
          matchedRow = rows.find(r => (r[3].includes(baseNum) || r[2].includes(baseNum.toLowerCase())) && !/alternate art|parallel|manga|super/i.test(r[3]))
                    || rows.find(r => r[3].includes(baseNum) || r[2].includes(baseNum.toLowerCase()))
                    || rows[0];
        }
      }

      if (!matchedRow) continue;

      const productPath = matchedRow[2].startsWith('http') ? matchedRow[2] : 'https://www.pricecharting.com' + matchedRow[2];

      // Fetch details from product page
      const prodRes = await fetch(productPath, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      if (!prodRes.ok) continue;
      const prodHtml = await prodRes.text();

      const parsePrice = (id) => {
        const re = new RegExp('<td id="' + id + '"[\\s\\S]*?<span class="price js-price">\\s*\\$([0-9,.]+)\\s*</span>');
        const m = prodHtml.match(re);
        return m ? parseFloat(m[1].replace(/,/g, '')) : null;
      };

      const parseNamedGrade = (name) => {
        const re = new RegExp('<tr>\\s*<td>' + name + '<\\/td>\\s*<td class="price js-price">\\s*\\$([0-9,.]+)\\s*<\\/td>', 'i');
        const m = prodHtml.match(re);
        return m ? parseFloat(m[1].replace(/,/g, '')) : null;
      };

      const raw = parsePrice('used_price');
      const grade9 = parsePrice('graded_price') || parseNamedGrade('Grade 9');
      const psa10 = parsePrice('manual_only_price') || parseNamedGrade('PSA 10');
      const bgs10 = parseNamedGrade('BGS 10');
      const bgs10Black = parseNamedGrade('BGS 10 Black');

      if (psa10 || grade9 || bgs10 || bgs10Black) {
        return {
          card_id: card.id,
          name: card.name,
          psa10,
          psa9: grade9,
          bgs10,
          bgs10_black: bgs10Black,
          raw,
          url: productPath,
          matchedTitle: matchedRow[3].replace(/\s+/g, ' ').trim()
        };
      }
    } catch {
      // Continue to next query
    }
  }

  return null;
}

/**
 * Updates a card's latest price record with PSA 10, PSA 9, and BGS 10 values
 */
async function updateCardPsaPrices(cardId) {
  const card = db.prepare(`
    SELECT c.*, s.name as set_name 
    FROM cards c 
    JOIN sets s ON c.set_id = s.id 
    WHERE c.id = ?
  `).get(cardId);

  if (!card) return null;

  const result = await fetchPsaPrices(card);
  if (!result || (!result.psa10 && !result.psa9 && !result.bgs10 && !result.bgs10_black)) return null;

  // Find latest price record
  const latestPrice = db.prepare(`
    SELECT id, market_price, low_price, high_price 
    FROM price_history 
    WHERE card_id = ? 
    ORDER BY recorded_at DESC, id DESC 
    LIMIT 1
  `).get(cardId);

  if (latestPrice) {
    db.prepare(`
      UPDATE price_history 
      SET graded_psa10 = COALESCE(?, graded_psa10),
          graded_psa9 = COALESCE(?, graded_psa9),
          graded_bgs10 = COALESCE(?, graded_bgs10),
          graded_bgs10_black = COALESCE(?, graded_bgs10_black)
      WHERE id = ?
    `).run(result.psa10, result.psa9, result.bgs10, result.bgs10_black, latestPrice.id);
  } else {
    const todayStr = new Date().toISOString().split('T')[0];
    db.prepare(`
      INSERT INTO price_history (card_id, source, market_price, low_price, high_price, graded_psa10, graded_psa9, graded_bgs10, graded_bgs10_black, currency, recorded_at, source_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      cardId,
      'pricecharting',
      result.raw || null,
      result.raw ? parseFloat((result.raw * 0.85).toFixed(2)) : null,
      result.raw ? parseFloat((result.raw * 1.25).toFixed(2)) : null,
      result.psa10,
      result.psa9,
      result.bgs10,
      result.bgs10_black,
      'USD',
      todayStr,
      result.url
    );
  }

  return result;
}

module.exports = {
  fetchPsaPrices,
  updateCardPsaPrices
};
