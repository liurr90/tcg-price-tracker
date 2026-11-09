const db = require('../db');

const TCGPLAYER_SEARCH_API = 'https://mp-search-api.tcgplayer.com/v1/search/request';

const SEALED_KEYWORDS = /\b(booster box|booster display|booster pack|booster bundle|display case|booster case|case\b|elite trainer box|\betb\b|starter deck|theme deck|pre-release kit|prerelease kit|prerelease pack|double pack|collection box|ultra-premium collection|ultra premium collection|\bupc\b|bundle\b|gift set|tin\b|blister pack|special collection|battle deck|v battle deck|league battle deck|showdown deck|pre-rift kit|vault bundle|sealed)\b/i;

function isSealedName(name) {
  if (!name) return false;
  if (/^sleeves?\b|deck protector|playmat|binder|portfolio|card divider/i.test(name)) return false;
  if (/^don!!\b|don!!\s+card/i.test(name)) return false;
  if (/^code card\b/i.test(name)) return false;
  return SEALED_KEYWORDS.test(name);
}

function isCaseProduct(name, cardType = '') {
  if (!name) return false;
  if (/^sleeves?\b|deck protector|playmat|binder|portfolio/i.test(name)) return false;
  
  // Explicit "case"
  if (/\bcase\b/i.test(name) || /case/i.test(cardType)) return true;

  // Wholesale bulk displays that function as cases of consumer units (bundles, double packs, starter decks, tins)
  if (/bundle\s+display\b/i.test(name)) return true;
  if (/double\s+pack.*display\b/i.test(name)) return true;
  if (/tin\s+pack.*display\b/i.test(name)) return true;
  if (/starter\s+(deck|set).*display\b|deck\s+display\b/i.test(name)) return true;

  return false;
}

