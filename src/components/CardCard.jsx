import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Zap, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { getCardImageUrl } from '../lib/imageHelper';

const GAME_BADGES = {
  pokemon: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
  onepiece: 'bg-rose-950/80 text-rose-300 border-rose-800/60',
  fusionworld: 'bg-orange-950/80 text-orange-300 border-orange-800/60',
  gundam: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60'
};

export default function CardCard({ card, onSelect, onLiveCheck }) {
  const [imageSrc, setImageSrc] = useState(() => getCardImageUrl(card));
  const [imageError, setImageError] = useState(false);
  const [isLiveChecking, setIsLiveChecking] = useState(false);

  useEffect(() => {
    setImageSrc(getCardImageUrl(card));
    setImageError(false);
  }, [card.image_url, card.local_image_path]);

  const handleImageError = () => {
    if (card.image_url && !imageSrc?.includes('/api/proxy/image')) {
      setImageSrc(`http://localhost:3001/api/proxy/image?url=${encodeURIComponent(card.image_url)}`);
    } else {
      setImageError(true);
    }
  };

  const gameBadge = GAME_BADGES[card.game_id] || 'bg-slate-800 text-slate-300 border-slate-700';

  const handleLiveCheck = async (e) => {
    e.stopPropagation();
    setIsLiveChecking(true);
    try {
      await onLiveCheck(card.id);
    } finally {
      setIsLiveChecking(false);
    }
  };

  const hasPrice = card.market_price !== null && card.market_price !== undefined;
  const isLive = card.price_source === 'tcgplayer_live' || card.price_source === 'live_fetch';

  return (
    <div
      onClick={() => onSelect(card)}
      className="group relative bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-3.5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/60 cursor-pointer flex flex-col justify-between"
    >
      {/* Top Media / Artwork Container */}
      <div className="relative aspect-[7/10] w-full rounded-xl overflow-hidden bg-slate-950/80 border border-slate-800/80 mb-3 flex items-center justify-center">
        {imageSrc && !imageError ? (
          <img
            src={imageSrc}
            alt={card.name}
            loading="lazy"
            onError={handleImageError}
            className="w-full h-full object-contain p-1 transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <span className="text-2xl mb-1">🃏</span>
            <span className="text-xs text-slate-500 font-medium">{card.card_number}</span>
            <span className="text-xs text-slate-400 font-semibold line-clamp-1">{card.name}</span>
          </div>
        )}

        {/* Live fetched indicator tag */}
        {isLive && (
          <div className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md backdrop-blur-sm flex items-center gap-1">
            <Zap className="w-2.5 h-2.5 fill-current" />
            LIVE
          </div>
        )}

        {/* Quick Live Check Button */}
        <button
          onClick={handleLiveCheck}
          disabled={isLiveChecking}
          title="Run instant live TCGPlayer price query"
          className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-slate-900/90 hover:bg-cyan-600 text-slate-300 hover:text-white border border-slate-700/70 hover:border-cyan-500 transition-all flex items-center justify-center shadow-lg backdrop-blur-sm opacity-0 group-hover:opacity-100"
        >
          <Zap className={`w-3.5 h-3.5 ${isLiveChecking ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>

      {/* Card Info */}
      <div className="space-y-1.5 flex-1 flex flex-col justify-between">
        <div>
          {/* Header row: Game & Card Number */}
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${gameBadge}`}>
              {card.game_code || card.game_id}
            </span>
            <span className="font-mono text-slate-400 text-[11px]">
              {card.card_number}
            </span>
          </div>

          {/* Card Name */}
          <h3 className="font-semibold text-slate-100 text-sm line-clamp-1 group-hover:text-cyan-400 transition-colors">
            {card.name}
          </h3>

          {/* Set & Rarity */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
            <span className="line-clamp-1 max-w-[130px]" title={card.set_name}>
              {card.set_name}
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-cyan-400/90 font-medium shrink-0">
              {card.rarity}
            </span>
          </div>
        </div>

        {/* Pricing Summary */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium flex items-center gap-1">
              <span>TCGPlayer Market</span>
              {hasPrice && <CheckCircle2 className="w-2.5 h-2.5 text-cyan-400" />}
            </div>

            {hasPrice ? (
              <div className="text-base font-bold text-white flex items-center gap-1.5 mt-0.5">
                <span>${Number(card.market_price).toFixed(2)}</span>
                
                {/* 24h Change */}
                {card.change24h !== null && (
                  <span
                    className={`text-[11px] font-semibold flex items-center ${
                      card.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {card.change24h >= 0 ? (
                      <TrendingUp className="w-3 h-3 inline mr-0.5" />
                    ) : (
                      <TrendingDown className="w-3 h-3 inline mr-0.5" />
                    )}
                    {card.change24h > 0 ? `+${card.change24h}%` : `${card.change24h}%`}
                  </span>
                )}
              </div>
            ) : (
              <div className="text-xs font-medium text-slate-500 italic mt-0.5 flex items-center gap-1">
                <span>Unlisted</span>
                <span className="text-[10px] text-slate-600">(Check ⚡)</span>
              </div>
            )}
          </div>

          {/* Floor / Low price badge if available */}
          {card.low_price && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                Floor
              </div>
              <div className="text-xs font-semibold text-emerald-400/90">
                ${Number(card.low_price).toFixed(2)}
              </div>
            </div>
          )}
        </div>

        {/* PSA 10 & 9 Graded Price (if available) */}
        {card.graded_psa10 ? (
          <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-rose-950/90 border border-rose-700/60 text-rose-300 font-bold text-[10px] tracking-wide shadow-sm">
                PSA 10
              </span>
              <span className="font-bold text-rose-400">
                ${Number(card.graded_psa10).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {card.graded_psa9 && (
              <div className="text-[11px] text-slate-400 font-medium">
                <span className="text-slate-500 mr-1">PSA 9:</span>
                <span className="text-slate-300">${Number(card.graded_psa9).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
