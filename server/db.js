const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'tcg_cards.db');
const db = new Database(dbPath);

// Enable WAL mode for high performance concurrent reads/writes
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      publisher TEXT NOT NULL,
      color_theme TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sets (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      release_date TEXT,
      total_cards INTEGER DEFAULT 0,
      logo_url TEXT,
      symbol_url TEXT,
      is_recent INTEGER DEFAULT 1, -- 1 = last 4 years (2022+), 0 = older
      status TEXT DEFAULT 'active', -- 'active' or 'todo_backlog'
      notes TEXT,
      FOREIGN KEY (game_id) REFERENCES games(id)
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      set_id TEXT NOT NULL,
      card_number TEXT NOT NULL,
      name TEXT NOT NULL,
      rarity TEXT,
      card_type TEXT,
      color TEXT,
      attribute TEXT,
      cost_or_level TEXT,
      power TEXT,
      image_url TEXT,
      description TEXT,
      is_alt_art INTEGER DEFAULT 0,
      raw_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id),
      FOREIGN KEY (set_id) REFERENCES sets(id)
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id TEXT NOT NULL,
      source TEXT NOT NULL, -- 'tcgplayer', 'cardmarket', 'ebay_sold', 'live_fetch'
      market_price REAL,
      low_price REAL,
      high_price REAL,
      graded_psa10 REAL,
      graded_psa9 REAL,
      currency TEXT DEFAULT 'USD',
      source_url TEXT,
      recorded_at DATE NOT NULL,
      FOREIGN KEY (card_id) REFERENCES cards(id)
    );

    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_type TEXT NOT NULL,
      game_id TEXT,
      status TEXT NOT NULL,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_cards_game_set ON cards(game_id, set_id);
    CREATE INDEX IF NOT EXISTS idx_cards_name ON cards(name);
    CREATE INDEX IF NOT EXISTS idx_cards_number ON cards(card_number);
    CREATE INDEX IF NOT EXISTS idx_prices_card_date ON price_history(card_id, recorded_at);
    CREATE INDEX IF NOT EXISTS idx_sets_game ON sets(game_id);
  `);

  // Seed default games
  const insertGame = db.prepare(`
    INSERT OR IGNORE INTO games (id, name, code, publisher, color_theme)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertGame.run('pokemon', 'Pokémon TCG', 'POKEMON', 'The Pokémon Company / Nintendo', 'amber');
  insertGame.run('onepiece', 'One Piece Card Game', 'OPTCG', 'Bandai', 'rose');
  insertGame.run('fusionworld', 'Dragon Ball Super: Fusion World', 'DBSFW', 'Bandai', 'orange');
  insertGame.run('gundam', 'Gundam Card Game', 'GCG', 'Bandai', 'cyan');
}

initSchema();

module.exports = db;
