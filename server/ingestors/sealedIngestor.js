const db = require('../db');

const TCGPLAYER_SEARCH_API = 'https://mp-search-api.tcgplayer.com/v1/search/request';

const SEALED_KEYWORDS = /\b(booster box|booster display|booster pack|booster bundle|display case|booster case|case\b|elite trainer box|\betb\b|starter deck|theme deck|pre-release kit|prerelease kit|prerelease pack|double pack|collection box|ultra-premium collection|ultra premium collection|\bupc\b|bundle\b|gift set|tin\b|blister pack|special collection|battle deck|v battle deck|league battle deck|showdown deck|pre-rift kit|vault bundle|sealed)\b/i;

function isSealedName(name) {
  if (!name) return false;
  if (/^sleeves?\b|deck protector|playmat|binder|portfolio|card divider/i.test(name)) return false;
  return SEALED_KEYWORDS.test(name);
}

function determineCardType(name) {
  if (/case\b/i.test(name)) return 'Booster Box Case';
  if (/display\b/i.test(name)) return 'Booster Display';
  if (/booster box/i.test(name)) return 'Booster Box';
  if (/elite trainer box|\betb\b/i.test(name)) return 'Elite Trainer Box';
  if (/starter deck|theme deck|battle deck/i.test(name)) return 'Starter Deck';
  if (/bundle|vault bundle/i.test(name)) return 'Bundle';
  if (/double pack/i.test(name)) return 'Double Pack';
  if (/collection box|ultra-premium|\bupc\b/i.test(name)) return 'Collection Box';
  if (/pack\b/i.test(name)) return 'Booster Pack';
  return 'Sealed Product';
}

/**
 * Update existing cards in the DB that match sealed product keywords
 */
function classifyExistingCards() {
  console.log('[Sealed Ingestor] Classifying existing sealed items in cards table...');
  const allCards = db.prepare('SELECT id, name, card_type FROM cards').all();

  const updateStmt = db.prepare('UPDATE cards SET is_sealed = 1, card_type = ? WHERE id = ?');
  let count = 0;

  const tx = db.transaction(() => {
    for (const c of allCards) {
      if (isSealedName(c.name)) {
        const type = determineCardType(c.name);
        updateStmt.run(type, c.id);
        count++;
      }
    }
  });

  tx();
  console.log(`[Sealed Ingestor] Marked ${count} existing cards as is_sealed = 1.`);
  return count;
}

/**
 * Fetch and ingest sealed products from TCGPlayer across all games
 */
