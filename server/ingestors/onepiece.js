const db = require('../db');

const PACKS_URL = 'https://raw.githubusercontent.com/buhbbl/punk-records/main/english/packs.json';
const DATA_BASE_URL = 'https://raw.githubusercontent.com/buhbbl/punk-records/main/english/data';

// Top booster sets & starter decks to prioritize
const PRIORITY_PACK_PREFIXES = ['OP-01', 'OP-02', 'OP-03', 'OP-04', 'OP-05', 'OP-06', 'OP-07', 'OP-08', 'OP-09', 'ST-01', 'ST-02', 'ST-03', 'ST-04', 'ST-10'];

function cleanOnePieceSetName(raw, code) {
  let s = raw || '';
  s = s.replace(/^(BOOSTER PACK|STARTER DECK EX|STARTER DECK|ULTRA DECK|EXTRA BOOSTER|PREMIUM BOOSTER)\s*[-:]?\s*/i, '');
  s = s.replace(/\s*\[.*?\]\s*$/, '');
  s = s.replace(/^-\s*|\s*-$/g, '').trim();
  s = s.replace(/&amp;/g, '&');
  
  if (s === s.toUpperCase() && s.length > 3) {
    s = s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  if (code && !code.startsWith('569')) {
    return s ? `[${code}] ${s}` : `[${code}] Booster Pack`;
  }
  return s || `Set ${code}`;
}

async function ingestOnePiece(options = { loadAll: true }) {
  console.log('[One Piece Ingestor] Fetching OPTCG pack listings...');
  const res = await fetch(PACKS_URL);
  if (!res.ok) throw new Error(`Failed to fetch packs: ${res.statusText}`);
  const packs = await res.json();

  const insertSet = db.prepare(`
    INSERT OR REPLACE INTO sets (id, game_id, name, code, release_date, total_cards, logo_url, symbol_url, is_recent, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertCard = db.prepare(`
    INSERT OR REPLACE INTO cards (id, game_id, set_id, card_number, name, rarity, card_type, color, attribute, cost_or_level, power, image_url, description, is_alt_art, raw_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateSetCount = db.prepare(`
    UPDATE sets SET total_cards = ? WHERE id = ?
  `);

  const packEntries = Object.entries(packs);
  console.log(`[One Piece Ingestor] Found ${packEntries.length} packs/sets. Ingesting full card database for all 61 sets...`);

  const insertSetsTx = db.transaction((entries) => {
    for (const [packId, info] of entries) {
      const label = info.title_parts?.label || packId;
      const formattedName = cleanOnePieceSetName(info.raw_title || info.title_parts?.title, label);
      insertSet.run(
        `onepiece-${packId}`,
        'onepiece',
        formattedName,
        label,
        '2022-2026',
        0,
        null,
        null,
        1, // all within 4 years
        'active',
        null
      );
    }
  });

  insertSetsTx(packEntries);

  // Ingest all packs
  const targetPacks = packEntries;

  console.log(`[One Piece Ingestor] Ingesting card data for all ${targetPacks.length} sets...`);
  let totalCardsIngested = 0;

  for (const [packId, info] of targetPacks) {
    try {
      const cardRes = await fetch(`${DATA_BASE_URL}/${packId}.json`);
      if (!cardRes.ok) continue;
      const cards = await cardRes.json();

      const insertCardsTx = db.transaction((cardList) => {
        for (const c of cardList) {
          const isAlt = (c.rarity && (c.rarity.includes('Manga') || c.rarity.includes('SEC') || c.rarity.includes('Secret') || c.rarity.includes('Parallel'))) ? 1 : 0;
          const imageUrl = c.img_full_url || (c.img_url ? `https://en.onepiece-cardgame.com${c.img_url.replace('..', '')}` : '');
          
          insertCard.run(
            `onepiece-${c.id}`,
            'onepiece',
            `onepiece-${packId}`,
            c.id,
            c.name,
            c.rarity || 'Common',
            c.category || 'Character',
            c.colors ? c.colors.join('/') : '',
            c.attributes ? c.attributes.join(', ') : '',
            c.cost ? `Cost ${c.cost}` : '',
            c.power ? `${c.power} Power` : '',
            imageUrl,
            c.effect || '',
            isAlt,
            JSON.stringify(c)
          );
        }
      });

      insertCardsTx(cards);
      updateSetCount.run(cards.length, `onepiece-${packId}`);
      totalCardsIngested += cards.length;
      console.log(`  ✓ ${info.title_parts?.label || packId}: ${cards.length} cards`);
    } catch (err) {
      console.error(`  ✗ Error loading cards for pack ${packId}:`, err.message);
    }
  }

  return { sets: packEntries.length, cards: totalCardsIngested };
}

module.exports = { ingestOnePiece };
