const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const db = require('../server/db');
const { syncSetPrices, fetchTcgSetItems } = require('../server/pricing/syncSetPrices');
const { getTcgSetName } = require('../server/pricing/setMapping');

const IMAGES_DIR = path.join(__dirname, '../data/images');

async function downloadAndCompress(url, outPath) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    clearTimeout(timeout);
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500) return false;
    const opt = await sharp(buf)
      .resize(420, null, { withoutEnlargement: true })
      .webp({ quality: 70, effort: 3 })
      .toBuffer();
    fs.writeFileSync(outPath, opt);
    return true;
  } catch {
    return false;
  }
}

async function fixFusionWorldImages() {
  console.log('\n=== STEP 1: DOWNLOADING & OPTIMIZING MISSING FUSION WORLD IMAGES ===');
  const cards = db.prepare(`
    SELECT id, card_number, name, rarity, is_alt_art, image_url, local_image_path 
    FROM cards 
    WHERE game_id = 'fusionworld' 
      AND (local_image_path IS NULL OR local_image_path = '')
  `).all();

  console.log(`Found ${cards.length} Fusion World cards without local images.`);
  const outDir = path.join(IMAGES_DIR, 'fusionworld');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const updateCard = db.prepare('UPDATE cards SET local_image_path = ?, image_url = ? WHERE id = ?');
  let downloaded = 0;
  let idx = 0;
  const CONCURRENCY = 12;

  const worker = async () => {
    while (idx < cards.length) {
      const i = idx++;
      const c = cards[i];
      const outPath = path.join(outDir, `${c.id}.webp`);
      
      // Check if file already exists on disk
      if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
        updateCard.run(`/local-images/fusionworld/${c.id}.webp`, c.image_url, c.id);
        downloaded++;
        continue;
      }

      const cardNum = c.card_number;
      const baseNum = cardNum.replace(/_PR\d?$/i, '').replace(/_p\d?$/i, '');
      
      // Generate candidate URLs
      const candidateUrls = [];
      if (cardNum.endsWith('_PR2') || cardNum.endsWith('_p2')) {
        candidateUrls.push(`https://www.dbs-cardgame.com/fw/images/cards/card/en/${baseNum}_p2.webp`);
      } else if (cardNum.endsWith('_PR') || cardNum.endsWith('_p1') || cardNum.endsWith('_p')) {
        candidateUrls.push(`https://www.dbs-cardgame.com/fw/images/cards/card/en/${baseNum}_p1.webp`);
      }
      if (c.rarity === 'L' || (c.card_type && c.card_type.toUpperCase().includes('LEADER'))) {
        candidateUrls.push(`https://www.dbs-cardgame.com/fw/images/cards/card/en/${cardNum}_f.webp`);
        candidateUrls.push(`https://www.dbs-cardgame.com/fw/images/cards/card/en/${baseNum}_f.webp`);
      }
      candidateUrls.push(`https://www.dbs-cardgame.com/fw/images/cards/card/en/${cardNum}.webp`);
      candidateUrls.push(`https://www.dbs-cardgame.com/fw/images/cards/card/en/${baseNum}.webp`);

      let ok = false;
      for (const url of candidateUrls) {
        ok = await downloadAndCompress(url, outPath);
        if (ok) {
          updateCard.run(`/local-images/fusionworld/${c.id}.webp`, url, c.id);
          downloaded++;
          break;
        }
      }

      if (downloaded % 100 === 0) {
        console.log(`[Fusion World Images] Progress: ${idx}/${cards.length} (Saved: ${downloaded})`);
      }
    }
  };

  const pool = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(pool);

  console.log(`[Fusion World Images] Done! Total local images restored: ${downloaded}`);
}

async function passThroughSets() {
  console.log('\n=== STEP 2: AUDITING & SYNCING PRICES FOR ALL SETS ===');
  const sets = db.prepare(`
    SELECT s.id, s.game_id, s.name, s.code, count(c.id) as total_cards 
    FROM sets s 
    JOIN cards c ON s.id = c.set_id 
    GROUP BY s.id
  `).all();

  const setsToSync = [];

  for (const s of sets) {
    const priced = db.prepare('SELECT count(DISTINCT card_id) as c FROM price_history p JOIN cards c ON p.card_id = c.id WHERE c.set_id = ?').get(s.id).c;
    const topPrice = db.prepare('SELECT MAX(market_price) as m FROM price_history p JOIN cards c ON p.card_id = c.id WHERE c.set_id = ?').get(s.id).m;
    const tcgName = getTcgSetName(s.game_id, s.id, s.name);

    // Criteria for sync:
    // 1. Fusion World sets FB01-FB10, ST01, SB01, SB02, FS01-FS12
    // 2. Any set with 0 priced cards
    // 3. Any set where priced cards < 30% of total
    // 4. Any set with mapped name changed
    const isFusionWorldMain = s.game_id === 'fusionworld' && (s.id.includes('FB') || s.id.includes('ST') || s.id.includes('SB') || s.id.includes('FS'));
    const isLowCoverage = priced === 0 || (s.total_cards > 10 && priced < s.total_cards * 0.35);
    const isTargetSet = isFusionWorldMain || isLowCoverage || s.id === 'onepiece-569301' || s.id === 'onepiece-569302' || s.id.includes('ecard') || s.id.includes('tg') || s.id.includes('sv');

    if (isTargetSet) {
      setsToSync.push({
        ...s,
        pricedBefore: priced,
        topPriceBefore: topPrice || 0,
        tcgName
      });
    }
  }

  console.log(`Identified ${setsToSync.length} sets requiring price completeness sync.`);

  for (let i = 0; i < setsToSync.length; i++) {
    const target = setsToSync[i];
    console.log(`\n[${i + 1}/${setsToSync.length}] Syncing ${target.id} (${target.name}) -> TCG: "${target.tcgName}"...`);
    try {
      const res = await syncSetPrices(target.id);
      const topPriceAfter = db.prepare('SELECT MAX(market_price) as m FROM price_history p JOIN cards c ON p.card_id = c.id WHERE c.set_id = ?').get(target.id).m;
      console.log(`  -> Matched: ${res.matched}/${res.total} cards (${res.coveragePct}%) | Top Hit: $${topPriceAfter || 0}`);
    } catch (err) {
      console.error(`  -> Failed:`, err.message);
    }
  }

  console.log('\n=== STEP 3: FINAL VERIFICATION ===');
  const finalSummary = db.prepare(`
    SELECT 
      s.game_id,
      COUNT(DISTINCT s.id) as total_sets,
      COUNT(c.id) as total_cards,
      COUNT(DISTINCT p.card_id) as priced_cards,
      COUNT(CASE WHEN c.local_image_path IS NOT NULL AND c.local_image_path != '' THEN 1 END) as cards_with_local_img,
      ROUND(MAX(p.market_price), 2) as overall_top_card_price
    FROM sets s
    LEFT JOIN cards c ON s.id = c.set_id
    LEFT JOIN price_history p ON c.id = p.card_id
    GROUP BY s.game_id
  `).all();

  console.table(finalSummary);
}

async function main() {
  await fixFusionWorldImages();
  await passThroughSets();
  console.log('\nAll steps completed successfully!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