function determineCardType(name) {
  if (/case\b/i.test(name)) return 'Booster Box Case';
  if (/bundle\s+display\b/i.test(name)) return 'Booster Box Case';
  if (/double\s+pack.*display\b/i.test(name)) return 'Booster Box Case';
  if (/tin\s+pack.*display\b/i.test(name)) return 'Booster Box Case';
  if (/starter\s+(deck|set).*display\b|deck\s+display\b/i.test(name)) return 'Booster Box Case';
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
 * Ensure database schema has is_case and case_product_id columns
 */
function ensureColumns() {
  try { db.prepare('ALTER TABLE cards ADD COLUMN is_sealed INTEGER DEFAULT 0').run(); } catch {}
  try { db.prepare('ALTER TABLE cards ADD COLUMN is_case INTEGER DEFAULT 0').run(); } catch {}
  try { db.prepare('ALTER TABLE cards ADD COLUMN case_product_id TEXT').run(); } catch {}
  db.exec('CREATE INDEX IF NOT EXISTS idx_cards_is_sealed ON cards(is_sealed);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_cards_is_case ON cards(is_case);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_cards_case_product_id ON cards(case_product_id);');
}

/**
 * Update existing cards in the DB that match sealed product keywords
 */
function classifyExistingCards() {
  console.log('[Sealed Ingestor] Classifying existing sealed items in cards table...');
  ensureColumns();

  const allCards = db.prepare('SELECT id, name, card_type FROM cards').all();
  const updateSealedStmt = db.prepare('UPDATE cards SET is_sealed = 1, is_case = ?, card_type = ? WHERE id = ?');
  const updateSinglesStmt = db.prepare('UPDATE cards SET is_sealed = 0, is_case = 0 WHERE id = ?');
  let count = 0;

  const tx = db.transaction(() => {
    for (const c of allCards) {
      if (isSealedName(c.name)) {
        const type = determineCardType(c.name);
        const isCase = isCaseProduct(c.name, type) ? 1 : 0;
        updateSealedStmt.run(isCase, type, c.id);
        count++;
      } else {
        updateSinglesStmt.run(c.id);
      }
    }
  });

  tx();
  console.log(`[Sealed Ingestor] Marked ${count} existing cards as is_sealed = 1.`);
  linkBoxesAndCases();
  return count;
}

/**
 * Link each individual sealed product (Box / Display / Bundle / Deck) to its Case listing
 * and vice versa.
 */
function linkBoxesAndCases() {
  console.log('[Sealed Ingestor] Linking Boxes and Cases...');
  // Clear any existing stale links
  db.prepare('UPDATE cards SET case_product_id = NULL WHERE case_product_id IS NOT NULL').run();

  const cases = db.prepare(`
    SELECT c.id, c.game_id, c.name, c.set_id, p.market_price
    FROM cards c
    LEFT JOIN price_history p ON p.id = (
      SELECT id FROM price_history WHERE card_id = c.id ORDER BY recorded_at DESC, id DESC LIMIT 1
    )
    WHERE c.is_sealed = 1 AND c.is_case = 1
    ORDER BY (p.market_price IS NOT NULL AND p.market_price > 0) DESC, c.id ASC
  `).all();

  const boxes = db.prepare(`
    SELECT c.id, c.game_id, c.name, c.set_id, p.market_price
    FROM cards c
    LEFT JOIN price_history p ON p.id = (
      SELECT id FROM price_history WHERE card_id = c.id ORDER BY recorded_at DESC, id DESC LIMIT 1
    )
    WHERE c.is_sealed = 1 AND c.is_case = 0
    ORDER BY (p.market_price IS NOT NULL AND p.market_price > 0) DESC, c.id ASC
  `).all();

  const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const updatePairStmt = db.prepare('UPDATE cards SET case_product_id = ? WHERE id = ?');
  const boxLinkedMap = new Map(); // boxId -> case object

  let paired = 0;
  const tx = db.transaction(() => {
    for (const kase of cases) {
      // Possible target names to match against individual boxes:
      // 1. Strip "case"
      // 2. Strip "display case" or "display" (for Bundle Displays, Double Pack Displays, etc.)
      const strippedCase = kase.name.replace(/\s*case\b/gi, '').trim();
      const strippedDisplay = kase.name.replace(/\s*(display\s*case|display|case)\b/gi, '').trim();
      const candidateNorms = [norm(strippedCase), norm(strippedDisplay)].filter((v, i, a) => v && a.indexOf(v) === i);

      const gameBoxes = boxes.filter(b => b.game_id === kase.game_id);

      let match = null;

      // 1. Exact match on stripped name
      for (const cNorm of candidateNorms) {
        match = gameBoxes.find(b => norm(b.name) === cNorm);
        if (match) break;
      }

      // 2. Exact match within same set
      if (!match) {
        for (const cNorm of candidateNorms) {
          match = gameBoxes.find(b => b.set_id === kase.set_id && (norm(b.name).includes(cNorm) || cNorm.includes(norm(b.name))));
          if (match) break;
        }
      }

      // 3. Fallback: startsWith / endsWith match
      if (!match) {
        for (const cNorm of candidateNorms) {
          match = gameBoxes.find(b => {
            const bNorm = norm(b.name);
            return (bNorm.length >= 8 && cNorm.length >= 8) && (bNorm.startsWith(cNorm) || cNorm.startsWith(bNorm));
          });
          if (match) break;
        }
      }

      if (match) {
        // Case points to the box
        updatePairStmt.run(match.id, kase.id);

        // Box points to the case (prefer case with market_price if already linked)
        const currentLink = boxLinkedMap.get(match.id);
        const shouldUpdateBox = !currentLink || (!currentLink.market_price && kase.market_price);
        if (shouldUpdateBox) {
          updatePairStmt.run(kase.id, match.id);
          boxLinkedMap.set(match.id, kase);
        }
        paired++;
      }
    }
  });

  tx();
  console.log(`[Sealed Ingestor] Successfully paired ${paired} Boxes <-> Cases.`);
  return paired;
}

/**
 * Fetch and ingest sealed products from TCGPlayer across all games
 */
async function ingestAllSealedProducts() {
  console.log('[Sealed Ingestor] Starting sealed products ingestion for all TCGs...');
  ensureColumns();

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
    return gameSets[0]?.id || `${gameId}-sealed`;
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
      is_alt_art, is_sealed, is_case, raw_data, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
        const isCase = isCaseProduct(item.productName, cardType) ? 1 : 0;
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
          isCase, // is_case = 1 or 0
          JSON.stringify(item)
        );

        if (item.marketPrice !== undefined && item.marketPrice !== null && item.marketPrice > 0) {
          const marketPrice = parseFloat(item.marketPrice);
          const lowPrice = item.lowestPrice ? parseFloat(item.lowestPrice) : parseFloat((marketPrice * 0.85).toFixed(2));
          const highPrice = parseFloat((marketPrice * 1.25).toFixed(2));
          const sourceUrl = `https://www.tcgplayer.com/product/${item.productId}`;

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

  // Pair all boxes with their cases
  linkBoxesAndCases();

  console.log(`[Sealed Ingestor] Completed! Ingested/updated ${totalNewSealed} sealed products across all games.`);
  return totalNewSealed;
}

module.exports = {
  ingestAllSealedProducts,
  classifyExistingCards,
  linkBoxesAndCases,
  isSealedName,
  isCaseProduct,
  determineCardType
};
