import React, { useState, useEffect } from 'react';
import { 
  X, Clock, RefreshCw, CheckCircle, AlertCircle, Database, 
  HardDrive, DownloadCloud, Image as ImageIcon, StopCircle, CheckCircle2,
  Sparkles, Zap, ArrowDownCircle
} from 'lucide-react';
import { 
  fetchSyncStatus, triggerPriceSync, 
  fetchImageStats, triggerImageDownload, stopImageDownload,
  fetchCompressionStatus, triggerCompression
} from '../lib/api';

export default function SyncModal({ isOpen, onClose, onPriceSyncTriggered }) {
  const [activeTab, setActiveTab] = useState('images'); // 'images' or 'prices'
  
  // Price sync state
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Offline images state
  const [imageStats, setImageStats] = useState(null);
  const [compressStatus, setCompressStatus] = useState(null);
  const [selectedGame, setSelectedGame] = useState('all');
  const [isStartingDownload, setIsStartingDownload] = useState(false);
  const [isStartingCompress, setIsStartingCompress] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load status on open
  useEffect(() => {
    if (!isOpen) return;
    loadStatus();
    loadImageStats();
    loadCompressStatus();
  }, [isOpen]);

  // Polling image stats & compression while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const isBusy = imageStats?.isDownloading || compressStatus?.isCompressing;
    const intervalTime = isBusy ? 1500 : 4000;
    const timer = setInterval(() => {
      loadImageStats();
      loadCompressStatus();
    }, intervalTime);
    return () => clearInterval(timer);
  }, [isOpen, imageStats?.isDownloading, compressStatus?.isCompressing]);

  async function loadStatus() {
    setIsLoading(true);
    try {
      const data = await fetchSyncStatus();
      setStatus(data);
    } catch (err) {
      console.error('Failed to load sync status:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadImageStats() {
    try {
      const data = await fetchImageStats();
      setImageStats(data);
    } catch (err) {
      console.error('Failed to load image stats:', err);
    }
  }

  async function loadCompressStatus() {
    try {
      const data = await fetchCompressionStatus();
      setCompressStatus(data);
    } catch (err) {
      console.error('Failed to load compression status:', err);
    }
  }

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await triggerPriceSync();
      await loadStatus();
      if (onPriceSyncTriggered) onPriceSyncTriggered();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStartImageDownload = async () => {
    setIsStartingDownload(true);
    try {
      await triggerImageDownload({ game: selectedGame });
      await loadImageStats();
    } catch (err) {
      console.error('Failed to start image download:', err);
    } finally {
      setIsStartingDownload(false);
    }
  };

  const handleStopImageDownload = async () => {
    try {
      await stopImageDownload();
      await loadImageStats();
    } catch (err) {
      console.error('Failed to stop image download:', err);
    }
  };

  const handleStartCompression = async () => {
    setIsStartingCompress(true);
    try {
      await triggerCompression();
      await loadCompressStatus();
      await loadImageStats();
    } catch (err) {
      console.error('Failed to start compression:', err);
    } finally {
      setIsStartingCompress(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md p-4 sm:p-6 flex justify-center items-start cursor-pointer"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 sm:my-10 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Data & Storage Management</h2>
              <p className="text-xs text-slate-400">Offline card artwork, lightweight compression, and automated price sync</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('images')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'images'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Offline Images & Compression</span>
            {(imageStats?.isDownloading || compressStatus?.isCompressing) && (
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse ml-0.5" />
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('prices')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'prices'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Price Sync & Schedule</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[500px] overflow-y-auto">
          {activeTab === 'images' ? (
            /* TAB: Offline Card Images & Compression */
            <div className="space-y-4">
              {/* Storage Overview Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl">
                  <div className="text-[11px] text-slate-400 mb-1 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Locally Cached Images</span>
                  </div>
                  <div className="text-xl font-bold text-white tracking-tight">
                    {imageStats?.offlineCards?.toLocaleString() || 0}
                    <span className="text-xs font-normal text-slate-400 ml-1.5">
                      / {imageStats?.totalCards?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="text-[11px] text-cyan-400 mt-1 font-medium">
                    {imageStats?.coveragePct || 0}% card coverage
                  </div>
                </div>

                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl">
                  <div className="text-[11px] text-slate-400 mb-1 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Disk Space Used</span>
                  </div>
                  <div className="text-xl font-bold text-white tracking-tight">
                    {imageStats?.totalMB || '0.0'} <span className="text-xs font-normal text-slate-400">MB</span>
                  </div>
                  <div className="text-[11px] text-emerald-400 mt-1 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>WebP Optimized Offline Storage</span>
                  </div>
                </div>
              </div>

              {/* Compression / Storage Optimization Card */}
              {compressStatus?.isCompressing ? (
                <div className="p-4 bg-indigo-950/40 border border-indigo-800/60 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-indigo-300 font-semibold flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                      Optimizing & Compressing Images to WebP...
                    </span>
                    <span className="text-[11px] text-emerald-400 font-mono font-semibold">
                      Saved {compressStatus.savedMB} MB ({compressStatus.savedPct}%)
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                      <div 
                        className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-2.5 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${compressStatus.total > 0 ? Math.min(100, (compressStatus.processed / compressStatus.total) * 100) : 0}%` 
                        }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1.5 font-mono">
                      <span>
                        {compressStatus.processed?.toLocaleString()} / {compressStatus.total?.toLocaleString()} compressed
                      </span>
                      <span>
                        {compressStatus.total > 0 ? ((compressStatus.processed / compressStatus.total) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>

                  {compressStatus.currentFile && (
                    <div className="text-[11px] text-slate-300 truncate bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800/80">
                      <span className="text-slate-500 mr-1.5 uppercase font-mono">{compressStatus.currentGame}:</span>
                      {compressStatus.currentFile}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-indigo-950/30 border border-indigo-900/40 rounded-2xl flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      Image Optimization (WebP 420px, 70% quality)
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      Resizes and compresses heavy raw images down to ~25-45 KB each. Saves 80–95% disk space with crystal clear card view.
                      {compressStatus?.status === 'completed' && compressStatus.savedMB !== '0.0' && (
                        <span className="text-emerald-400 block mt-0.5 font-medium">
                          ✓ Last run saved {compressStatus.savedMB} MB ({compressStatus.savedPct}% disk reduction)!
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleStartCompression}
                    disabled={isStartingCompress}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 shrink-0"
                  >
                    <Zap className={`w-3.5 h-3.5 ${isStartingCompress ? 'animate-bounce' : ''}`} />
                    <span>{isStartingCompress ? 'Starting...' : 'Compress All'}</span>
                  </button>
                </div>
              )}

              {/* Live Download Status & Progress */}
              {imageStats?.isDownloading ? (
                <div className="p-4 bg-cyan-950/40 border border-cyan-800/60 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-cyan-300 font-semibold flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Downloading Card Artwork...
                    </span>
                    <button
                      onClick={handleStopImageDownload}
                      className="px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-800/60 text-rose-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      Stop
                    </button>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                      <div 
                        className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-2.5 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${imageStats.total > 0 ? Math.min(100, (imageStats.completed / imageStats.total) * 100) : 0}%` 
                        }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1.5 font-mono">
                      <span>
                        {imageStats.completed?.toLocaleString()} / {imageStats.total?.toLocaleString()} saved
                      </span>
                      <span>
                        {imageStats.total > 0 ? ((imageStats.completed / imageStats.total) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>

                  {imageStats.currentCard && (
                    <div className="text-[11px] text-slate-300 truncate bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800/80">
                      <span className="text-slate-500 mr-1.5 uppercase font-mono">{imageStats.currentGame}:</span>
                      {imageStats.currentCard}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
                  <div className="text-xs font-semibold text-white">Bulk Download for Offline Access</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Downloads card artwork to your local disk (<span className="font-mono text-cyan-400">/data/images</span>) pre-compressed as lightweight WebP.
                  </p>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                    <select
                      value={selectedGame}
                      onChange={(e) => setSelectedGame(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="all">All Games (All Sets)</option>
                      <option value="onepiece">One Piece TCG (All 61 Sets)</option>
                      <option value="gundam">Gundam Card Game</option>
                      <option value="fusionworld">Dragon Ball Super: Fusion World</option>
                      <option value="pokemon">Pokémon TCG</option>
                    </select>

                    <button
                      onClick={handleStartImageDownload}
                      disabled={isStartingDownload}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-cyan-600/20 disabled:opacity-50"
                    >
                      <DownloadCloud className={`w-3.5 h-3.5 ${isStartingDownload ? 'animate-bounce' : ''}`} />
                      <span>{isStartingDownload ? 'Starting...' : 'Download Images'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* TAB: Price Sync & Schedule */
            <div className="space-y-4">
              {/* Schedule status banner */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Cron Schedule:</span>
                  <span className="text-cyan-400 font-semibold">{status?.schedule || 'Twice daily at 06:00 and 18:00'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Last Recorded Run:</span>
                  <span className="text-slate-200 font-mono">{status?.lastRun || 'Just now'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Daemon Status:</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Active (Local Node Scheduler)
                  </span>
                </div>
              </div>

              {/* Sync Now Action */}
              <div className="p-4 bg-cyan-950/30 border border-cyan-900/40 rounded-2xl flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-white">Trigger Immediate Price Sync</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Fetches latest real TCGPlayer market and low prices across games
                  </div>
                </div>

                <button
                  onClick={handleSyncNow}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-cyan-600/20 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Syncing...' : 'Sync Prices'}</span>
                </button>
              </div>

              {/* Logs */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Recent Sync Logs
                </div>

                <div className="space-y-1.5">
                  {status?.recentLogs?.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-xl text-xs flex items-start gap-2.5"
                    >
                      {log.status === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-200 capitalize">
                            {log.job_type.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {log.timestamp}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px] mt-0.5 line-clamp-2">
                          {log.details}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
