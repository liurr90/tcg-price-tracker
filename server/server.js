const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const { startScheduler, getSchedulerStatus } = require('./scheduler');
const { handleImageProxy } = require('./proxy');
const { getLocalStats, startBulkDownload, stopBulkDownload } = require('./images/bulkDownloader');
const { runCompression, getCompressionStatus } = require('./images/compressor');
const { formatSourceMeta, computeSourceDiscrepancy } = require('./pricing/multiSource');
const { queryLivePrice } = require('./pricing/liveQuery');
const { updatePrices } = require('./pricing/priceUpdater');
const { ingestPokemon } = require('./ingestors/pokemon');
const { ingestOnePiece } = require('./ingestors/onepiece');
const { ingestFusionWorld } = require('./ingestors/fusionworld');
const { ingestGundam } = require('./ingestors/gundam');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve locally cached offline card images directly from disk
app.use('/local-images', express.static(path.join(__dirname, '../data/images'), {
  maxAge: '365d',
  immutable: true
}));

// Proxy route for Bandai & other CORS/CORP restricted card images
app.get('/api/proxy/image', handleImageProxy);

// Offline Image Storage & Bulk Download API
app.get('/api/images/status', (req, res) => {
  try {
    const stats = getLocalStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/images/download', async (req, res) => {
  try {
    const result = await startBulkDownload(req.body || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/images/stop', (req, res) => {
  try {
    const result = stopBulkDownload();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Image Optimization / Compression API
app.get('/api/images/compress/status', (req, res) => {
  try {
    res.json(getCompressionStatus());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/images/compress', async (req, res) => {
  try {
    const result = await runCompression();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start automated scheduler
startScheduler();

// GET /api/stats
app.get('/api/stats', (req, res) => {
  try {
    const totalCards = db.prepare('SELECT COUNT(*) as count FROM cards').get().count;
    const totalSets = db.prepare('SELECT COUNT(*) as count FROM sets').get().count;
    const activeSets = db.prepare("SELECT COUNT(*) as count FROM sets WHERE status = 'active'").get().count;
    const backlogSets = db.prepare("SELECT COUNT(*) as count FROM sets WHERE status = 'todo_backlog'").get().count;
    const totalPricePoints = db.prepare('SELECT COUNT(*) as count FROM price_history').get().count;
    
    const games = db.prepare(`
      SELECT g.id, g.name, g.code, g.color_theme,
             (SELECT COUNT(*) FROM sets s WHERE s.game_id = g.id AND s.status = 'active') as active_sets,
             (SELECT COUNT(*) FROM sets s WHERE s.game_id = g.id AND s.status = 'todo_backlog') as backlog_sets,
             (SELECT COUNT(*) FROM cards c WHERE c.game_id = g.id) as cards_count
      FROM games g
    `).all();

    const scheduler = getSchedulerStatus();

    res.json({
      totalCards,
      totalSets,
      activeSets,
      backlogSets,
      totalPricePoints,
      games,
      scheduler
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/games
app.get('/api/games', (req, res) => {
  try {
    const games = db.prepare('SELECT * FROM games ORDER BY name').all();
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sets
app.get('/api/sets', (req, res) => {
  try {
    const { game, status } = req.query;
    let query = 'SELECT * FROM sets WHERE 1=1';
    const params = [];

    if (game) {
      query += ' AND game_id = ?';
      params.push(game);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (game === 'onepiece') {
      query += ` ORDER BY 
        CASE 
          WHEN code LIKE 'EB%' OR code LIKE 'OP%' OR code LIKE 'PRB%' THEN 1
          WHEN code LIKE 'ST%' THEN 2
          ELSE 3
        END ASC,
        release_date DESC,
        code DESC,
        name ASC`;
    } else if (game === 'gundam') {
      query += ` ORDER BY 
        CASE 
          WHEN code LIKE 'GD%' OR code LIKE 'EB%' THEN 1
          WHEN code LIKE 'ST%' THEN 2
          ELSE 3
        END ASC,
        release_date DESC,
        code DESC,
        name ASC`;
    } else if (game === 'fusionworld') {
      query += ` ORDER BY 
        CASE 
          WHEN code LIKE 'FB%' THEN 1
          WHEN code LIKE 'FS%' THEN 2
          ELSE 3
        END ASC,
        release_date DESC,
        code DESC,
        name ASC`;
    } else {
      query += ' ORDER BY is_recent DESC, release_date DESC, code DESC, name ASC';
    }

    const sets = db.prepare(query).all(...params);
    res.json(sets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cards
app.get('/api/cards', (req, res) => {
  try {
    const { game, set, sets, search, rarity, sort = 'price_desc', page = 1, limit = 24 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (game) {
      whereClause += ' AND c.game_id = ?';
      params.push(game);
    }
    
    // Support single set or multiple sets (comma-separated or array)
    const setParam = sets || set;
    if (setParam) {
      const setList = (Array.isArray(setParam) ? setParam : setParam.split(','))
        .map(s => s.trim())
        .filter(Boolean);
      
      if (setList.length === 1) {
        whereClause += ' AND c.set_id = ?';
        params.push(setList[0]);
      } else if (setList.length > 1) {
        const placeholders = setList.map(() => '?').join(',');
        whereClause += ` AND c.set_id IN (${placeholders})`;
        params.push(...setList);
      }
    }

    if (rarity) {
      whereClause += ' AND c.rarity LIKE ?';
      params.push(`%${rarity}%`);
    }
    if (search) {
      whereClause += ' AND (c.name LIKE ? OR c.card_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Subquery for latest price and 24h change
    const sql = `
      SELECT c.*, 
             s.name as set_name, s.code as set_code, s.is_recent as set_is_recent,
             g.name as game_name, g.color_theme,
             p.market_price, p.low_price, p.high_price, 
             (SELECT graded_psa10 FROM price_history WHERE card_id = c.id AND graded_psa10 IS NOT NULL ORDER BY recorded_at DESC, id DESC LIMIT 1) as graded_psa10,
             (SELECT graded_psa9 FROM price_history WHERE card_id = c.id AND graded_psa9 IS NOT NULL ORDER BY recorded_at DESC, id DESC LIMIT 1) as graded_psa9,
             (SELECT graded_bgs10 FROM price_history WHERE card_id = c.id AND graded_bgs10 IS NOT NULL ORDER BY recorded_at DESC, id DESC LIMIT 1) as graded_bgs10,
             (SELECT graded_bgs10_black FROM price_history WHERE card_id = c.id AND graded_bgs10_black IS NOT NULL ORDER BY recorded_at DESC, id DESC LIMIT 1) as graded_bgs10_black,
             p.source as price_source, p.recorded_at as price_updated_at,
             prev.market_price as prev_market_price
      FROM cards c
      JOIN sets s ON c.set_id = s.id
      JOIN games g ON c.game_id = g.id
      LEFT JOIN price_history p ON p.id = (
        SELECT id FROM price_history 
        WHERE card_id = c.id 
        ORDER BY recorded_at DESC, id DESC 
        LIMIT 1
      )
      LEFT JOIN price_history prev ON prev.id = (
        SELECT id FROM price_history 
        WHERE card_id = c.id AND recorded_at < p.recorded_at 
        ORDER BY recorded_at DESC, id DESC 
        LIMIT 1
      )
      ${whereClause}
    `;

    let orderBy = 'ORDER BY p.market_price DESC NULLS LAST';
    if (sort === 'price_asc') orderBy = 'ORDER BY p.market_price ASC NULLS LAST';
    else if (sort === 'name_asc') orderBy = 'ORDER BY c.name ASC';
    else if (sort === 'number_asc') orderBy = 'ORDER BY c.card_number ASC';
    else if (sort === 'psa10_desc') orderBy = 'ORDER BY COALESCE(graded_bgs10_black, graded_bgs10, graded_psa10) DESC NULLS LAST';

    const countSql = `
      SELECT COUNT(*) as count 
      FROM cards c 
      JOIN sets s ON c.set_id = s.id 
      ${whereClause}
    `;
    const totalCount = db.prepare(countSql).get(...params).count;

    const dataSql = `${sql} ${orderBy} LIMIT ? OFFSET ?`;
    const cards = db.prepare(dataSql).all(...params, parseInt(limit), offset);

    // Calculate percentage change
    const enhancedCards = cards.map(c => {
      let change24h = null;
      if (c.market_price && c.prev_market_price && c.prev_market_price > 0) {
        change24h = parseFloat((((c.market_price - c.prev_market_price) / c.prev_market_price) * 100).toFixed(1));
      }
      return {
        ...c,
        change24h
      };
    });

    res.json({
      cards: enhancedCards,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cards/:id
app.get('/api/cards/:id', (req, res) => {
  try {
    const card = db.prepare(`
      SELECT c.*, 
             s.name as set_name, s.code as set_code, s.release_date as set_release_date, s.status as set_status,
             g.name as game_name, g.color_theme
      FROM cards c
      JOIN sets s ON c.set_id = s.id
      JOIN games g ON c.game_id = g.id
      WHERE c.id = ?
    `).get(req.params.id);

    if (!card) return res.status(404).json({ error: 'Card not found' });

    const prices = db.prepare(`
      SELECT * FROM price_history 
      WHERE card_id = ? 
      ORDER BY recorded_at ASC, id ASC
    `).all(req.params.id);

    // Fetch latest price record for each distinct source
    const latestSourcesRaw = db.prepare(`
      SELECT p.*
      FROM price_history p
      INNER JOIN (
        SELECT source, MAX(id) as max_id
        FROM price_history
        WHERE card_id = ?
        GROUP BY source
      ) latest ON p.id = latest.max_id
      ORDER BY p.market_price DESC
    `).all(req.params.id);

    const sources = latestSourcesRaw.map(s => ({
      ...s,
      meta: formatSourceMeta(s.source)
    }));

    const discrepancy = computeSourceDiscrepancy(sources);

    const bestPsa10 = prices.slice().reverse().find(p => p.graded_psa10 !== null && p.graded_psa10 !== undefined)?.graded_psa10 ?? null;
    const bestPsa9 = prices.slice().reverse().find(p => p.graded_psa9 !== null && p.graded_psa9 !== undefined)?.graded_psa9 ?? null;
    const bestBgs10 = prices.slice().reverse().find(p => p.graded_bgs10 !== null && p.graded_bgs10 !== undefined)?.graded_bgs10 ?? null;
    const bestBgsBlack = prices.slice().reverse().find(p => p.graded_bgs10_black !== null && p.graded_bgs10_black !== undefined)?.graded_bgs10_black ?? null;

    res.json({
      ...card,
      graded_psa10: bestPsa10,
      graded_psa9: bestPsa9,
      graded_bgs10: bestBgs10,
      graded_bgs10_black: bestBgsBlack,
      price_history: prices,
      latest_price: prices[prices.length - 1] || null,
      sources,
      discrepancy
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cards/:id/live-price (On-demand live query check)
app.post('/api/cards/:id/live-price', async (req, res) => {
  try {
    const result = await queryLivePrice(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sets/:id/sync (On-demand set price sync)
app.post('/api/sets/:id/sync', async (req, res) => {
  try {
    const { syncSetPrices } = require('./pricing/syncSetPrices');
    const result = await syncSetPrices(req.params.id);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sets/stats (Set pricing health and coverage stats)
app.get('/api/sets/stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT 
        s.game_id,
        s.id as set_id,
        s.name as set_name,
        COUNT(c.id) as total_cards,
        COUNT(DISTINCT p.card_id) as priced_cards,
        ROUND(100.0 * COUNT(DISTINCT p.card_id) / COUNT(c.id), 1) as pct_priced
      FROM sets s
      JOIN cards c ON s.id = c.set_id
      LEFT JOIN price_history p ON c.id = p.card_id
      GROUP BY s.id
      ORDER BY s.game_id, pct_priced ASC
    `).all();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sync/prices (Manual trigger for price updates)
app.post('/api/sync/prices', async (req, res) => {
  try {
    const { game } = req.body || {};
    const result = await updatePrices(game);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sync/metadata (Trigger ingestion for games)
app.post('/api/sync/metadata', async (req, res) => {
  try {
    const { game = 'all' } = req.body || {};
    const results = {};

    if (game === 'all' || game === 'pokemon') {
      results.pokemon = await ingestPokemon();
    }
    if (game === 'all' || game === 'onepiece') {
      results.onepiece = await ingestOnePiece();
    }
    if (game === 'all' || game === 'fusionworld') {
      results.fusionworld = await ingestFusionWorld();
    }
    if (game === 'all' || game === 'gundam') {
      results.gundam = await ingestGundam();
    }

    // Refresh pricing for any new cards
    updatePrices();

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sync/status
app.get('/api/sync/status', (req, res) => {
  try {
    const status = getSchedulerStatus();
    const recentLogs = db.prepare('SELECT * FROM sync_logs ORDER BY id DESC LIMIT 10').all();
    res.json({ ...status, recentLogs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[API Server] Running on http://localhost:${PORT}`);
});
