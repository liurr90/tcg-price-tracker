import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import GameSelector from './components/GameSelector';
import FilterBar from './components/FilterBar';
import CardGrid from './components/CardGrid';
import CardModal from './components/CardModal';
import BacklogModal from './components/BacklogModal';
import SyncModal from './components/SyncModal';
import { fetchStats, fetchGames, fetchSets, fetchCards, triggerLiveQuery, triggerPriceSync } from './lib/api';

export default function App() {
  const [stats, setStats] = useState(null);
  const [games, setGames] = useState([]);
  const [sets, setSets] = useState([]);
  const [cards, setCards] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 24, totalCount: 0, totalPages: 1 });
  
  // Filter States
  const [selectedGame, setSelectedGame] = useState('');
  const [selectedSets, setSelectedSets] = useState([]); // Multiple sets support
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRarity, setSelectedRarity] = useState('');
  const [selectedSort, setSelectedSort] = useState('price_desc');
  const [gradedOnly, setGradedOnly] = useState(false);
  const [page, setPage] = useState(1);

  // UI States
  const [isLoadingCards, setIsLoadingCards] = useState(true);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [isBacklogOpen, setIsBacklogOpen] = useState(false);
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [isSyncingPrices, setIsSyncingPrices] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Initial Load: stats & games
  const loadInitialData = async () => {
    try {
      const [sData, gData] = await Promise.all([fetchStats(), fetchGames()]);
      setStats(sData);
      setGames(gData);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // 2. Load sets when game changes
  useEffect(() => {
    async function loadSets() {
      try {
        const sList = await fetchSets(selectedGame, 'active');
        setSets(sList);
        setSelectedSets([]); // reset sets filter when game changes
        setPage(1);
      } catch (err) {
        console.error('Failed to load sets:', err);
      }
    }
    loadSets();
  }, [selectedGame]);

  // 3. Load cards when filters or page changes
  const loadCards = useCallback(async () => {
    setIsLoadingCards(true);
    try {
      const data = await fetchCards({
        game: selectedGame,
        sets: selectedSets,
        search: searchQuery,
        rarity: selectedRarity,
        sort: selectedSort,
        graded_only: gradedOnly,
        page,
        limit: 24
      });
      setCards(data.cards);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to load cards:', err);
    } finally {
      setIsLoadingCards(false);
    }
  }, [selectedGame, selectedSets, searchQuery, selectedRarity, selectedSort, gradedOnly, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCards();
    }, 200); // 200ms debounce
    return () => clearTimeout(timer);
  }, [loadCards]);

  // Set toggle handlers
  const handleToggleSet = (setId) => {
    setSelectedSets(prev => 
      prev.includes(setId) ? prev.filter(id => id !== setId) : [...prev, setId]
    );
    setPage(1);
  };

  const handleSelectAllSets = (setIds) => {
    setSelectedSets(setIds);
    setPage(1);
  };

  const handleClearSets = () => {
    setSelectedSets([]);
    setPage(1);
  };

  // Live query from card card
  const handleLiveCheck = async (cardId) => {
    try {
      const res = await triggerLiveQuery(cardId);
      showToast(`Updated live market price for ${res.name}: $${res.market_price}`);
      // Refresh current cards
      loadCards();
      const s = await fetchStats();
      setStats(s);
    } catch (err) {
      showToast(`Live query error: ${err.message}`);
    }
  };

  // Sync prices trigger from Navbar
  const handleSyncPrices = async () => {
    setIsSyncingPrices(true);
    try {
      const res = await triggerPriceSync(selectedGame || null);
      showToast(`Daily price sync completed (${res.result.updated || res.result.initialized} updated)`);
      loadCards();
      const s = await fetchStats();
      setStats(s);
    } catch (err) {
      showToast(`Sync error: ${err.message}`);
    } finally {
      setIsSyncingPrices(false);
    }
  };

  const handleClearFilters = () => {
    setSelectedSets([]);
    setSearchQuery('');
    setSelectedRarity('');
    setSelectedSort('price_desc');
    setGradedOnly(false);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-cyan-500/80 text-cyan-200 px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          {toastMessage}
        </div>
      )}

      {/* Navigation */}
      <Navbar
        stats={stats}
        onOpenSync={() => setIsSyncOpen(true)}
        onOpenBacklog={() => setIsBacklogOpen(true)}
        onSyncPrices={handleSyncPrices}
        isSyncingPrices={isSyncingPrices}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 w-full">
        
        {/* Game Selector Tabs */}
        <section>
          <GameSelector
            games={games}
            selectedGame={selectedGame}
            onSelectGame={(gId) => {
              setSelectedGame(gId);
              setPage(1);
            }}
            stats={stats}
          />
        </section>

        {/* Filter Controls */}
        <section>
          <FilterBar
            sets={sets}
            selectedSets={selectedSets}
            onToggleSet={handleToggleSet}
            onSelectAllSets={handleSelectAllSets}
            onClearSets={handleClearSets}
            searchQuery={searchQuery}
            onSearchChange={(q) => {
              setSearchQuery(q);
              setPage(1);
            }}
            selectedRarity={selectedRarity}
            onSelectRarity={(r) => {
              setSelectedRarity(r);
              setPage(1);
            }}
            selectedSort={selectedSort}
            onSelectSort={(sort) => {
              setSelectedSort(sort);
              setPage(1);
            }}
            gradedOnly={gradedOnly}
            onToggleGradedOnly={() => {
              setGradedOnly(prev => !prev);
              setPage(1);
            }}
            onClearFilters={handleClearFilters}
            totalResults={pagination.totalCount}
          />
        </section>

        {/* Card Gallery Grid */}
        <section>
          <CardGrid
            cards={cards}
            pagination={pagination}
            onPageChange={(p) => setPage(p)}
            onSelectCard={(c) => setSelectedCardId(c.id)}
            onLiveCheck={handleLiveCheck}
            isLoading={isLoadingCards}
          />
        </section>

      </main>

      {/* Modals */}
      {selectedCardId && (
        <CardModal
          cardId={selectedCardId}
          onClose={() => setSelectedCardId(null)}
          onPriceUpdated={() => {
            loadCards();
            fetchStats().then(setStats);
          }}
        />
      )}

      <BacklogModal
        isOpen={isBacklogOpen}
        onClose={() => setIsBacklogOpen(false)}
      />

      <SyncModal
        isOpen={isSyncOpen}
        onClose={() => setIsSyncOpen(false)}
        onPriceSyncTriggered={() => {
          loadCards();
          fetchStats().then(setStats);
        }}
      />
    </div>
  );
}
