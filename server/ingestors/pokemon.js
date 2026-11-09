const db = require('../db');

const SETS_URL = 'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/sets/en.json';
const CARDS_BASE_URL = 'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en';

async function ingestPokemon(options = { loadAllRecent: true, loadVintage: false }) {
  console.log('[Pokemon Ingestor] Fetching Pokémon sets...');
  const res = await fetch(SETS_URL);
  if (!res.ok) throw new Error(`Failed to fetch sets: ${res.statusText}`);
  const sets = await res.json();

  const insertSet = db.prepare(`
    INSERT OR REPLACE INTO sets (id, game_id, name, code, release_date, total_cards, logo_url, symbol_url, is_recent, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertCard = db.prepare(`
    INSERT OR REPLACE INTO cards (id, game_id, set_id, card_number, name, rarity, card_type, color, attribute, cost_or_level, power, image_url, description, is_alt_art, raw_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let recentSetCount = 0;
  let olderSetCount = 0;

  const insertSetsTx = db.transaction((setList) => {
    for (const s of setList) {
      const isRecent = (s.releaseDate && s.releaseDate >= '2022/01/01') ? 1 : 0;
      const status = 'active'; // Mark all active once ingested!
      const notes = isRecent ? 'Modern (2022-2026)' : 'Vintage (1999-2021)';
      
      insertSet.run(
        `pokemon-${s.id}`,
        'pokemon',
        s.name,
        s.id.toUpperCase(),
        s.releaseDate || '',
        s.total || s.printedTotal || 0,
        s.images?.logo || null,
        s.images?.symbol || null,
        isRecent,
        status,
        notes
      );

      if (isRecent) recentSetCount++;
      else olderSetCount++;
    }
  });

  insertSetsTx(sets);
  console.log(`[Pokemon Ingestor] Synced ${recentSetCount} recent sets and ${olderSetCount} vintage sets.`);

  // Determine target sets based on options
  let targetSets = [];
  if (options.loadAllRecent) {
    targetSets.push(...sets.filter(s => s.releaseDate && s.releaseDate >= '2022/01/01'));
  }
  if (options.loadVintage) {
    targetSets.push(...sets.filter(s => !s.releaseDate || s.releaseDate < '2022/01/01'));
  }

  console.log(`[Pokemon Ingestor] Ingesting card data for ${targetSets.length} sets...`);
  let totalCardsIngested = 0;

  // Process in chunks of 10 concurrent requests to maximize speed
  const CHUNK_SIZE = 10;
  for (let i = 0; i < targetSets.length; i += CHUNK_SIZE) {
    const chunk = targetSets.slice(i, i + CHUNK_SIZE);
    
    await Promise.all(chunk.map(async (s) => {
      try {
        const cardRes = await fetch(`${CARDS_BASE_URL}/${s.id}.json`);
        if (!cardRes.ok) {
          console.warn(`  ⚠️ Could not fetch cards for set ${s.id} (${cardRes.statusText})`);
          return;
        }
        const cards = await cardRes.json();

        const insertCardsTx = db.transaction((cardList) => {
          for (const c of cardList) {
            const isAlt = c.rarity && (
              c.rarity.includes('Special Illustration') || 
              c.rarity.includes('Secret Rare') || 
              c.rarity.includes('Illustration Rare') ||
              c.rarity.includes('Gold Star') ||
              c.rarity.includes('Shining') ||
              c.rarity.includes('Crystal')
            ) ? 1 : 0;

            insertCard.run(
              `pokemon-${c.id}`,
              'pokemon',
              `pokemon-${s.id}`,
              c.number || '',
              c.name,
              c.rarity || 'Common',
              c.supertype || 'Pokémon',
              c.types ? c.types.join(', ') : '',
              c.subtypes ? c.subtypes.join(', ') : '',
              c.hp ? `HP ${c.hp}` : '',
              c.attacks ? c.attacks.map(a => `${a.name} (${a.damage || 0})`).join('; ') : '',
              c.images?.large || c.images?.small || '',
              c.flavorText || (c.rules ? c.rules.join(' ') : ''),
              isAlt,
              JSON.stringify(c)
            );
          }
        });

        insertCardsTx(cards);
        totalCardsIngested += cards.length;
        console.log(`  ✓ ${s.name} (${s.id}): ${cards.length} cards`);
      } catch (err) {
        console.error(`  ✗ Error loading cards for ${s.id}:`, err.message);
      }
    }));
  }

  // Update status for all sets that now have cards in the DB
  db.prepare(`
    UPDATE sets 
    SET status = 'active' 
    WHERE id IN (SELECT DISTINCT set_id FROM cards)
  `).run();

  return { setsRecent: recentSetCount, setsVintage: olderSetCount, cards: totalCardsIngested };
}

async function ingestPokemonVintage() {
  return ingestPokemon({ loadAllRecent: false, loadVintage: true });
}

module.exports = { ingestPokemon, ingestPokemonVintage };
