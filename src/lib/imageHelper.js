const API_BASE = 'http://localhost:3001/api';
const LOCAL_STATIC_BASE = 'http://localhost:3001';

/**
 * Returns a browser-safe, offline-ready image URL.
 * 1. If card has local_image_path (e.g. /local-images/onepiece/OP01-001.jpg),
 *    return the direct local server URL for 100% offline access.
 * 2. If Bandai domains enforce Cross-Origin-Resource-Policy: same-site,
 *    proxy them through the local server with disk caching.
 * 3. Return the original URL as fallback.
 */
export function getCardImageUrl(cardOrUrl, localPathFallback = null) {
  if (!cardOrUrl) return null;

  // Handle case where card object is passed: { image_url, local_image_path }
  if (typeof cardOrUrl === 'object') {
    if (cardOrUrl.local_image_path) {
      return `${LOCAL_STATIC_BASE}${cardOrUrl.local_image_path}`;
    }
    return getCardImageUrl(cardOrUrl.image_url);
  }

  const url = cardOrUrl;
  if (localPathFallback) {
    return `${LOCAL_STATIC_BASE}${localPathFallback}`;
  }

  if (url.startsWith('/local-images/')) {
    return `${LOCAL_STATIC_BASE}${url}`;
  }

  if (
    url.includes('en.onepiece-cardgame.com') ||
    url.includes('gundam-gcg.com') ||
    url.includes('dbs-cardgame.com')
  ) {
    return `${API_BASE}/proxy/image?url=${encodeURIComponent(url)}`;
  }

  return url;
}
