import React, { useState, useEffect } from 'react';
import { X, Archive, Calendar, Layers, CheckCircle2, Clock, Search } from 'lucide-react';
import { fetchSets } from '../lib/api';

export default function BacklogModal({ isOpen, onClose }) {
  const [vintageSets, setVintageSets] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    async function load() {
      setIsLoading(true);
      try {
        const sets = await fetchSets('pokemon');
        // Filter vintage sets (is_recent === 0 or releaseDate < 2022)
        const vintage = sets.filter(s => s.is_recent === 0 || (s.release_date && s.release_date < '2022/01/01'));
        setVintageSets(vintage);
      } catch (err) {
        console.error('Failed to load vintage sets:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const filtered = vintageSets.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    (s.code && s.code.toLowerCase().includes(search.toLowerCase())) ||
    (s.release_date && s.release_date.includes(search))
  );

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md p-4 sm:p-6 flex justify-center items-start cursor-pointer"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 sm:my-10 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-800/60 flex items-center justify-center text-amber-400">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Vintage Sets Catalog (1999–2021)</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  {vintageSets.length} Sets Active
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                14,500+ vintage cards & price histories ingested locally from Base Set up to 2021.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search bar inside modal */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/50">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search vintage set (e.g., Base, Team Rocket, Neo, 2003, Gym)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl text-xs text-slate-100 placeholder-slate-500 outline-none"
            />
          </div>
        </div>

        {/* Content list */}
        <div className="p-6 max-h-[420px] overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading vintage catalog...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">No vintage sets matching "{search}"</div>
          ) : (
            filtered.map((s) => (
              <div
                key={s.id}
                className="p-3 bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 rounded-xl flex items-center justify-between text-xs transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-[10px]">
                    {s.code || 'SET'}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-200">{s.name}</div>
                    <div className="text-slate-500 flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {s.release_date || 'Vintage'}
                      </span>
                      <span>•</span>
                      <span>{s.total_cards} cards</span>
                    </div>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-lg bg-emerald-950/60 text-emerald-300 font-mono text-[10px] border border-emerald-800/60 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  ACTIVE
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>All <strong>{vintageSets.length} vintage sets</strong> are active and selectable in the main filter bar.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
