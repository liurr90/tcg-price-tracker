/**
 * Module for filtering out non-English / foreign marketplace listings
 * (e.g. listings titled or described as JAPANESE, ***JAPANESE***, CHINESE, etc.)
 * from TCGPlayer product listings to determine the true lowest English listing.
 */

const TCGPLAYER_LISTINGS_API = 'https://mp-search-api.tcgplayer.com/v1/product';

const FOREIGN_LANGUAGE_REGEX = /\b(japanese|\*+japanese\*+|~*~japanese~*~|japan|jpn|nihongo|korean|kor|hangul|chinese|traditional\s+chinese|simplified\s+chinese|t-chinese|s-chinese|cht|chs|asian[\s-]english|asia[\s-]english|french|german|spanish|italian|portuguese)\b/i;
const FOREIGN_SHORT_REGEX = /\b(jap|jp)\b/i;
const FOREIGN_PHRASE_REGEX = /non[\s-]english|foreign\s+language|not\s+english|other\s+language|\bforeign\b/i;
const PACK_LOT_UNDER_BOX_REGEX = /\bpack\s*x\d+|\bx\d+\s*packs?\b|loose\s+packs?|lot\s+of\s+\d+\s+packs?|\d+\s*x\s*op\d+|\d+\s*packs?\s+bundle/i;

/**
 * Checks whether a marketplace listing is for a non-English card or an invalid pack lot
 */
function isForeignOrInvalidListing(listing, { isSealed = false } = {}) {
  if (!listing) return false;

  // 1. Explicit language metadata on listing
  if (listing.language && listing.language.toLowerCase() !== 'english') return true;
  if (listing.languageAbbreviation && listing.languageAbbreviation.toLowerCase() !== 'en') return true;

  // 2. Custom title / description inspection
  const title = (listing.customData?.title || '').toLowerCase();
  const desc = (listing.customData?.description || '').toLowerCase();
  const text = `${title} ${desc}`.replace(/<[^>]+>/g, ' ');

  if (FOREIGN_LANGUAGE_REGEX.test(text)) return true;
  if (FOREIGN_SHORT_REGEX.test(text)) return true;
  if (FOREIGN_PHRASE_REGEX.test(text)) return true;

  // 3. For sealed box products, disregard loose pack lots listed under box
  if (isSealed) {
    if (PACK_LOT_UNDER_BOX_REGEX.test(text)) return true;
  }

  return false;
}

/**
 * Fetches active marketplace listings for a product from TCGPlayer
 * and finds the lowest listing that DOES NOT have a foreign language note.
 */
async function fetchVerifiedLowestListing(productId, { isSealed = false, size = 30 } = {}) {
  if (!productId) return null;

  try {
    const url = `${TCGPLAYER_LISTINGS_API}/${productId}/listings`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        filters: { term: { sellerStatus: 'Live', channelId: 0 } },
        from: 0,
        size: size,
        sort: { field: 'price+shipping', order: 'asc' },
        context: { shippingCountry: 'US', cart: {} }
      })
    });

    if (!res.ok) return null;

    const data = await res.json();
    const listings = data.results?.[0]?.results || [];
    if (listings.length === 0) return null;

    let foreignCount = 0;
    const cleanListings = [];

    for (const l of listings) {
      if (isForeignOrInvalidListing(l, { isSealed })) {
        foreignCount++;
      } else {
        cleanListings.push(l);
      }
    }

    if (cleanListings.length > 0) {
      const top = cleanListings[0];
      const verifiedLow = parseFloat(((top.price || 0) + (top.shippingPrice || 0)).toFixed(2));
      return {
        lowestPrice: verifiedLow,
        listing: top,
        foreignCount,
        totalChecked: listings.length,
        hasDisregardedForeign: foreignCount > 0
      };
    }

    return null;
  } catch (err) {
    console.warn(`[ListingFilter] Error fetching listings for ${productId}:`, err.message);
    return null;
  }
}

module.exports = {
  isForeignOrInvalidListing,
  fetchVerifiedLowestListing
};
