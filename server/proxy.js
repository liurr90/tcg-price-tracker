const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const CACHE_DIR = path.join(__dirname, '../data/image_cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function getCacheFilename(url) {
  const hash = crypto.createHash('sha256').update(url).digest('hex');
  const extMatch = url.match(/\.(png|jpe?g|webp|gif)/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
  return path.join(CACHE_DIR, `${hash}.${ext}`);
}

async function handleImageProxy(req, res) {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('Missing url parameter');
  }

  // Set permissive CORS and cross-origin resource policy
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'public, max-age=604800, immutable');

  const cacheFile = getCacheFilename(targetUrl);

  // Serve from local disk cache if exists
  if (fs.existsSync(cacheFile)) {
    const ext = path.extname(cacheFile).toLowerCase();
    const mimeMap = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif'
    };
    res.setHeader('Content-Type', mimeMap[ext] || 'image/jpeg');
    return fs.createReadStream(cacheFile).pipe(res);
  }

  try {
    const fetchRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });

    if (!fetchRes.ok) {
      return res.status(fetchRes.status).send(`Failed to fetch image: HTTP ${fetchRes.status}`);
    }

    const rawBuffer = Buffer.from(await fetchRes.arrayBuffer());
    
    let finalBuffer = rawBuffer;
    let finalType = fetchRes.headers.get('content-type') || 'image/jpeg';

    try {
      finalBuffer = await sharp(rawBuffer)
        .resize(420, null, { withoutEnlargement: true })
        .webp({ quality: 70, effort: 3 })
        .toBuffer();
      finalType = 'image/webp';
    } catch {
      // fallback to original
    }

    res.setHeader('Content-Type', finalType);

    // Save to disk asynchronously
    fs.writeFile(cacheFile, finalBuffer, (err) => {
      if (err) console.error('[Image Proxy] Error saving cache file:', err.message);
    });

    res.send(finalBuffer);
  } catch (err) {
    console.error(`[Image Proxy] Error fetching ${targetUrl}:`, err.message);
    res.status(502).send('Bad Gateway fetching image');
  }
}

module.exports = { handleImageProxy };
