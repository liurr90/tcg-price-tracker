const db = require('../db');

const CARDS_URL = 'https://raw.githubusercontent.com/yzRobo/gcg-api/main/data/cards.json';
const PRODUCTS_URL = 'https://raw.githubusercontent.com/yzRobo/gcg-api/main/data/products.json';

async function ingestGundam() {
  console.log('[Gundam Ingestor] Fetching Gundam Card Game cards and products...');
  const [cardsRes, productsRes] = await Promise.all([
    fetch(CARDS_URL),
    fetch(PRODUCTS_URL).catch(() => null)
  ]);

  if (!cardsRes.ok) throw new Error(`Failed to fetch Gundam cards: ${cardsRes.statusText}`);
  const cards = await cardsRes.json();

  let products = [];
  if (productsRes && productsRes.ok) {
    products = await productsRes.json();
  }

  const insertSet = db.prepare(`
    INSERT OR REPLACE INTO sets (id, game_id, name, code, release_date, total_cards, logo_url, symbol_url, is_recent, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertCard = db.prepare(`
    INSERT OR REPLACE INTO cards (id, game_id, set_id, card_number, name, rarity, card_type, color, attribute, cost_or_level, power, image_url, description, is_alt_art, raw_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Detect sets from cards and products
  const setMap = new Map();
  for (const c of cards) {
    const setCode = c.set_code || (c.card_number ? c.card_number.split('-')[0] : 'PROMO');
    const setName = c.set_name || `Set ${setCode}`;
    if (!setMap.has(setCode)) {
      setMap.set(setCode, {
        id: `gundam-${setCode}`,
        name: setName,
        code: setCode,
        total: 0
      });
    }
    setMap.get(setCode).total++;
  }

  console.log(`[Gundam Ingestor] Found ${setMap.size} Gundam sets (all 2025-2026 releases).`);

  const insertSetsTx = db.transaction((sets) => {
    for (const s of sets) {
      insertSet.run(
        s.id,
        'gundam',
        s.name,
        s.code,
        '2025-2026',
        s.total,
        null,
        null,
        1,
        'active',
        null
      );
    }
  });

  insertSetsTx(Array.from(setMap.values()));

  console.log(`[Gundam Ingestor] Ingesting ${cards.length} cards...`);

  const insertCardsTx = db.transaction((cardList) => {
    for (const c of cardList) {
      const setCode = c.set_code || (c.card_number ? c.card_number.split('-')[0] : 'PROMO');
      const setId = `gundam-${setCode}`;
      const isAlt = (c.rarity && (c.rarity.includes('SEC') || c.rarity.includes('Parallel') || c.rarity.includes('SP') || c.rarity.includes('LR'))) ? 1 : 0;
      
      insertCard.run(
        `gundam-${c.card_number}`,
        'gundam',
        setId,
        c.card_number,
        c.name || 'Unknown Gundam Card',
        c.rarity || 'Common',
        c.card_type || 'Unit',
        c.color || '',
        c.trait || (c.traits ? c.traits.join(', ') : ''),
        c.cost !== undefined ? `Cost ${c.cost} (Lvl ${c.level || 0})` : '',
        (c.ap !== undefined && c.hp !== undefined) ? `AP ${c.ap} / HP ${c.hp}` : '',
        c.image_url || '',
        c.effect || '',
        isAlt,
        JSON.stringify(c)
      );
    }
  });

  insertCardsTx(cards);
  console.log(`[Gundam Ingestor] Successfully ingested ${cards.length} cards.`);

  return { sets: setMap.size, cards: cards.length };
}

module.exports = { ingestGundam };
