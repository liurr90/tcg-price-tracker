const fs = require('fs');

async function getPriceChartingDetails(productUrl) {
  const res = await fetch(productUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
  });
  if (!res.ok) return null;
  const html = await res.text();

  const parsePrice = (id) => {
    const re = new RegExp('<td id="' + id + '"[\\s\\S]*?<span class="price js-price">\\s*\\$([0-9,.]+)\\s*</span>');
    const m = html.match(re);
    return m ? parseFloat(m[1].replace(/,/g, '')) : null;
  };

  return {
    ungraded: parsePrice('used_price'),
    grade7: parsePrice('complete_price'),
    grade8: parsePrice('new_price'),
    grade9: parsePrice('graded_price'),
    grade95: parsePrice('box_only_price'),
    psa10: parsePrice('manual_only_price')
  };
}

async function testCard(q) {
  const searchUrl = 'https://www.pricecharting.com/search-products?type=prices&q=' + encodeURIComponent(q);
  const res = await fetch(searchUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
  });
  const html = await res.text();

  const firstMatch = html.match(/<tr id="product-(\d+)"[\s\S]*?<td class="title">[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
  if (!firstMatch) {
    console.log('No match for:', q);
    return;
  }

  const link = firstMatch[2].startsWith('http') ? firstMatch[2] : 'https://www.pricecharting.com' + firstMatch[2];
  const name = firstMatch[3].replace(/\s+/g, ' ').trim();
  const prices = await getPriceChartingDetails(link);
  console.log(q, '->', name);
  console.log('  Link:', link);
  console.log('  Prices:', prices);
}

async function main() {
  await testCard('Charizard 4 Base Set');
  await testCard('Giratina V 186');
  await testCard('Luffy OP05-119');
  await testCard('Son Goku FB01-139');
}
main();
