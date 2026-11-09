const db = require('../db');

const BASE_API = 'https://api.deckplanet.net/cardsearch/fusion_world_cards?limit=500';

async function ingestFusionWorld(maxPages = 3) {
  console.log(`[DBS Fusion World Ingestor] Fetching Fusion World cards (up to ${maxPages} pages)...`);
  
  const allCards = [];
  for (let page = 1; page <= maxPages; page++) {
    try {
      const res = await fetch(`${BASE_API}&page=${page}`);
      if (!res.ok) break;
      const json = await res.json();
      const list = json.data || [];
      if (list.length === 0) break;
      allCards.push(...list);
      console.log(`  Fetched page ${page}: ${list.length} cards`);
      if (page >= (json.meta?.page_count || maxPages)) break;
    } catch (e) {
      console.error(`  Error on page ${page}:`, e.message);
      break;
    }
  }

  const insertSet = db.prepare(`
    INSERT OR REPLACE INTO sets (id, game_id, name, code, release_date, total_cards, logo_url, symbol_url, is_recent, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertCard = db.prepare(`
    INSERT OR REPLACE INTO cards (id, game_id, set_id, card_number, name, rarity, card_type, color, attribute, cost_or_level, power, image_url, description, is_alt_art, raw_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Detect and catalog sets from card series codes
  const setMap = new Map();
  for (const c of allCards) {
    const series = c.card_series || (c.card_number ? c.card_number.split('-')[0] : 'PROMO');
    if (!setMap.has(series)) {
      let setName = series;
      if (series === 'FB01') setName = 'Awakened Pulse [FB01]';
      else if (series === 'FB02') setName = 'Blazing Aura [FB02]';
      else if (series === 'FB03') setName = 'Raging Roar [FB03]';
      else if (series === 'FB04') setName = 'Ultra Limit [FB04]';
      else if (series.startsWith('FS')) setName = `Starter Deck [${series}]`;
      else if (series.startsWith('FP')) setName = 'Promotional Cards [FP]';

      setMap.set(series, {
        id: `fusionworld-${series}`,
        name: setName,
        code: series,
        total: 0
      });
    }
    setMap.get(series).total++;
  }

  console.log(`[DBS Fusion World Ingestor] Identified ${setMap.size} sets (all 2024-2026 releases).`);

  const insertSetsTx = db.transaction((sets) => {
    for (const s of sets) {
      insertSet.run(
        s.id,
        'fusionworld',
        s.name,
        s.code,
        '2024-2026',
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

  console.log(`[DBS Fusion World Ingestor] Ingesting ${allCards.length} cards...`);

  const insertCardsTx = db.transaction((cards) => {
    for (const c of cards) {
      const series = c.card_series || (c.card_number ? c.card_number.split('-')[0] : 'PROMO');
      const setId = `fusionworld-${series}`;
      const isAlt = (c.card_rarity && (c.card_rarity.includes('SCR') || c.card_rarity.includes('Alt') || c.card_rarity.includes('SP') || c.card_rarity.includes('★'))) ? 1 : 0;
      
      const imageUrl = `https://dbs-deckplanet.us-southeast-1.linodeobjects.com/deckplanet_card_images/${c.card_number}.png`;
      const cleanSkill = (c.card_skill || '').replace(/<[^>]+>/g, ' ');

      insertCard.run(
        `fusionworld-${c.card_number}`,
        'fusionworld',
        setId,
        c.card_number,
        c.card_name || 'Unknown Card',
        c.card_rarity || 'Common',
        c.card_type || 'Battle',
        c.card_color || '',
        c.card_traits ? (Array.isArray(c.card_traits) ? c.card_traits.join(', ') : c.card_traits) : '',
        c.card_energy_cost ? `Energy ${c.card_energy_cost}` : '',
        c.card_power ? `${c.card_power} Power` : '',
        imageUrl,
        cleanSkill,
        isAlt,
        JSON.stringify(c)
      );
    }
  });

  insertCardsTx(allCards);
  console.log(`[DBS Fusion World Ingestor] Successfully ingested ${allCards.length} cards across ${setMap.size} sets.`);

  return { sets: setMap.size, cards: allCards.length };
}

module.exports = { ingestFusionWorld };
