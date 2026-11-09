const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const db = require('../db');

const IMAGES_DIR = path.join(__dirname, '../../data/images');

let isCompressing = false;
let compressionProgress = {
  total: 0,
  processed: 0,
  bytesBefore: 0,
  bytesAfter: 0,
  savedMB: '0.0',
  savedPct: 0,
  status: 'idle', // 'idle', 'running', 'completed', 'error'
  currentGame: '',
  currentFile: ''
};

function getCompressionStatus() {
  return {
    isCompressing,
    ...compressionProgress
  };
}

/**
 * Optimize and compress all local card images to lightweight WebP format.
 * Target: 420px max width, quality 70.
 * Drastically reduces disk footprint by 80-95% with zero perceptible quality loss on UI.
 */
async function runCompression() {
  if (isCompressing) return { started: false, message: 'Compression already in progress' };

  isCompressing = true;
  compressionProgress.status = 'running';
  compressionProgress.bytesBefore = 0;
  compressionProgress.bytesAfter = 0;
  compressionProgress.processed = 0;

  // Find all image files across all games
  const games = ['pokemon', 'onepiece', 'gundam', 'fusionworld'];
  const queue = [];

  for (const game of games) {
    const dir = path.join(IMAGES_DIR, game);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.startsWith('.')) continue;
      const fullPath = path.join(dir, file);
      const ext = path.extname(file).toLowerCase();
      // Skip if already small webp (< 75KB)
      const stat = fs.statSync(fullPath);
      if (ext === '.webp' && stat.size < 75000) {
        continue;
      }
      queue.push({ game, file, fullPath, size: stat.size });
    }
  }

  compressionProgress.total = queue.length;
  console.log(`[Image Compressor] Found ${queue.length} images to optimize...`);

  if (queue.length === 0) {
    isCompressing = false;
    compressionProgress.status = 'completed';
    return { started: true, total: 0, message: 'All images are already optimized!' };
  }

  const updateCardPath = db.prepare(`
    UPDATE cards 
    SET local_image_path = ? 
    WHERE game_id = ? AND (
      id = ? 
      OR id = ? 
      OR local_image_path = ? 
      OR local_image_path = ?
      OR local_image_path = ?
      OR local_image_path = ?
    )
  `);

  const CONCURRENCY = 8;
  let idx = 0;

  const worker = async () => {
    while (idx < queue.length) {
      const item = queue[idx++];
      compressionProgress.currentFile = item.file;
      compressionProgress.currentGame = item.game;
      compressionProgress.bytesBefore += item.size;

      try {
        const baseName = path.basename(item.file, path.extname(item.file));
        const outFileName = `${baseName}.webp`;
        const outFilePath = path.join(IMAGES_DIR, item.game, outFileName);

        // Convert & resize to 420px max width WebP
        const optimizedBuffer = await sharp(item.fullPath)
          .resize(420, null, { withoutEnlargement: true })
          .webp({ quality: 70, effort: 3 })
          .toBuffer();

        fs.writeFileSync(outFilePath, optimizedBuffer);
        compressionProgress.bytesAfter += optimizedBuffer.length;

        // If the original was not .webp, remove the old bulky file
        if (item.fullPath !== outFilePath && fs.existsSync(item.fullPath)) {
          fs.unlinkSync(item.fullPath);
        }

        // Update database path using exact matches only (never use LIKE %pattern% to avoid cross-clobbering)
        const newLocalUrl = `/local-images/${item.game}/${outFileName}`;
        updateCardPath.run(
          newLocalUrl,
          item.game,
          baseName,
          `${item.game}-${baseName}`,
          `/local-images/${item.game}/${item.file}`,
          `/local-images/${item.game}/${baseName}.png`,
          `/local-images/${item.game}/${baseName}.jpg`,
          `/local-images/${item.game}/${baseName}.jpeg`
        );

        compressionProgress.processed++;

        if (compressionProgress.processed % 200 === 0) {
          const savedBytes = compressionProgress.bytesBefore - compressionProgress.bytesAfter;
          compressionProgress.savedMB = (savedBytes / (1024 * 1024)).toFixed(1);
          compressionProgress.savedPct = parseFloat(((savedBytes / compressionProgress.bytesBefore) * 100).toFixed(1));
          console.log(`[Image Compressor] ${compressionProgress.processed}/${compressionProgress.total} optimized. Saved ${compressionProgress.savedMB} MB (${compressionProgress.savedPct}%).`);
        }
      } catch (err) {
        console.error(`[Image Compressor] Error optimizing ${item.file}:`, err.message);
      }
    }
  };

  const pool = Array.from({ length: CONCURRENCY }, () => worker());

  Promise.all(pool).then(() => {
    isCompressing = false;
    compressionProgress.status = 'completed';
    const savedBytes = compressionProgress.bytesBefore - compressionProgress.bytesAfter;
    compressionProgress.savedMB = (savedBytes / (1024 * 1024)).toFixed(1);
    compressionProgress.savedPct = parseFloat(((savedBytes / compressionProgress.bytesBefore) * 100).toFixed(1));
    console.log(`[Image Compressor] COMPLETED! Optimized ${compressionProgress.processed} images. Saved ${compressionProgress.savedMB} MB!`);
  }).catch((err) => {
    isCompressing = false;
    compressionProgress.status = 'error';
    console.error('[Image Compressor] Pool error:', err);
  });

  return { started: true, total: queue.length };
}

module.exports = {
  runCompression,
  getCompressionStatus
};
