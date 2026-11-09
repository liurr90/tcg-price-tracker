import React from 'react';
import { Layers, RefreshCw, Clock, Database, Archive, Sparkles } from 'lucide-react';

export default function Navbar({ stats, onOpenSync, onOpenBacklog, onSyncPrices, isSyncingPrices }) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-rose-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                TCG Price Tracker
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-medium">
                Local-First
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Pokémon • One Piece • DBS Fusion World • Gundam
            </p>
          </div>
        </div>

        {/* Global Quick Actions & Stat Chips */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Vintage Sets Catalog Button */}
          <button
            onClick={onOpenBacklog}
            title="Browse Vintage Sets Catalog (1999–2021)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-950/40 text-amber-300 border border-amber-800/50 hover:bg-amber-900/40 transition-colors cursor-pointer"
          >
            <Archive className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">138 Vintage Sets</span>
            <span className="md:hidden">Vintage</span>
          </button>

          {/* Database stats badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-slate-800/60 border border-slate-700/60 text-slate-300">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>{stats?.totalCards?.toLocaleString() || 0} cards</span>
            <span className="text-slate-500">•</span>
            <span>{stats?.totalPricePoints?.toLocaleString() || 0} prices</span>
          </div>

          {/* Schedule status badge */}
          <button
            onClick={onOpenSync}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">2x/Day Sync</span>
          </button>

          {/* Update prices now button */}
          <button
            onClick={onSyncPrices}
            disabled={isSyncingPrices}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white shadow-md shadow-cyan-600/20 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPrices ? 'animate-spin' : ''}`} />
            <span>{isSyncingPrices ? 'Syncing...' : 'Update Prices'}</span>
          </button>

        </div>
      </div>
    </header>
  );
}