async function ingestAllSealedProducts() {
  console.log('[Sealed Ingestor] Starting sealed products ingestion for all TCGs...');

  // Ensure is_sealed column and index exist
  try {
    db.prepare('ALTER TABLE cards ADD COLUMN is_sealed INTEGER DEFAULT 0').run();
  } catch {
    // Column already exists
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_cards_is_sealed ON cards(is_sealed);');

  // Step 1: Mark all existing cards
  classifyExistingCards();

  const sets = db.prepare('SELECT id, game_id, name, code FROM sets').all();

  function findBestSet(gameId, tcgSetName) {
    const norm = str => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const tcgNorm = norm(tcgSetName);
    const gameSets = sets.filter(s => s.game_id === gameId);

    const found = gameSets.find(s => {
      const sNorm = norm(s.name);
      return sNorm === tcgNorm || sNorm.includes(tcgNorm) || tcgNorm.includes(sNorm) || (s.code && tcgNorm.includes(norm(s.code)));
    });

    if (found) return found.id;
    // Fallback: return first active set or create generic sealed set
    const fallback = gameSets[0]?.id || `${gameId}-sealed`;
    return fallback;
  }

  const GAME_CONFIGS = [
    {
      gameId: 'onepiece',
      productLine: 'One Piece Card Game',
      queries: ['Booster Box', 'Booster Pack', 'Double Pack', 'Starter Deck', 'Booster Box Case']
    },
    {
      gameId: 'pokemon',
      productLine: 'Pokemon',
      queries: ['Booster Box', 'Elite Trainer Box', 'Booster Bundle', 'Ultra Premium Collection', 'Booster Box Case', 'Starter Set']
    },
    {
      gameId: 'fusionworld',
      productLine: 'Dragon Ball Super: Fusion World',
      queries: ['Booster Box', 'Starter Deck', 'Booster Pack', 'Booster Box Case']
    },
    {
      gameId: 'gundam',
      productLine: null,
      queries: ['Gundam Card Game Booster Box', 'Gundam Card Game Edition Beta Box', 'Gundam Card Game Starter Deck', 'Gundam Card Game Booster Pack']
    },
    {
      gameId: 'riftbound',
      productLine: 'Riftbound: League of Legends Trading Card Game',
      queries: ['Booster Display', 'Booster Display Case', 'Vault Bundle', 'Pre-Rift Kit', 'Showdown Decks']
    }
  ];

  const insertCard = db.prepare(`
    INSERT OR REPLACE INTO cards (
      id, game_id, set_id, card_number, name, rarity, card_type, 
      color, attribute, cost_or_level, power, image_url, description, 
      is_alt_art, is_sealed, raw_data, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  const insertPrice = db.prepare(`
    INSERT INTO price_history (
      card_id, source, market_price, low_price, high_price, currency, recorded_at, source_url
    ) VALUES (?, 'tcgplayer_market', ?, ?, ?, 'USD', ?, ?)
  `);

  const todayStr = new Date().toISOString().split('T')[0];
  let totalNewSealed = 0;

  for (const cfg of GAME_CONFIGS) {
    console.log(`[Sealed Ingestor] Fetching sealed products for ${cfg.gameId}...`);
    const seenIds = new Set();
    const items = [];

    for (const q of cfg.queries) {
      try {
        const body = {
          algorithm: 'sales_synonym_v2',
          from: 0,
          size: 50
        };
        if (cfg.productLine) {
          body.filters = { term: { productLineName: [cfg.productLine] } };
        }

        const url = `${TCGPLAYER_SEARCH_API}?q=${encodeURIComponent(q)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
          body: JSON.stringify(body)
        });

        if (!res.ok) continue;
        const data = await res.json();
        const results = data.results?.[0]?.results || [];

        for (const item of results) {
          if (!seenIds.has(item.productId) && isSealedName(item.productName)) {
            seenIds.add(item.productId);
            items.push(item);
          }
        }
      } catch (err) {
        console.warn(`[Sealed Ingestor] Query "${q}" error:`, err.message);
      }
    }

    console.log(`  Found ${items.length} unique sealed products for ${cfg.gameId}.`);

    const insertTx = db.transaction((list) => {
      for (const item of list) {
        const cardId = `${cfg.gameId}-${item.productId}`;
        const setId = findBestSet(cfg.gameId, item.setName);
        const cardType = determineCardType(item.productName);
        const imageUrl = `https://tcgplayer-cdn.tcgplayer.com/product/${item.productId}_in_1000x1000.jpg`;
        const description = (item.customAttributes?.description || '').replace(/<[^>]+>/g, ' ');

        insertCard.run(
          cardId,
          cfg.gameId,
          setId,
          String(item.productId),
          item.productName,
          'Sealed',
          cardType,
          '',
          '',
          '0',
          '',
          imageUrl,
          description,
          0,
          1, // is_sealed = 1
          JSON.stringify(item)
        );

        if (item.marketPrice !== undefined && item.marketPrice !== null && item.marketPrice > 0) {
          const marketPrice = parseFloat(item.marketPrice);
          const lowPrice = item.lowestPrice ? parseFloat(item.lowestPrice) : parseFloat((marketPrice * 0.85).toFixed(2));
          const highPrice = parseFloat((marketPrice * 1.25).toFixed(2));
          const sourceUrl = `https://www.tcgplayer.com/product/${item.productId}`;

          // Delete duplicate price for today if already present
          db.prepare('DELETE FROM price_history WHERE card_id = ? AND recorded_at = ? AND source = ?')
            .run(cardId, todayStr, 'tcgplayer_market');

          insertPrice.run(
            cardId,
            marketPrice,
            lowPrice,
            highPrice,
            todayStr,
            sourceUrl
          );
        }
        totalNewSealed++;
      }
    });

    insertTx(items);
  }

  console.log(`[Sealed Ingestor] Completed! Ingested/updated ${totalNewSealed} sealed products across all games.`);
  return totalNewSealed;
}

module.exports = {
  ingestAllSealedProducts,
  classifyExistingCards,
  isSealedName,
  determineCardType
};
