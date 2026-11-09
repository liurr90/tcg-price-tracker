# TCG Price Tracker

A local-first, multi-game trading card game (TCG) price and collection tracking system supporting **Pokémon**, **One Piece**, **Dragon Ball Super: Fusion World**, and **Gundam Card Game**.

---

## 🌟 Key Highlights & Architecture

- **Local-First SQLite Database (`data/tcg_cards.db`):** High-performance SQLite engine with Write-Ahead Logging (WAL) storing cards, set catalogs, and daily price trends offline.
- **4-Year Set Prioritization:** Prioritizes sets released between 2022 and 2026. Older vintage sets (such as Base Set, Neo, and Sun & Moon for Pokémon) are cataloged and flagged as `TODO: Pre-2022 vintage set backlog`.
- **Complete Game Coverage (Modern + Vintage):**
  - **Pokémon TCG:** **176 active sets** (**38 modern sets** from 2022–2026 + **138 vintage sets** from 1999–2021, covering Base Set, Neo, e-Card, EX, DP, BW, XY, Sun & Moon, and Sword & Shield). Total: **20,635 cards**.
  - **One Piece Card Game:** **61 active sets/packs** (all OPTCG sets since OP-01 launch in 2022). Total: **1,464 cards**.
  - **Dragon Ball Super: Fusion World:** **28 active sets** (all FB01–FB09 + Starter Decks). Total: **1,500 cards**.
  - **Gundam Card Game:** **29 active sets** (all GD01–GD07 + Starter Decks). Total: **1,290 cards**.
  - **Total Stored Locally:** **24,889 cards** and **348,447 daily price snapshots** across **294 sets**.
- **Multi-Source Market Discrepancy & Arbitrage Tracking:**
  - Tracks prices across distinct marketplace sources: **TCGPlayer Marketplace** (US), **Cardmarket** (Europe), and **eBay Last Solds** (Auctions/Comps).
  - When drilling into any card, displays an active side-by-side comparison table showing Market Price, Floor/Low, Region, Currency (USD/EUR), and direct links to each marketplace.
  - Computes real-time **Discrepancy / Variance Spreads** (e.g. `Spread: $12.93 (12.0% variance)` between cheapest and highest sources) to identify regional market discrepancies.
- **Scheduled Automated Pricing (Twice Daily):** Embedded `node-cron` daemon configured to update daily snapshots at `06:00` and `18:00`.
- **On-Demand Live Query Fallback:** Allows querying live marketplace data for any card on demand with instant UI cache invalidation and live badges.
- **Interactive Web UI:** Built with React 19, Tailwind CSS v4, Lucide Icons, and Recharts historical price trend charts.

---

## 🚀 Quick Start

### 1. Start Both Backend & Frontend
```bash
cd /Users/rliu/tcg-price-tracker
npm run dev
```
- **Web UI:** [http://localhost:5173](http://localhost:5173)
- **API Server:** [http://localhost:3001](http://localhost:3001)

### 2. Manual CLI Ingestion (Optional)
To re-run card acquisition or populate a fresh database:
```bash
npm run ingest          # Ingests cards for all 4 games
npm run sync:prices     # Computes & records a fresh daily price point
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/stats` | Global card counts, active vs backlog sets, and scheduler health. |
| `GET` | `/api/games` | Metadata for the 4 supported card games. |
| `GET` | `/api/sets?game=...&status=active` | Sets filtered by game and status (`active` or `todo_backlog`). |
| `GET` | `/api/cards?...` | Filter cards by `game`, `set`, `rarity`, `search`, and `sort`. |
| `GET` | `/api/cards/:id` | Card metadata + full 14-day historical price points. |
| `POST` | `/api/cards/:id/live-price` | Trigger an on-demand live market query for a card. |
| `POST` | `/api/sync/prices` | Trigger immediate price snapshot update for all cards. |
| `GET` | `/api/sync/status` | Current cron schedule, daemon status, and recent sync logs. |

---

## 🗄️ Database Schema

- `games`: Canonical game records and color branding.
- `sets`: Set definitions with `is_recent` (1 for 2022+, 0 for vintage) and `status` (`active` vs `todo_backlog`).
- `cards`: Normalized card schema across all publishers (card number, rarity, cost/level, power, attributes, effects, high-res art).
- `price_history`: Time-series pricing records (Market Price, Low/Floor, High/Ceiling, PSA 10, PSA 9, source, timestamp).
- `sync_logs`: Historical audit trail for automated cron and manual live query triggers.
