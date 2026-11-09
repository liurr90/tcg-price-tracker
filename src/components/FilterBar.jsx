import React, { useState, useRef, useEffect } from 'react';
import { Search, Filter, ArrowUpDown, X, Check, ChevronDown, CheckSquare, Square, History, Sparkles, Award, Package, Layers } from 'lucide-react';

export default function FilterBar({
  sets = [],
  selectedSets = [],
  onToggleSet,
  onSelectAllSets,
  onClearSets,
  searchQuery,
  onSearchChange,
  selectedRarity,
  onSelectRarity,
  selectedSort,
  onSelectSort,
  gradedOnly = false,
  onToggleGradedOnly,
  productType = 'all',
  onSelectProductType,
  sealedType = 'boxes',
  onSelectSealedType,
  onClearFilters,
  totalResults = 0
}) {
  const [isSetDropdownOpen, setIsSetDropdownOpen] = useState(false);
  const [setFilterQuery, setSetFilterQuery] = useState('');
  const [setEraFilter, setSetEraFilter] = useState('all'); // 'all', 'recent', 'vintage'
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsSetDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasActiveFilters = selectedSets.length > 0 || searchQuery || selectedRarity || gradedOnly || productType !== 'all' || (productType === 'sealed' && sealedType !== 'boxes') || (selectedSort !== 'price_desc');

  const recentCount = sets.filter(s => s.is_recent === 1).length;
  const vintageCount = sets.filter(s => s.is_recent === 0).length;

  // Filter sets list by search query and era filter within the dropdown
  const filteredSets = sets.filter((s) => {
    if (setEraFilter === 'recent' && s.is_recent !== 1) return false;
    if (setEraFilter === 'vintage' && s.is_recent !== 0) return false;
    if (!setFilterQuery) return true;
    const q = setFilterQuery.toLowerCase();
    const qNorm = q.replace(/[^a-z0-9]/g, '');
    const nameNorm = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const codeNorm = (s.code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return s.name.toLowerCase().includes(q) || 
      (s.code && s.code.toLowerCase().includes(q)) || 
      (qNorm && nameNorm.includes(qNorm)) || 
      (qNorm && codeNorm.includes(qNorm));
  });

  // Distinct rarities
  const RARITY_OPTIONS = [
    'Common',
    'Uncommon',
    'Rare',
    'Rare Holo',
    'Super Rare',
    'Secret Rare',
    'Special Illustration',
    'Gold Star',
    'Shining',
    'Leader',
    'Parallel',
    'LR',
    'SR',
    'SEC'
  ];

  // Button label for sets
  let setButtonLabel = `All Sets (${sets.length})`;
  if (selectedSets.length === 1) {
    const s = sets.find(item => item.id === selectedSets[0]);
    setButtonLabel = s ? s.name : '1 Set Selected';
  } else if (selectedSets.length > 1) {
    setButtonLabel = `${selectedSets.length} Sets Selected`;
  }

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        
        {/* Left: Search input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by card name or number (e.g., Charizard, Lugia, Luffy, FB01-001)..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 focus:border-cyan-500 rounded-xl text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Right: Selectors & Sort */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Multi-Set Selector Popover */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsSetDropdownOpen(!isSetDropdownOpen)}
              className={`px-3.5 py-2 rounded-xl text-sm font-medium border flex items-center justify-between gap-2 min-w-[210px] max-w-[280px] transition-all cursor-pointer ${
                selectedSets.length > 0
                  ? 'bg-cyan-950/60 border-cyan-700/80 text-cyan-200'
                  : 'bg-slate-950/80 border-slate-800 text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Filter className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">{setButtonLabel}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {selectedSets.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-500 text-slate-950">
                    {selectedSets.length}
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isSetDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Dropdown Panel */}
            {isSetDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[460px] animate-in fade-in zoom-in-95 duration-100">
                
                {/* Search & Era inside sets */}
                <div className="p-3 border-b border-slate-800 bg-slate-950/80 space-y-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filter sets (e.g., Base, Neo, 30th, OP-01)..."
                      value={setFilterQuery}
                      onChange={(e) => setSetFilterQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-lg text-xs text-slate-100 placeholder-slate-500 outline-none"
                      autoFocus
                    />
                    {setFilterQuery && (
                      <button
                        onClick={() => setSetFilterQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Era filter tabs (only show if both modern and vintage exist) */}
                  {vintageCount > 0 && (
                    <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-[11px]">
                      <button
                        onClick={() => setSetEraFilter('all')}
                        className={`py-1 rounded font-medium transition-colors ${
                          setEraFilter === 'all' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        All ({sets.length})
                      </button>
                      <button
                        onClick={() => setSetEraFilter('recent')}
                        className={`py-1 rounded font-medium transition-colors ${
                          setEraFilter === 'recent' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Recent ({recentCount})
                      </button>
                      <button
                        onClick={() => setSetEraFilter('vintage')}
                        className={`py-1 rounded font-medium transition-colors ${
                          setEraFilter === 'vintage' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Vintage ({vintageCount})
                      </button>
                    </div>
                  )}

                  {/* Bulk Actions */}
                  <div className="flex items-center justify-between text-xs px-1 text-slate-400">
                    <span>{selectedSets.length} of {sets.length} selected</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onSelectAllSets(filteredSets.map(s => s.id))}
                        className="text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                      >
                        Select Filtered
                      </button>
                      <button
                        onClick={onClearSets}
                        className="text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sets Checkbox List */}
                <div className="overflow-y-auto flex-1 p-2 space-y-1 max-h-64">
                  {filteredSets.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">No matching sets found</div>
                  ) : (
                    filteredSets.map((s) => {
                      const isSelected = selectedSets.includes(s.id);
                      const isVintage = s.is_recent === 0;
                      return (
                        <div
                          key={s.id}
                          onClick={() => onToggleSet(s.id)}
                          className={`p-2 rounded-xl flex items-center justify-between gap-2.5 cursor-pointer text-xs transition-colors ${
                            isSelected
                              ? 'bg-cyan-950/50 text-cyan-200 border border-cyan-800/60 font-medium'
                              : 'hover:bg-slate-800/80 text-slate-300 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                              isSelected ? 'bg-cyan-500 border-cyan-400 text-slate-950' : 'border-slate-600 bg-slate-950'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>

                            <div className="truncate">
                              <span className="font-semibold text-slate-100">{s.name}</span>
                              {s.code && !s.name.includes(s.code) && (
                                <span className="ml-1.5 font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                                  {s.code}
                                </span>
                              )}
                              {isVintage && (
                                <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-amber-950/80 text-amber-400 border border-amber-900/40">
                                  {s.release_date ? s.release_date.slice(0, 4) : 'Vintage'}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-400 shrink-0">
                            {s.total_cards > 0 ? `${s.total_cards} cards` : ''}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Done Footer */}
                <div className="p-2.5 bg-slate-950 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => setIsSetDropdownOpen(false)}
                    className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>

              </div>
            )}
          </div>

          {/* Rarity Selector */}
          <div className="relative min-w-[140px]">
            <select
              value={selectedRarity}
              onChange={(e) => onSelectRarity(e.target.value)}
              className="w-full appearance-none px-3.5 py-2 pr-8 bg-slate-950/80 border border-slate-800 focus:border-cyan-500 rounded-xl text-sm text-slate-200 outline-none transition-colors cursor-pointer"
            >
              <option value="">All Rarities</option>
              {RARITY_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Sealed / Singles / All Segmented Filter */}
          <div className="flex items-center p-0.5 bg-slate-950/80 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => onSelectProductType && onSelectProductType('all')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                productType === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Show all items (singles & sealed)"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>All</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectProductType && onSelectProductType('singles')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                productType === 'singles'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Filter to individual trading cards only"
            >
              <span>Singles</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectProductType && onSelectProductType('sealed')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                productType === 'sealed'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Filter to sealed booster boxes, cases, ETBs, and starter decks"
            >
              <Package className="w-3.5 h-3.5 text-emerald-300" />
              <span>Sealed</span>
            </button>
          </div>

          {/* Sealed Sub-category (Distinguish Cases from Boxes/Displays) */}
          {productType === 'sealed' && (
            <div className="flex items-center p-0.5 bg-slate-950/80 border border-emerald-900/60 rounded-xl animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onClick={() => onSelectSealedType && onSelectSealedType('boxes')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  sealedType === 'boxes'
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Boxes, Displays, ETBs & Packs (Cases hidden by default)"
              >
                Boxes & Packs
              </button>
              <button
                type="button"
                onClick={() => onSelectSealedType && onSelectSealedType('cases')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  sealedType === 'cases'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="View Cases of product only"
              >
                Cases Only
              </button>
              <button
                type="button"
                onClick={() => onSelectSealedType && onSelectSealedType('all_sealed')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  sealedType === 'all_sealed'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="View all sealed products (Boxes + Cases)"
              >
                All Sealed
              </button>
            </div>
          )}

          {/* Graded Only Toggle */}
          <button
            type="button"
            onClick={onToggleGradedOnly}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border shrink-0 ${
              gradedOnly
                ? 'bg-amber-950/80 border-amber-500/90 text-amber-200 shadow-md shadow-amber-950/50 ring-1 ring-amber-500/30'
                : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
            title="Filter to only cards with certified PSA or Beckett graded valuations"
          >
            <Award className={`w-3.5 h-3.5 ${gradedOnly ? 'text-amber-400 fill-amber-400/20' : 'text-slate-400'}`} />
            <span>Graded Only</span>
          </button>

          {/* Sort Selector */}
          <div className="relative min-w-[210px]">
            <select
              value={selectedSort}
              onChange={(e) => onSelectSort(e.target.value)}
              className="w-full appearance-none px-3.5 py-2 pr-8 bg-slate-950/80 border border-slate-800 focus:border-cyan-500 rounded-xl text-sm text-slate-200 outline-none transition-colors cursor-pointer"
            >
              <optgroup label="Market / Raw Price" className="bg-slate-900 text-slate-400 font-semibold">
                <option value="price_desc" className="bg-slate-950 text-slate-200 font-normal">Highest Raw Price</option>
                <option value="price_asc" className="bg-slate-950 text-slate-200 font-normal">Lowest Raw Price</option>
              </optgroup>
              <optgroup label="Certified Graded Pricing" className="bg-slate-900 text-amber-400/90 font-semibold">
                <option value="graded_desc" className="bg-slate-950 text-slate-200 font-normal">Graded: High to Low (PSA / BGS 10)</option>
                <option value="graded_asc" className="bg-slate-950 text-slate-200 font-normal">Graded: Low to High (PSA / BGS 10)</option>
                <option value="psa10_only_desc" className="bg-slate-950 text-slate-200 font-normal">PSA 10: High to Low</option>
                <option value="bgs10_only_desc" className="bg-slate-950 text-slate-200 font-normal">BGS 10: High to Low</option>
                <option value="graded_premium_desc" className="bg-slate-950 text-slate-200 font-normal">Graded Premium (vs Raw)</option>
                {/* Fallback support for psa10_desc */}
                <option value="psa10_desc" className="hidden">Top Graded (PSA / BGS 10)</option>
              </optgroup>
              <optgroup label="Card Details" className="bg-slate-900 text-slate-400 font-semibold">
                <option value="name_asc" className="bg-slate-950 text-slate-200 font-normal">Card Name (A-Z)</option>
                <option value="number_asc" className="bg-slate-950 text-slate-200 font-normal">Card Number</option>
              </optgroup>
            </select>
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Clear button */}
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

        </div>
      </div>

      {/* Selected Sets Badges / Chips */}
      {selectedSets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] text-slate-400 mr-1 font-medium">Selected Sets:</span>
          {selectedSets.map((setId) => {
            const s = sets.find(item => item.id === setId);
            if (!s) return null;
            return (
              <span
                key={setId}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-cyan-950/60 text-cyan-200 border border-cyan-800/80 shadow-sm"
              >
                <span>{s.name}</span>
                {s.code && <span className="text-cyan-400/70 font-mono text-[10px]">[{s.code}]</span>}
                <button
                  onClick={() => onToggleSet(setId)}
                  className="hover:text-white ml-0.5 cursor-pointer"
                  title={`Remove ${s.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
          <button
            onClick={onClearSets}
            className="text-[11px] text-slate-400 hover:text-white underline ml-1 cursor-pointer"
          >
            Clear all sets
          </button>
        </div>
      )}

      {/* Results status indicator */}
      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <span>
          Showing <span className="text-slate-200 font-semibold">{totalResults.toLocaleString()}</span> cards
        </span>
        <span className="text-slate-500">
          All modern & vintage card sets active (1999–2026)
        </span>
      </div>
    </div>
  );
}
