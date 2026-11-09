const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const db = require('../db');

const IMAGES_DIR = path.join(__dirname, '../../data/images');

// Ensure game directories exist
['onepiece', 'gundam', 'fusionworld', 'pokemon'].forEach((g) => {
  const dir = path.join(IMAGES_DIR, g);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

let isDownloading = false;
let shouldStop = false;
let currentProgress = {
  total: 0,
  completed: 0,
  failed: 0,
  currentCard: '',
  currentGame: '',
  status: 'idle', // 'idle', 'running', 'stopped', 'completed'
  bytesDownloaded: 0
};

function getFileExtension(url, contentType) {
  if (contentType?.includes('webp')) return 'webp';
  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return 'jpg';
  const match = url?.match(/\.(png|jpe?g|webp|gif)/i);
  return match ? match[1].toLowerCase() : 'jpg';
}

function getLocalStats() {
  const totalCards = db.prepare('SELECT COUNT(*) as c FROM cards').get().c;
  const offlineCards = db.prepare("SELECT COUNT(*) as c FROM cards WHERE local_image_path IS NOT NULL AND local_image_path != ''").get().c;

  // Calculate disk usage in data/images
  let totalBytes = 0;
  try {
    const walk = (dir) => {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) walk(fullPath);
        else totalBytes += stat.size;
      }
    };
    walk(IMAGES_DIR);
  } catch (e) {
    // ignore
  }

  return {
    totalCards,
    offlineCards,
    totalBytes,
    totalMB: (totalBytes / (1024 * 1024)).toFixed(1),
    coveragePct: totalCards > 0 ? parseFloat(((offlineCards / totalCards) * 100).toFixed(1)) : 0,
    isDownloading,
    ...currentProgress
  };
}

async function downloadSingleCard(card) {
  if (!card.image_url) return false;

  const safeCardId = card.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const targetDir = path.join(IMAGES_DIR, card.game_id);
  
  // Check if any matching file already exists
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
    const existing = path.join(targetDir, `${safeCardId}.${ext}`);
    if (fs.existsSync(existing) && fs.statSync(existing).size > 1000) {
      const localUrl = `/local-images/${card.game_id}/${safeCardId}.${ext}`;
      db.prepare('UPDATE cards SET local_image_path = ? WHERE id = ?').run(localUrl, card.id);
      return true;
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(card.image_url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });

    clearTimeout(timeout);

    if (!res.ok) return false;

    const rawBuffer = Buffer.from(await res.arrayBuffer());
    if (rawBuffer.length < 500) return false; // skip corrupt/empty

    let finalBuffer = rawBuffer;
    let fileName = `${safeCardId}.webp`;

    try {
      // Compress and resize to WebP (max width 420px, quality 70)
      finalBuffer = await sharp(rawBuffer)
        .resize(420, null, { withoutEnlargement: true })
        .webp({ quality: 70, effort: 3 })
        .toBuffer();
    } catch {
      // Fallback to original format if sharp encounters unsupported format
      const ext = getFileExtension(card.image_url, res.headers.get('content-type'));
      fileName = `${safeCardId}.${ext}`;
    }

    const filePath = path.join(targetDir, fileName);
    fs.writeFileSync(filePath, finalBuffer);
    currentProgress.bytesDownloaded += finalBuffer.length;

    const localUrl = `/local-images/${card.game_id}/${fileName}`;
    db.prepare('UPDATE cards SET local_image_path = ? WHERE id = ?').run(localUrl, card.id);
    return true;
  } catch (err) {
    return false;
  }
}

async function startBulkDownload(options = {}) {
  if (isDownloading) return { started: false, message: 'Download already running' };

  isDownloading = true;
  shouldStop = false;
  currentProgress.status = 'running';

  // Query un-downloaded cards in priority order:
  // 1. One Piece
  // 2. Gundam
  // 3. Fusion World
  // 4. Modern Pokémon (recent = 1)
  // 5. Vintage Pokémon
  let query = `
    SELECT c.id, c.game_id, c.image_url, c.name, c.card_number
    FROM cards c
    JOIN sets s ON c.set_id = s.id
    WHERE (c.local_image_path IS NULL OR c.local_image_path = '')
      AND c.image_url IS NOT NULL AND c.image_url != ''
  `;
  const params = [];

  const game = options.game || options.gameId;
  if (game && game !== 'all') {
    query += ' AND c.game_id = ?';
    params.push(game);
  }

  query += `
    ORDER BY 
      CASE 
        WHEN c.game_id = 'onepiece' THEN 1
        WHEN c.game_id = 'gundam' THEN 2
        WHEN c.game_id = 'fusionworld' THEN 3
        WHEN c.game_id = 'pokemon' AND s.is_recent = 1 THEN 4
        ELSE 5
      END ASC,
      s.release_date DESC,
      c.id ASC
  `;

  if (options.limit) {
    query += ` LIMIT ${parseInt(options.limit, 10)}`;
  }

  const queue = db.prepare(query).all(...params);
  currentProgress.total = queue.length;
  currentProgress.completed = 0;
  currentProgress.failed = 0;

  console.log(`[Bulk Image Downloader] Starting download for ${queue.length} cards...`);

  // Run with concurrency pool of 10
  const CONCURRENCY = 10;
  let idx = 0;

  const worker = async () => {
    while (idx < queue.length && !shouldStop) {
      const card = queue[idx++];
      currentProgress.currentCard = `${card.name} (${card.card_number})`;
      currentProgress.currentGame = card.game_id;

      const success = await downloadSingleCard(card);
      if (success) {
        currentProgress.completed++;
      } else {
        currentProgress.failed++;
      }

      if (currentProgress.completed % 50 === 0 && currentProgress.completed > 0) {
        console.log(`[Bulk Image Downloader] Progress: ${currentProgress.completed}/${currentProgress.total} cards saved locally.`);
      }
    }
  };

  const pool = Array.from({ length: CONCURRENCY }, () => worker());

  Promise.all(pool).then(() => {
    isDownloading = false;
    currentProgress.status = shouldStop ? 'stopped' : 'completed';
    console.log(`[Bulk Image Downloader] Finished! Downloaded: ${currentProgress.completed}, Failed: ${currentProgress.failed}`);
  }).catch((err) => {
    isDownloading = false;
    currentProgress.status = 'error';
    console.error('[Bulk Image Downloader] Unexpected pool error:', err);
  });

  return { started: true, totalQueue: queue.length };
}

function stopBulkDownload() {
  if (isDownloading) {
    shouldStop = true;
    return { success: true, message: 'Stopping bulk download...' };
  }
  return { success: false, message: 'No download active' };
}

module.exports = {
  getLocalStats,
  startBulkDownload,
  stopBulkDownload
};
