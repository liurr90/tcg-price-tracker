const db = require('../server/db');

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
    .trim();
}

async function fetchPsaPrices(card) {
  const cardName = cleanCardName(card.name);
  const cardNum = card.card_number || '';
  const numClean = cleanNum(cardNum);
  const isAlt = card.is_alt_art || cardNum.includes('_PR') || cardNum.includes('_p') || (card.name || '').includes('Alt');
  const isSuperAlt = cardNum.includes('_PR2') || cardNum.includes('_p2') || (card.name || '').includes('Super Alt');

  // Build search candidate queries
  const queries = [];
  if (card.game_id === 'pokemon') {
    queries.push(`${cardName} #${numClean}`);
    queries.push(`${cardName} ${card.set_name || ''}`);
    queries.push(`${cardName} ${numClean}`);
  } else if (card.game_id === 'onepiece') {
    const baseNum = cardNum.replace(/_PR\d?$/i, '').replace(/_p\d?$/i, '');
    if (isSuperAlt) {
      queries.push(`${cardName} Manga ${baseNum}`);
      queries.push(`Manga ${baseNum}`);
    }
    queries.push(`${cardName} ${baseNum}`);
    queries.push(`${baseNum}`);
  } else {
    // Fusion World / Gundam
    const baseNum = cardNum.replace(/_PR\d?$/i, '').replace(/_p\d?$/i, '');
    if (isSuperAlt) {
      queries.push(`${cardName} Super Alternate Art ${baseNum}`);
      queries.push(`${cardName} ${baseNum}`);
    } else if (isAlt) {
      queries.push(`${cardName} Alternate Art ${baseNum}`);
      queries.push(`${cardName} ${baseNum}`);
    } else {
      queries.push(`${cardName} ${baseNum}`);
    }
  }

  for (const q of queries) {
    try {
      const searchUrl = 'https://www.pricecharting.com/search-products?type=prices&q=' + encodeURIComponent(q);
      const res = await fetch(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
      });
      if (!res.ok) continue;
      const html = await res.text();

      // Find candidate rows
      const rows = [...html.matchAll(/<tr id="product-(\d+)"[\s\S]*?<td class="title">[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
      if (rows.length === 0) continue;

      let matchedRow = null;

      if (isSuperAlt) {
        matchedRow = rows.find(r => /manga|super alternate/i.test(r[3]));
      } else if (isAlt) {
        matchedRow = rows.find(r => /alternate art|parallel/i.test(r[3]) && !/manga|super/i.test(r[3]));
      }
      
      if (!matchedRow) {
        matchedRow = rows[0];
      }

      if (!matchedRow) continue;

      const productPath = matchedRow[2].startsWith('http') ? matchedRow[2] : 'https://www.pricecharting.com' + matchedRow[2];
      
      // Fetch details
      const prodRes = await fetch(productPath, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
      });
      if (!prodRes.ok) continue;
      const prodHtml = await prodRes.text();

      const parsePrice = (id) => {
        const re = new RegExp('<td id="' + id + '"[\\s\\S]*?<span class="price js-price">\\s*\\$([0-9,.]+)\\s*</span>');
        const m = prodHtml.match(re);
        return m ? parseFloat(m[1].replace(/,/g, '')) : null;
      };

      const raw = parsePrice('used_price');
      const grade9 = parsePrice('graded_price');
      const psa10 = parsePrice('manual_only_price');

      if (psa10 || grade9) {
        return {
          card_id: card.id,
          name: card.name,
          psa10,
          psa9: grade9,
          raw,
          url: productPath,
          matchedTitle: matchedRow[3].replace(/\s+/g, ' ').trim()
        };
      }
    } catch (err) {
      // Continue to next query
    }
  }

  return null;
}

async function run() {
  const testIds = [
    'pokemon-base1-4',        // Charizard #4 Base Set
    'pokemon-swsh7-215',       // Umbreon VMAX Alt Art (Moonbreon)
    'onepiece-OP01-120_p1',    // Shanks Manga Alt-Art
    'fusionworld-FB01-139_PR2',// Son Goku Super Alt-Art
    'gundam-GD01-024_p2'       // Wing Gundam Zero
  ];

  for (const id of testIds) {
    const card = db.prepare('SELECT c.*, s.name as set_name FROM cards c JOIN sets s ON c.set_id = s.id WHERE c.id = ?').get(id);
    if (!card) {
      console.log('Card not found in DB:', id);
      continue;
    }
    const res = await fetchPsaPrices(card);
    console.log('\n--- Card:', card.name, `(${card.card_number}) ---`);
    console.log('Result:', res);
  }
}

run();
