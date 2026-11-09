import React, { useState, useEffect } from 'react';
import { 
  X, Zap, TrendingUp, Calendar, Info, RefreshCw, CheckCircle2, 
  ExternalLink, AlertCircle, Store, Globe, Gavel, Scale, ArrowUpRight,
  Award, Shield, Package, Boxes, ArrowRight
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { fetchCardDetails, triggerLiveQuery } from '../lib/api';
import { getCardImageUrl } from '../lib/imageHelper';

export default function CardModal({ cardId, onClose, onNavigate, onPriceUpdated }) {
  const [card, setCard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiveQuerying, setIsLiveQuerying] = useState(false);
  const [liveQueryMessage, setLiveQueryMessage] = useState(null);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const data = await fetchCardDetails(cardId);
        if (isMounted) setCard(data);
      } catch (err) {
        console.error('Failed to load card details:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [cardId]);

  const handleLiveQuery = async () => {
    setIsLiveQuerying(true);
    setLiveQueryMessage(null);
    try {
      const liveRes = await triggerLiveQuery(cardId);
      if (liveRes.market_price) {
        setLiveQueryMessage(`Multi-source refresh completed: TCGPlayer, Cardmarket, and eBay.`);
      } else {
        setLiveQueryMessage('Card currently has no active marketplace sales on TCGPlayer.');
      }
      // Reload card details to update sources list & chart
      const updatedCard = await fetchCardDetails(cardId);
      setCard(updatedCard);
      if (onPriceUpdated) onPriceUpdated(updatedCard);
    } catch (err) {
      setLiveQueryMessage(`Live query error: ${err.message}`);
    } finally {
      setIsLiveQuerying(false);
    }
  };

  if (!cardId) return null;

  const hasPrice = card?.latest_price?.market_price !== null && card?.latest_price?.market_price !== undefined;
  const sources = card?.sources || [];
  const discrepancy = card?.discrepancy || {};

  const getSourceIcon = (code) => {
    if (code === 'cardmarket') return <Globe className="w-4 h-4 text-blue-400" />;
    if (code === 'ebay') return <Gavel className="w-4 h-4 text-amber-400" />;
    return <Store className="w-4 h-4 text-cyan-400" />;
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md p-4 sm:p-6 flex justify-center items-start cursor-pointer"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 sm:my-10 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Prominent Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 shadow-xl transition-all cursor-pointer"
          title="Close (Esc or click outside)"
        >
          <X className="w-5 h-5 stroke-[2.5]" />
        </button>

        {isLoading || !card ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
            <span className="text-sm text-slate-400">Loading card metadata & marketplace sources...</span>
          </div>
        ) : (
          <div className="p-6 sm:p-8 space-y-6">
            
            {/* Top Overview Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Left: Card Artwork */}
              <div className="md:col-span-5 flex flex-col items-center">
                <div className="relative aspect-[7/10] w-full max-w-[280px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex items-center justify-center">
                  {card.image_url || card.local_image_path ? (
                    <img
                      src={getCardImageUrl(card)}
                      alt={card.name}
                      onError={(e) => {
                        if (card.image_url && !e.target.src.includes('/api/proxy/image')) {
                          e.target.src = `http://localhost:3001/api/proxy/image?url=${encodeURIComponent(card.image_url)}`;
                        }
                      }}
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <div className="text-center p-6">
                      <span className="text-4xl mb-2 block">🃏</span>
                      <span className="text-sm font-semibold text-slate-400">{card.name}</span>
                    </div>
                  )}

                  {sources.length > 0 && (
                    <div className="absolute top-3 left-3 bg-cyan-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-lg flex items-center gap-1">
                      <Store className="w-3 h-3" />
                      {sources.length} SOURCE{sources.length > 1 ? 'S' : ''}
                    </div>
                  )}
                </div>

                <div className="mt-3 text-center">
                  <span className="font-mono text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                    ID: {card.id}
                  </span>
                </div>
              </div>

              {/* Right: Meta Details & Live Query Action */}
              <div className="md:col-span-7 flex flex-col justify-between space-y-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2 pr-12">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                      {card.game_name}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                      {card.card_number}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">
                      {card.rarity}
                    </span>
                    {card.is_sealed === 1 && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        <span>Sealed Product</span>
                      </span>
                    )}
                  </div>

                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    {card.name}
                  </h2>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {card.set_name} {card.set_code ? `(${card.set_code})` : ''}
                  </p>

                  {/* Attributes Badge Row */}
                  <div className="flex flex-wrap gap-2 mt-4 text-xs">
                    {card.card_type && (
                      <div className="bg-slate-800/80 border border-slate-700/60 px-3 py-1 rounded-xl text-slate-300">
                        <span className="text-slate-500 mr-1.5">Type:</span>
                        <span className="font-medium">{card.card_type}</span>
                      </div>
                    )}
                    {card.color && (
                      <div className="bg-slate-800/80 border border-slate-700/60 px-3 py-1 rounded-xl text-slate-300">
                        <span className="text-slate-500 mr-1.5">Color:</span>
                        <span className="font-medium">{card.color}</span>
                      </div>
                    )}
                    {card.cost_or_level && (
                      <div className="bg-slate-800/80 border border-slate-700/60 px-3 py-1 rounded-xl text-slate-300">
                        <span className="text-slate-500 mr-1.5">Cost:</span>
                        <span className="font-medium">{card.cost_or_level}</span>
                      </div>
                    )}
                    {card.power && (
                      <div className="bg-slate-800/80 border border-slate-700/60 px-3 py-1 rounded-xl text-slate-300">
                        <span className="text-slate-500 mr-1.5">Power:</span>
                        <span className="font-medium">{card.power}</span>
                      </div>
                    )}
                  </div>

                  {/* Rules / Effects text */}
                  {card.description && (
                    <div className="mt-4 p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-2xl text-xs text-slate-300 leading-relaxed max-h-36 overflow-y-auto">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Effect / Card Text
                      </div>
                      <p>{card.description}</p>
                    </div>
                  )}
                </div>

                {/* Live Query Action Bar */}
                <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Live Multi-Source Query</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Polls TCGPlayer, Cardmarket, and eBay to detect cross-market discrepancies
                    </div>
                    {liveQueryMessage && (
                      <div className="text-xs font-medium text-emerald-400 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {liveQueryMessage}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleLiveQuery}
                    disabled={isLiveQuerying}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center gap-2 shadow-md shadow-cyan-600/20 transition-all disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLiveQuerying ? 'animate-spin' : ''}`} />
                    <span>{isLiveQuerying ? 'Querying Sources...' : 'Check All Sources'}</span>
                  </button>
                </div>

              </div>
            </div>

            {/* Linked Case Product Banner (When viewing an individual Box/Display that has a Case) */}
            {card.linked_case && (
              <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/40 border border-emerald-600/40 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
                    <Boxes className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-md border border-emerald-700/60">
                        Sealed Case Listing
                      </span>
                      <span className="text-xs text-slate-400">Master Factory Case</span>
                    </div>
                    <h4 className="text-base font-bold text-white mt-1">
                      {card.linked_case.name}
                    </h4>
                    <div className="flex items-center gap-3 mt-1 text-xs">
                      <span className="text-slate-400">
                        Market: <strong className="text-emerald-300 text-sm font-semibold">${Number(card.linked_case.market_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </span>
                      {card.linked_case.low_price && (
                        <span className="text-slate-500">
                          Low: <span className="text-slate-300">${Number(card.linked_case.low_price).toFixed(2)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {card.linked_case.source_url && (
                    <a
                      href={card.linked_case.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-1.5 transition-colors"
                      title="Open Case listing on TCGPlayer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>TCGPlayer</span>
                    </a>
                  )}
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate(card.linked_case.id)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 border border-emerald-500/50 shadow-lg shadow-emerald-900/30 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span>View Case</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Linked Individual Box Banner (When viewing a Case that has a single Box listing) */}
            {card.linked_box && (
              <div className="bg-gradient-to-r from-cyan-950/40 via-slate-900 to-indigo-950/40 border border-cyan-600/40 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0 text-cyan-400">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/80 px-2.5 py-0.5 rounded-md border border-cyan-700/60">
                        Individual Sealed Box
                      </span>
                      <span className="text-xs text-slate-400">Single Box / Display</span>
                    </div>
                    <h4 className="text-base font-bold text-white mt-1">
                      {card.linked_box.name}
                    </h4>
                    <div className="flex items-center gap-3 mt-1 text-xs">
                      <span className="text-slate-400">
                        Market: <strong className="text-cyan-300 text-sm font-semibold">${Number(card.linked_box.market_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </span>
                      {card.linked_box.low_price && (
                        <span className="text-slate-500">
                          Low: <span className="text-slate-300">${Number(card.linked_box.low_price).toFixed(2)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {card.linked_box.source_url && (
                    <a
                      href={card.linked_box.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-1.5 transition-colors"
                      title="Open Box listing on TCGPlayer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>TCGPlayer</span>
                    </a>
                  )}
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate(card.linked_box.id)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 border border-cyan-500/50 shadow-lg shadow-cyan-900/30 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span>View Box</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Graded Valuations (PSA 10, BGS 10, BGS Black Label, PSA 9) */}
            {(card.graded_psa10 || card.graded_bgs10 || card.graded_bgs10_black || card.graded_psa9) ? (
              <div className="bg-gradient-to-r from-rose-950/30 via-slate-900 to-amber-950/30 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-400" />
                      <span>Certified Graded Market Valuations</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Consensus market pricing aggregated from PSA & Beckett auction comps (eBay, PWCC, Goldin) via PriceCharting
                    </p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold">
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    <span>PSA & Beckett Comps</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {/* PSA 10 Card */}
                  {card.graded_psa10 && (
                    <div className="bg-slate-950/70 border border-rose-800/50 rounded-2xl p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-black text-xs tracking-wider shadow-md">
                            PSA 10
                          </span>
                          <span className="text-[11px] font-semibold text-rose-300 uppercase tracking-wide">Gem Mint</span>
                        </div>
                        <div className="text-xl font-black text-white mt-2.5">
                          ${Number(card.graded_psa10).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      {hasPrice && Number(card.graded_psa10) > Number(card.latest_price?.market_price) && (
                        <div className="text-[10px] text-emerald-400 font-medium mt-2 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 shrink-0" />
                          <span>{(Number(card.graded_psa10) / Number(card.latest_price?.market_price)).toFixed(1)}x raw price</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* BGS 10 Pristine Card */}
                  {card.graded_bgs10 && (
                    <div className="bg-slate-950/70 border border-amber-600/50 rounded-2xl p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black text-xs tracking-wider shadow-md">
                            BGS 10
                          </span>
                          <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wide">Pristine</span>
                        </div>
                        <div className="text-xl font-black text-amber-300 mt-2.5">
                          ${Number(card.graded_bgs10).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      {hasPrice && Number(card.graded_bgs10) > Number(card.latest_price?.market_price) && (
                        <div className="text-[10px] text-amber-400 font-medium mt-2 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 shrink-0" />
                          <span>{(Number(card.graded_bgs10) / Number(card.latest_price?.market_price)).toFixed(1)}x raw price</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* BGS 10 Black Label Card */}
                  {card.graded_bgs10_black && (
                    <div className="bg-gradient-to-b from-slate-900 to-black border border-amber-500/80 rounded-2xl p-4 flex flex-col justify-between shadow-lg shadow-amber-950/30">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-amber-400 text-amber-300 font-black text-xs tracking-wider shadow-md flex items-center gap-1">
                            BGS 10 🖤
                          </span>
                          <span className="text-[11px] font-black text-amber-400 uppercase tracking-wide">Black Label</span>
                        </div>
                        <div className="text-xl font-black text-amber-300 mt-2.5">
                          ${Number(card.graded_bgs10_black).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      {hasPrice && Number(card.graded_bgs10_black) > Number(card.latest_price?.market_price) && (
                        <div className="text-[10px] text-amber-300 font-medium mt-2 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 shrink-0" />
                          <span>{(Number(card.graded_bgs10_black) / Number(card.latest_price?.market_price)).toFixed(1)}x raw price</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* PSA 9 Mint Card */}
                  {card.graded_psa9 && (
                    <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs tracking-wider">
                            PSA 9
                          </span>
                          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Mint</span>
                        </div>
                        <div className="text-xl font-bold text-slate-200 mt-2.5">
                          ${Number(card.graded_psa9).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      {hasPrice && (
                        <div className="text-[10px] text-slate-400 font-medium mt-2">
                          <span>{(Number(card.graded_psa9) / Number(card.latest_price?.market_price)).toFixed(1)}x raw price</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Multi-Source Comparison Table & Discrepancy Analysis */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Scale className="w-4 h-4 text-cyan-400" />
                    <span>Market Sources & Price Discrepancies</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Compare current market pricing and arbitrage spread across marketplaces
                  </p>
                </div>

                {/* Discrepancy / Variance Callout Badge */}
                {discrepancy.hasDiscrepancy ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs font-semibold">
                    <Scale className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      Spread: ${discrepancy.spreadUsd} ({discrepancy.spreadPercent}% variance)
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 font-medium">
                    {sources.length} active source{sources.length === 1 ? '' : 's'}
                  </div>
                )}
              </div>

              {/* Source List */}
              <div className="space-y-2.5">
                {sources.length === 0 ? (
                  <div className="p-4 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl text-center text-xs text-slate-500">
                    No marketplace prices recorded yet. Click <strong>"Check All Sources"</strong> above to query live.
                  </div>
                ) : (
                  sources.map((s) => {
                    const meta = s.meta || {};
                    const isCheapest = discrepancy.hasDiscrepancy && discrepancy.cheapestSource?.source === s.source;
                    const isHighest = discrepancy.hasDiscrepancy && discrepancy.highestSource?.source === s.source;
                    const currencySymbol = s.currency === 'EUR' ? '€' : '$';

                    return (
                      <div
                        key={s.id || s.source}
                        className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                          isCheapest 
                            ? 'bg-emerald-950/20 border-emerald-800/60' 
                            : isHighest
                            ? 'bg-rose-950/20 border-rose-800/60'
                            : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        {/* Source Brand & Region */}
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                            {getSourceIcon(meta.code)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{meta.name || s.source}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${meta.badgeClass || 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                                {meta.region || s.currency}
                              </span>
                              {meta.code === 'tcgplayer' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-cyan-950/60 text-cyan-400 border border-cyan-800/50" title="Foreign language notes (e.g. JAPANESE, CHINESE) and loose pack lots are excluded to find the true English floor">
                                  English Floor
                                </span>
                              )}
                              {isCheapest && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
                                  Lowest Market
                                </span>
                              )}
                              {isHighest && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-950 text-rose-300 border border-rose-700">
                                  Highest Market
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                              <span>Recorded: {s.recorded_at}</span>
                              {s.source_url && (
                                <>
                                  <span>•</span>
                                  <a
                                    href={s.source_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 underline"
                                  >
                                    View on Marketplace <ArrowUpRight className="w-3 h-3" />
                                  </a>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Price Details */}
                        <div className="flex items-center gap-5 sm:gap-8 self-end sm:self-center">
                          <div className="text-right">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Floor / Low</div>
                            <div className="text-xs font-bold text-emerald-400">
                              {s.low_price ? `${currencySymbol}${Number(s.low_price).toFixed(2)}` : '--'}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Market Price</div>
                            <div className="text-base font-bold text-white">
                              {s.market_price ? `${currencySymbol}${Number(s.market_price).toFixed(2)}` : '--'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Historical Price Trend Chart */}
            {card.price_history && card.price_history.length > 0 ? (
              <div className="bg-slate-950/70 border border-slate-800 p-5 rounded-3xl space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-cyan-400" />
                      <span>Verified Price History</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Tracking price history across recorded marketplace dates
                    </p>
                  </div>
                </div>

                {/* Recharts Chart */}
                <div className="h-60 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={card.price_history} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis 
                        dataKey="recorded_at" 
                        stroke="#64748b" 
                        fontSize={11} 
                        tickFormatter={(val) => val ? val.slice(5) : ''} 
                      />
                      <YAxis 
                        stroke="#64748b" 
                        fontSize={11} 
                        tickFormatter={(val) => `$${val}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '12px',
                          fontSize: '12px'
                        }}
                        formatter={(val, name, props) => {
                          const src = props.payload?.source || 'Source';
                          return [`$${Number(val).toFixed(2)}`, `${name} (${src})`];
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

                      <Line
                        type="monotone"
                        dataKey="market_price"
                        name="Market Price"
                        stroke="#38bdf8"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#38bdf8' }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="graded_psa10"
                        name="PSA 10 Graded"
                        stroke="#f43f5e"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#f43f5e' }}
                        connectNulls={true}
                      />
                      <Line
                        type="monotone"
                        dataKey="graded_bgs10"
                        name="BGS 10 Pristine"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        strokeDasharray="2 2"
                        dot={{ r: 4, fill: '#f59e0b' }}
                        connectNulls={true}
                      />
                      <Line
                        type="monotone"
                        dataKey="low_price"
                        name="Floor Low"
                        stroke="#34d399"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl text-center space-y-1">
                <div className="text-xs font-semibold text-slate-300">No Historical Sales Stored Yet</div>
                <div className="text-[11px] text-slate-500">
                  Click the <strong>Check All Sources</strong> button above to fetch real-time pricing across marketplaces.
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
