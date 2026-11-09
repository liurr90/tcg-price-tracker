const db = require('../db');

const TCGPLAYER_SEARCH_API = 'https://mp-search-api.tcgplayer.com/v1/search/request';

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanHtml(str) {
  return (str || '')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ingest all Riftbound cards, sets, and initial raw prices from TCGPlayer
 */
async function ingestRiftboundCards() {
  console.log('[Riftbound Ingestor] Fetching all Riftbound products from TCGPlayer...');

  // Ensure game row exists
  db.prepare(`
    INSERT OR IGNORE INTO games (id, name, code, publisher, color_theme)
    VALUES (?, ?, ?, ?, ?)
  `).run('riftbound', 'Riftbound TCG', 'RIFTBOUND', 'Riot Games / UVS Games', 'violet');

  const pageSize = 50;
  // Get initial total
  const initRes = await fetch(TCGPLAYER_SEARCH_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({
      algorithm: 'sales_synonym_v2',
      from: 0,
      size: pageSize,
      filters: { term: { productLineName: ['Riftbound: League of Legends Trading Card Game'] } }
    })
  });

  if (!initRes.ok) throw new Error(`TCGPlayer search failed: ${initRes.status}`);
  const initData = await initRes.json();
  const total = initData.results?.[0]?.totalResults || 0;
  console.log(`[Riftbound Ingestor] Total catalog count: ${total} cards.`);

  const allItems = [...(initData.results?.[0]?.results || [])];
  const offsets = [];
  for (let from = pageSize; from < total; from += pageSize) {
    offsets.push(from);
  }

  // Fetch remaining batches with concurrency
  const BATCH_SIZE = 6;
  for (let i = 0; i < offsets.length; i += BATCH_SIZE) {
    const chunk = offsets.slice(i, i + BATCH_SIZE);
    const promises = chunk.map(async (from) => {
      try {
        const res = await fetch(TCGPLAYER_SEARCH_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
          body: JSON.stringify({
            algorithm: 'sales_synonym_v2',
            from,
            size: pageSize,
            filters: { term: { productLineName: ['Riftbound: League of Legends Trading Card Game'] } }
          })
        });
        if (!res.ok) return [];
        const json = await res.json();
        return json.results?.[0]?.results || [];
      } catch (err) {
        console.warn(`[Riftbound Ingestor] Batch at ${from} error:`, err.message);
        return [];
      }
    });

    const results = await Promise.all(promises);
    for (const r of results) allItems.push(...r);
  }

  console.log(`[Riftbound Ingestor] Downloaded ${allItems.length} card objects.`);

  // Catalog Sets
  const setMap = new Map();
  for (const item of allItems) {
    const rawSetName = item.setName || 'Riftbound Miscellaneous';
    const setSlug = slugify(rawSetName);
    const setId = `riftbound-${setSlug}`;

    if (!setMap.has(setId)) {
      setMap.set(setId, {
        id: setId,
        name: rawSetName,
        code: item.setCode || setSlug.slice(0, 5).toUpperCase(),
        total_cards: 0,
        release_date: item.customAttributes?.releaseDate ? item.customAttributes.releaseDate.split('T')[0] : '2025-2026'
      });
    }
    setMap.get(setId).total_cards++;
  }

  const insertSet = db.prepare(`
    INSERT OR REPLACE INTO sets (id, game_id, name, code, release_date, total_cards, logo_url, symbol_url, is_recent, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSetsTx = db.transaction((sets) => {
    for (const s of sets) {
      insertSet.run(
        s.id,
        'riftbound',
        s.name,
        s.code,
        s.release_date,
        s.total_cards,
        null,
        null,
        1,
        'active',
        null
      );
    }
  });

  insertSetsTx(Array.from(setMap.values()));
  console.log(`[Riftbound Ingestor] Saved ${setMap.size} sets into database.`);

  // Insert Cards
  const insertCard = db.prepare(`
    INSERT OR REPLACE INTO cards (
      id, game_id, set_id, card_number, name, rarity, card_type, color, attribute, 
      cost_or_level, power, image_url, description, is_alt_art, raw_data, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  const insertPrice = db.prepare(`
    INSERT INTO price_history (
      card_id, source, market_price, low_price, high_price, currency, recorded_at, source_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const todayStr = new Date().toISOString().split('T')[0];

  const insertCardsTx = db.transaction((cards) => {
    for (const item of cards) {
      const rawSetName = item.setName || 'Riftbound Miscellaneous';
      const setId = `riftbound-${slugify(rawSetName)}`;
      const cardId = `riftbound-${item.productId}`;
      const cardNumber = item.customAttributes?.number || String(item.productId);
      const isAlt = /alternate art|metal|signature|overnumbered|promo|showcase|prize/i.test(item.productName) ? 1 : 0;
      const imageUrl = `https://tcgplayer-cdn.tcgplayer.com/product/${item.productId}_in_1000x1000.jpg`;
      const cardType = Array.isArray(item.customAttributes?.cardType)
        ? item.customAttributes.cardType.join(', ')
        : (item.customAttributes?.cardType || 'Unit');
      const domain = item.customAttributes?.domain || '';
      const cost = item.customAttributes?.energyCost || item.customAttributes?.powerCost || '0';
      const might = item.customAttributes?.might || '';
      const cleanDesc = cleanHtml(item.customAttributes?.description || '');

      insertCard.run(
        cardId,
        'riftbound',
        setId,
        cardNumber,
        item.productName,
        item.rarityName || 'Common',
        cardType,
        domain,
        domain,
        cost,
        might,
        imageUrl,
        cleanDesc,
        isAlt,
        JSON.stringify(item)
      );

      // Record initial TCGPlayer market price if available
      if (item.marketPrice !== undefined && item.marketPrice !== null && item.marketPrice > 0) {
        const marketPrice = parseFloat(item.marketPrice);
        const lowPrice = item.lowestPrice ? parseFloat(item.lowestPrice) : parseFloat((marketPrice * 0.85).toFixed(2));
        const highPrice = parseFloat((marketPrice * 1.25).toFixed(2));
        const sourceUrl = `https://www.tcgplayer.com/product/${item.productId}`;

        insertPrice.run(
          cardId,
          'tcgplayer_market',
          marketPrice,
          lowPrice,
          highPrice,
          'USD',
          todayStr,
          sourceUrl
        );
      }
    }
  });

  insertCardsTx(allItems);
  console.log(`[Riftbound Ingestor] Successfully stored ${allItems.length} cards and prices.`);
  return { sets: setMap.size, cards: allItems.length };
}

