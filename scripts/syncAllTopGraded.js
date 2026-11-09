const db = require('../server/db');
const { fetchPsaPrices } = require('../server/pricing/gradedPricing');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function norm(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function fetchCategorySlugs(category) {
  try {
    const res = await fetch(`https://www.pricecharting.com/category/${category}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    });
    if (!res.ok) return [];
    const html = await res.text();
    const links = [...html.matchAll(/href="\/console\/([^"]+)"/g)];
    const unique = [...new Set(links.map(l => l[1]))];
    return unique.filter(s => !['nes', 'snes', 'n64', 'gamecube', 'wii', 'switch', 'gameboy', 'playstation', 'famicom', 'xbox'].some(x => s.includes(x)));
  } catch {
    return [];
  }
}

function matchSlug(setName, setCode, slugs) {
  if (!slugs || slugs.length === 0) return null;
  const codeNorm = norm(setCode);
  const nameNorm = norm(setName);

  // 1. Direct code match (e.g. ST-01 -> starter-deck-1, OP-01 -> op01 or romance-dawn)
  for (const slug of slugs) {
    if (slug.includes(codeNorm)) return slug;
    const stMatch = codeNorm.match(/^st0?(\d+)$/);
    if (stMatch && (slug.includes(`starter-deck-${stMatch[1]}`) || slug.includes(`starter-deck-0${stMatch[1]}`))) {
      return slug;
    }
    const fbMatch = codeNorm.match(/^fb0?(\d+)$/);
    if (fbMatch && slug.includes(`booster-0${fbMatch[1]}`)) {
      return slug;
    }
  }

  // 2. Word overlap match
  const words = setName
    .replace(/\[[^\]]+\]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(w => w.length > 2 && !['the', 'and', 'card', 'game', 'edition', 'deck', 'vol', 'pack'].includes(w));

  let bestSlug = null;
  let bestScore = 0;

  for (const slug of slugs) {
    const sNorm = norm(slug);
    let score = 0;
    for (const w of words) {
      if (sNorm.includes(w)) score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestSlug = slug;
    }
  }

  return bestScore >= 2 ? bestSlug : null;
}

async function fetchSetConsoleRows(slug) {
  try {
    const url = `https://www.pricecharting.com/console/${slug}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    if (!res.ok) return null;
    const html = await res.text();
    const rows = [...html.matchAll(/<tr id="product-(\d+)"[^>]*>([\s\S]*?)<\/tr>/g)];
    if (rows.length === 0) return null;

    return rows.map(r => {
      const titleMatch = r[0].match(/<td class="title"[^>]*>[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      const newPriceMatch = r[0].match(/<td class="price numeric new_price"[^>]*>[\s\S]*?<span class="js-price">\s*\$([0-9,.]+)\s*<\/span>/);
      const cibPriceMatch = r[0].match(/<td class="price numeric cib_price"[^>]*>[\s\S]*?<span class="js-price">\s*\$([0-9,.]+)\s*<\/span>/);
      const usedPriceMatch = r[0].match(/<td class="price numeric used_price"[^>]*>[\s\S]*?<span class="js-price">\s*\$([0-9,.]+)\s*<\/span>/);

      return {
        title: titleMatch ? titleMatch[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '',
        url: titleMatch ? (titleMatch[1].startsWith('http') ? titleMatch[1] : `https://www.pricecharting.com${titleMatch[1]}`) : '',
        psa10: newPriceMatch ? parseFloat(newPriceMatch[1].replace(/,/g, '')) : null,
        grade9: cibPriceMatch ? parseFloat(cibPriceMatch[1].replace(/,/g, '')) : null,
        raw: usedPriceMatch ? parseFloat(usedPriceMatch[1].replace(/,/g, '')) : null
      };
    }).filter(it => it.title && (it.psa10 || it.grade9));
  } catch {
    return null;
  }
}

async function fetchCardBgsDetails(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    });
    if (!res.ok) return {};
    const html = await res.text();
    const parseNamed = name => {
      const m = html.match(new RegExp('<tr>\\s*<td>' + name + '<\\/td>\\s*<td class="price js-price">\\s*\\$([0-9,.]+)\\s*<\\/td>', 'i'));
      return m ? parseFloat(m[1].replace(/,/g, '')) : null;
    };
    return {
      bgs10: parseNamed('BGS 10'),
      bgs10Black: parseNamed('BGS 10 Black')
    };
  } catch {
    return {};
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    game: null,
    limitPerSet: 48, // 2 pages = 48 cards per set
    delay: 350
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--game' && args[i + 1]) {
      options.game = args[++i];
    } else if (args[i] === '--limit' && args[i + 1]) {
      options.limitPerSet = parseInt(args[++i], 10);
    } else if (args[i] === '--delay' && args[i + 1]) {
      options.delay = parseInt(args[++i], 10);
    }
  }

  return options;
}

async function main() {
  const opts = parseArgs();
  console.log(`[Batch Graded Sync] Initializing with options:`, opts);

  // Load category slugs from PriceCharting
  console.log(`[Batch Graded Sync] Discovering category set slugs from PriceCharting...`);
  const [opSlugs, pokemonSlugs] = await Promise.all([
    fetchCategorySlugs('one-piece-cards'),
    fetchCategorySlugs('pokemon-cards')
  ]);

  const dbFusionSlugs = [
    'dragon-ball-fusion-world-ultra-limit',
    'dragon-ball-fusion-world-raging-roar',
    'dragon-ball-fusion-world-manga-booster-01',
    'dragon-ball-fusion-world-awakened-pulse',
    'dragon-ball-fusion-world-blazing-aura',
    'dragon-ball-fusion-world-manga-booster-02',
    'dragon-ball-fusion-world-promos',
    'dragon-ball-fusion-world-new-adventure',
    'dragon-ball-fusion-world-dual-evolution',
    'dragon-ball-fusion-world-saiyan%27s-pride',
    'dragon-ball-fusion-world-judge-promo',
    'dragon-ball-fusion-world-starter-deck-shallot'
  ];

  const gundamSlugs = [
    'gundam-newtype-rising',
    'gundam-dual-impact',
    'gundam-steel-requiem',
    'gundam-edition-beta',
    'gundam-phantom-aria',
    'gundam-freedom-ascension',
    'gundam-starter-deck-01-heroic-beginnings',
    'gundam-promo'
  ];

  console.log(`Found: One Piece (${opSlugs.length} slugs), Pokémon (${pokemonSlugs.length} slugs), Fusion World (${dbFusionSlugs.length} slugs), Gundam (${gundamSlugs.length} slugs).`);

  const categoryMap = {
    onepiece: opSlugs,
    pokemon: pokemonSlugs,
    fusionworld: dbFusionSlugs,
    gundam: gundamSlugs
  };

  let setQuery = 'SELECT * FROM sets WHERE 1=1';
  const setParams = [];
  if (opts.game) {
    setQuery += ' AND game_id = ?';
    setParams.push(opts.game);
  }
  setQuery += ' ORDER BY is_recent DESC, release_date DESC, id ASC';

  const sets = db.prepare(setQuery).all(...setParams);
  console.log(`[Batch Graded Sync] Processing ${sets.length} sets...`);

  let totalCardsUpdated = 0;
  let totalSetsSynced = 0;

  const updateStmt = db.prepare(`
    UPDATE price_history 
    SET graded_psa10 = COALESCE(?, graded_psa10),
        graded_psa9 = COALESCE(?, graded_psa9),
        graded_bgs10 = COALESCE(?, graded_bgs10),
        graded_bgs10_black = COALESCE(?, graded_bgs10_black)
    WHERE id = (
      SELECT id FROM price_history WHERE card_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 1
    )
  `);

  const insertStmt = db.prepare(`
    INSERT INTO price_history (card_id, source, market_price, low_price, high_price, graded_psa10, graded_psa9, graded_bgs10, graded_bgs10_black, currency, recorded_at, source_url)
    VALUES (?, 'pricecharting', ?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?)
  `);

  const todayStr = new Date().toISOString().split('T')[0];

  for (let sIdx = 0; sIdx < sets.length; sIdx++) {
    const set = sets[sIdx];
    const setProgress = `[Set ${sIdx + 1}/${sets.length}] ${set.game_id} | ${set.name}`;

    // Get cards in set (up to 48 cards = 2 full pages)
    const dbCards = db.prepare(`
      SELECT c.*, p.market_price, p.graded_psa10, p.graded_bgs10
      FROM cards c
      LEFT JOIN price_history p ON p.id = (
        SELECT id FROM price_history WHERE card_id = c.id ORDER BY recorded_at DESC, id DESC LIMIT 1
      )
      WHERE c.set_id = ?
      ORDER BY p.market_price DESC NULLS LAST
      LIMIT ?
    `).all(set.id, opts.limitPerSet);

    if (dbCards.length === 0) continue;

    const gameSlugs = categoryMap[set.game_id] || [];
    let matchedSlug = matchSlug(set.name, set.code, gameSlugs);

    // Fallback manual slug attempt
    if (!matchedSlug) {
      const clean = set.name.replace(/\[[^\]]+\]/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const prefix = set.game_id === 'pokemon' ? 'pokemon-' : set.game_id === 'onepiece' ? 'one-piece-' : set.game_id === 'fusionworld' ? 'dragon-ball-fusion-world-' : 'gundam-';
      matchedSlug = prefix + clean;
    }

    let consoleRows = null;
    if (matchedSlug) {
      consoleRows = await fetchSetConsoleRows(matchedSlug);
    }

    let setUpdated = 0;

    if (consoleRows && consoleRows.length > 0) {
      totalSetsSynced++;

      for (const row of consoleRows) {
        if (!row.psa10 && !row.grade9) continue;

        const numM = row.title.match(/(?:#|\[)?([A-Z0-9]+-[0-9]+|[0-9]{1,4}|[A-Z]{1,3}[0-9]{1,3})\b/i);
        const cardNumClean = numM ? numM[1].toUpperCase() : '';
        if (!cardNumClean) continue;

        const isManga = /manga/i.test(row.title);
        const isAlt = /alternate|parallel/i.test(row.title);

        let matchedCard = null;
        if (isManga) {
          matchedCard = dbCards.find(c => (c.card_number || '').toUpperCase().includes(cardNumClean) && 
            (((c.image_url || '').toLowerCase().includes('_r2') || (c.image_url || '').toLowerCase().includes('_p2')) ||
             (c.card_number || '').includes('_p2') || (c.name || '').includes('Manga') || (c.name || '').includes('Super Alt')));
        } else if (isAlt) {
          matchedCard = dbCards.find(c => (c.card_number || '').toUpperCase().includes(cardNumClean) && 
            (((c.image_url || '').toLowerCase().includes('_r1') || (c.image_url || '').toLowerCase().includes('_p1')) ||
             (c.card_number || '').includes('_p1') || c.is_alt_art === 1));
        }

        if (!matchedCard) {
          matchedCard = dbCards.find(c => (c.card_number || '').toUpperCase() === cardNumClean);
        }

        if (!matchedCard) {
          matchedCard = dbCards.find(c => (c.card_number || '').toUpperCase().startsWith(cardNumClean));
        }

        if (matchedCard) {
          let bgs10 = null;
          let bgs10Black = null;

          // For One Piece or top high-value cards (PSA 10 >= $100), fetch exact BGS 10 details for top cards
          if ((set.game_id === 'onepiece' || (row.psa10 && row.psa10 >= 100)) && setUpdated < 5 && row.url) {
            const bgsData = await fetchCardBgsDetails(row.url);
            bgs10 = bgsData.bgs10 || null;
            bgs10Black = bgsData.bgs10Black || null;
            await sleep(80);
          } else if (set.game_id === 'onepiece' && row.psa10) {
            bgs10 = parseFloat((row.psa10 * 1.05).toFixed(2));
          }

          const existingPrice = db.prepare(`SELECT id FROM price_history WHERE card_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 1`).get(matchedCard.id);

          if (existingPrice) {
            updateStmt.run(row.psa10, row.grade9, bgs10, bgs10Black, matchedCard.id);
          } else {
            insertStmt.run(
              matchedCard.id,
              row.raw || null,
              row.raw ? parseFloat((row.raw * 0.85).toFixed(2)) : null,
              row.raw ? parseFloat((row.raw * 1.25).toFixed(2)) : null,
              row.psa10,
              row.grade9,
              bgs10,
              bgs10Black,
              todayStr,
              row.url
            );
          }

          setUpdated++;
          totalCardsUpdated++;
        }
      }

      console.log(`${setProgress} -> Synced ${setUpdated} cards via console slug: ${matchedSlug}`);
    } else {
      // Fallback: sync top 3 cards in set via direct search
      let fallbackUpdated = 0;
      for (const card of dbCards.slice(0, 3)) {
        if (!card.graded_psa10) {
          try {
            const pRes = await fetchPsaPrices(card);
            if (pRes && (pRes.psa10 || pRes.psa9 || pRes.bgs10)) {
              updateStmt.run(pRes.psa10, pRes.psa9, pRes.bgs10, pRes.bgs10_black, card.id);
              fallbackUpdated++;
              totalCardsUpdated++;
            }
          } catch {}
          await sleep(100);
        }
      }
      if (fallbackUpdated > 0) {
        console.log(`${setProgress} -> Synced ${fallbackUpdated} cards via search fallback.`);
      }
    }

    await sleep(opts.delay);
  }

  console.log(`\n========================================`);
  console.log(`[Batch Graded Sync Complete]`);
  console.log(`Sets Processed: ${sets.length}`);
  console.log(`Sets Synced via Direct Slugs: ${totalSetsSynced}`);
  console.log(`Total Cards Updated with Graded Data: ${totalCardsUpdated}`);
  console.log(`========================================\n`);
}

main().catch(err => {
  console.error('[Fatal Sync Error]', err);
  process.exit(1);
});
