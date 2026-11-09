import React from 'react';
import CardCard from './CardCard';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

export default function CardGrid({
  cards = [],
  pagination = {},
  onPageChange,
  onSelectCard,
  onLiveCheck,
  isLoading
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-pulse">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5 h-[340px] flex flex-col justify-between">
            <div className="aspect-[7/10] bg-slate-800/60 rounded-xl" />
            <div className="space-y-2 mt-2">
              <div className="h-4 bg-slate-800/80 rounded w-3/4" />
              <div className="h-3 bg-slate-800/60 rounded w-1/2" />
            </div>
            <div className="h-8 bg-slate-800/40 rounded mt-2" />
          </div>
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-[350px] border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center p-8 text-center bg-slate-900/30">
        <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 mb-3">
          <Inbox className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-200 mb-1">No Cards Found</h3>
        <p className="text-sm text-slate-400 max-w-sm">
          No cards match your current search and filter criteria. Try adjusting the search term or clearing filters.
        </p>
      </div>
    );
  }

  const { page = 1, totalPages = 1 } = pagination;

  return (
    <div className="space-y-6">
      
      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {cards.map((card) => (
          <CardCard
            key={card.id}
            card={card}
            onSelect={onSelectCard}
            onLiveCheck={onLiveCheck}
          />
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-800/80 pt-4 px-2">
          <div className="text-xs text-slate-400">
            Page <span className="font-semibold text-slate-200">{page}</span> of <span className="font-semibold text-slate-200">{totalPages}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 text-xs font-medium text-slate-300 flex items-center gap-1 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 text-xs font-medium text-slate-300 flex items-center gap-1 transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