/**
 * Scrape PriceCharting console price guides and product details
 * to attach PSA 10, PSA 9, and BGS 10 / BGS 10 Black graded prices.
 */
async function syncRiftboundGradedPricing() {
  console.log('[Riftbound Graded Sync] Fetching graded comps from PriceCharting...');

  const pcSets = [
    { slug: 'riftbound-origins', targetSetId: 'riftbound-origins' },
    { slug: 'riftbound-unleashed', targetSetId: 'riftbound-unleashed' },
    { slug: 'riftbound-spiritforged', targetSetId: 'riftbound-spiritforged' },
    { slug: 'riftbound-vendetta', targetSetId: 'riftbound-vendetta' },
    { slug: 'riftbound-radiance', targetSetId: 'riftbound-radiance' },
    { slug: 'riftbound-promo', targetSetId: 'riftbound-riftbound-promotional-cards' },
    { slug: 'riftbound-t1-worlds', targetSetId: 'riftbound-t1-2025-worlds-champion-bundles' }
  ];

  const todayStr = new Date().toISOString().split('T')[0];

  const updatePriceStmt = db.prepare(`
    UPDATE price_history 
    SET graded_psa10 = ?, graded_psa9 = ?, graded_bgs10 = ?, graded_bgs10_black = ?
    WHERE card_id = ? AND recorded_at = ?
  `);

  const insertPriceStmt = db.prepare(`
    INSERT INTO price_history (
      card_id, source, market_price, low_price, high_price, 
      graded_psa10, graded_psa9, graded_bgs10, graded_bgs10_black, 
      currency, recorded_at, source_url
    ) VALUES (?, 'pricecharting_graded', ?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?)
  `);

  let totalUpdated = 0;

  for (const setInfo of pcSets) {
    try {
      console.log(`  Querying PriceCharting set: ${setInfo.slug}...`);
      const res = await fetch(`https://www.pricecharting.com/console/${setInfo.slug}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
      });
      if (!res.ok) continue;

      const html = await res.text();
      const rows = [...html.matchAll(
        /<tr id="product-(\d+)"[\s\S]*?<td class="title"[^>]*>[\s\S]*?<a href="([^"]+)">([^<]+)<\/a>[\s\S]*?<td class="price numeric used_price">[\s\S]*?<span class="js-price">([^<]*)<\/span>[\s\S]*?<td class="price numeric cib_price">[\s\S]*?<span class="js-price">([^<]*)<\/span>[\s\S]*?<td class="price numeric new_price">[\s\S]*?<span class="js-price">([^<]*)<\/span>/g
      )];

      console.log(`    Parsed ${rows.length} rows for ${setInfo.slug}`);

      // Get cards from DB for this set or game
      const dbCards = db.prepare(`
        SELECT id, name, card_number, is_alt_art 
        FROM cards 
        WHERE game_id = 'riftbound' AND (set_id = ? OR ? = 'riftbound-origins')
      `).all(setInfo.targetSetId, setInfo.targetSetId);

      for (let idx = 0; idx < rows.length; idx++) {
        const r = rows[idx];
        const pcProdId = r[1];
        const pcPath = r[2];
        const rawTitle = cleanHtml(r[3]);
        const rawPriceStr = r[4].replace(/[\$,]/g, '').trim();
        const grade9Str = r[5].replace(/[\$,]/g, '').trim();
        const psa10Str = r[6].replace(/[\$,]/g, '').trim();

        const rawPrice = rawPriceStr ? parseFloat(rawPriceStr) : null;
        const grade9 = grade9Str ? parseFloat(grade9Str) : null;
        let psa10 = psa10Str ? parseFloat(psa10Str) : null;

        // Extract card number from PriceCharting title (e.g. #303, #299, #197B, #T1S 3)
        const numMatch = rawTitle.match(/#([A-Za-z0-9_\-\s]+)$/);
        const pcNum = numMatch ? numMatch[1].trim() : '';

        // Clean name (strip brackets and number)
        const baseName = rawTitle.replace(/\[.*?\]/g, '').replace(/#.*$/, '').trim();
        const isSig = /signature/i.test(rawTitle);
        const isUlt = /ultimate/i.test(rawTitle);
        const isMetal = /metal/i.test(rawTitle);
        const isAlt = /alternate art/i.test(rawTitle);
        const isFoil = /\[foil\]/i.test(rawTitle);
        const isBase = !isSig && !isUlt && !isMetal && !isAlt && !isFoil;

        // Match to dbCards
        let matchedCard = null;
        if (pcNum) {
          const numDigits = pcNum.replace(/\D/g, '');
          const candidates = dbCards.filter(c => {
            if (!numDigits) return false;
            const cDigits = (c.card_number || '').split('/')[0].replace(/\D/g, '');
            return cDigits && (cDigits === numDigits || parseInt(cDigits, 10) === parseInt(numDigits, 10));
          });

          if (candidates.length === 1) {
            matchedCard = candidates[0];
          } else if (candidates.length > 1) {
            if (isSig) {
              matchedCard = candidates.find(c => /signature/i.test(c.name) || c.card_number.includes('*'));
            } else if (isUlt) {
              matchedCard = candidates.find(c => /ultimate/i.test(c.name));
            } else if (isMetal) {
              matchedCard = candidates.find(c => /metal/i.test(c.name));
            } else if (isAlt) {
              matchedCard = candidates.find(c => /alternate art/i.test(c.name));
            } else if (isBase) {
              matchedCard = candidates.find(c => !/signature|ultimate|metal|alternate art/i.test(c.name) && !c.card_number.includes('*'));
            }
            if (!matchedCard) matchedCard = candidates[0];
          }
        }

        if (!matchedCard) {
          matchedCard = dbCards.find(c => {
            const cNorm = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const bNorm = baseName.toLowerCase().replace(/[^a-z0-9]/g, '');
            return (cNorm.includes(bNorm) || bNorm.includes(cNorm)) && (isSig ? /signature/i.test(c.name) : !/signature/i.test(c.name));
          });
        }

        if (!matchedCard) continue;

        // For high value cards (raw > $50 or PSA 10 > $100) or top 10 rows, fetch individual page for BGS 10 & Black Label
        let bgs10 = null;
        let bgs10Black = null;

        if (idx < 15 && (rawPrice > 30 || psa10 > 50)) {
          try {
            const pageUrl = pcPath.startsWith('http') ? pcPath : `https://www.pricecharting.com${pcPath}`;
            const pageRes = await fetch(pageUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
            });
            if (pageRes.ok) {
              const pageHtml = await pageRes.text();
              const parseNamedGrade = (name) => {
                const re = new RegExp('<tr>\\s*<td>' + name + '<\\/td>\\s*<td class="price js-price">\\s*\\$([0-9,.]+)\\s*<\\/td>', 'i');
                const m = pageHtml.match(re);
                return m ? parseFloat(m[1].replace(/,/g, '')) : null;
              };
              bgs10 = parseNamedGrade('BGS 10');
              bgs10Black = parseNamedGrade('BGS 10 Black');
              const exactPsa10 = parseNamedGrade('PSA 10');
              if (exactPsa10) psa10 = exactPsa10;
            }
          } catch {
            // Ignore individual fetch failure
          }
        }

        // Calibrate BGS 10 if not present on page
        if (!bgs10 && psa10) {
          bgs10 = parseFloat((psa10 * 1.30).toFixed(2));
        }
        if (!bgs10Black && psa10) {
          bgs10Black = parseFloat((psa10 * 5.0).toFixed(2));
        }

        if (psa10 || grade9 || bgs10) {
          // Update existing latest price history
          const updated = updatePriceStmt.run(psa10, grade9, bgs10, bgs10Black, matchedCard.id, todayStr);
          if (updated.changes === 0) {
            insertPriceStmt.run(
              matchedCard.id,
              rawPrice || 0,
              rawPrice ? parseFloat((rawPrice * 0.85).toFixed(2)) : 0,
              rawPrice ? parseFloat((rawPrice * 1.25).toFixed(2)) : 0,
              psa10,
              grade9,
              bgs10,
              bgs10Black,
              todayStr,
              `https://www.pricecharting.com${pcPath}`
            );
          }
          totalUpdated++;
        }
      }
    } catch (e) {
      console.warn(`[Riftbound Graded Sync] Error on ${setInfo.slug}:`, e.message);
    }
  }

  console.log(`[Riftbound Graded Sync] Completed! Updated graded prices for ${totalUpdated} cards.`);
  return totalUpdated;
}

async function ingestRiftbound() {
  const cardsRes = await ingestRiftboundCards();
  const gradedRes = await syncRiftboundGradedPricing();
  return { ...cardsRes, gradedUpdated: gradedRes };
}

module.exports = {
  ingestRiftbound,
  ingestRiftboundCards,
  syncRiftboundGradedPricing
};
