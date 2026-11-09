import React from 'react';
import { Sparkles } from 'lucide-react';

const GAME_THEMES = {
  pokemon: {
    border: 'border-amber-500/50',
    bgActive: 'bg-amber-500/10 text-amber-300 border-amber-500',
    dot: 'bg-amber-400',
    badge: 'bg-amber-950/60 text-amber-300 border-amber-700/50'
  },
  onepiece: {
    border: 'border-rose-500/50',
    bgActive: 'bg-rose-500/10 text-rose-300 border-rose-500',
    dot: 'bg-rose-400',
    badge: 'bg-rose-950/60 text-rose-300 border-rose-700/50'
  },
  fusionworld: {
    border: 'border-orange-500/50',
    bgActive: 'bg-orange-500/10 text-orange-300 border-orange-500',
    dot: 'bg-orange-400',
    badge: 'bg-orange-950/60 text-orange-300 border-orange-700/50'
  },
  gundam: {
    border: 'border-cyan-500/50',
    bgActive: 'bg-cyan-500/10 text-cyan-300 border-cyan-500',
    dot: 'bg-cyan-400',
    badge: 'bg-cyan-950/60 text-cyan-300 border-cyan-700/50'
  },
  riftbound: {
    border: 'border-violet-500/50',
    bgActive: 'bg-violet-500/10 text-violet-300 border-violet-500',
    dot: 'bg-violet-400',
    badge: 'bg-violet-950/60 text-violet-300 border-violet-700/50'
  }
};

export default function GameSelector({ games = [], selectedGame, onSelectGame, stats }) {
  const getGameCardCount = (gameId) => {
    const g = stats?.games?.find(item => item.id === gameId);
    return g ? g.cards_count : 0;
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
      
      {/* "All Games" Tab */}
      <button
        onClick={() => onSelectGame('')}
        className={`px-4 py-2.5 rounded-xl border text-sm font-semibold flex items-center gap-2 whitespace-nowrap transition-all duration-200 ${
          selectedGame === ''
            ? 'bg-slate-800 text-white border-slate-600 shadow-md shadow-slate-900/40'
            : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
        }`}
      >
        <Sparkles className="w-4 h-4 text-cyan-400" />
        <span>All Games</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
          {stats?.totalCards?.toLocaleString() || 0}
        </span>
      </button>

      {/* Specific Games */}
      {games.map((game) => {
        const isSelected = selectedGame === game.id;
        const theme = GAME_THEMES[game.id] || GAME_THEMES.pokemon;
        const count = getGameCardCount(game.id);

        return (
          <button
            key={game.id}
            onClick={() => onSelectGame(game.id)}
            className={`px-4 py-2.5 rounded-xl border text-sm font-semibold flex items-center gap-2.5 whitespace-nowrap transition-all duration-200 ${
              isSelected
                ? `${theme.bgActive} shadow-lg shadow-black/40`
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${theme.dot}`} />
            <span>{game.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${theme.badge}`}>
              {count.toLocaleString()}
            </span>
          </button>
        );
      })}

    </div>
  );
}
