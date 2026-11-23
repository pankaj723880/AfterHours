import React, { useState, useMemo } from 'react';
import {
  Sliders,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Search,
  Layers,
  Menu,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Info,
  Radio,
  Eye,
  EyeOff,
  Filter
} from 'lucide-react';
import { useUiConfig } from '../../context/UiConfigContext';
import {
  UI_VISIBILITY_REGISTRY,
  UI_ELEMENT_CATEGORIES,
  getDefaultVisibilityMap
} from '../../constants/uiVisibilityRegistry';

export default function UiVisibilityControls({ authToken, showToast }) {
  const { visibility, updateVisibility, resetToDefaults, lastUpdated, isLoading } = useUiConfig();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all'); // 'all' | 'nav' | 'section' | 'btn'
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingKeys, setPendingKeys] = useState(new Set());

  // Category Tabs metadata
  const categories = [
    { id: 'all', label: 'All Elements', icon: Layers, count: UI_VISIBILITY_REGISTRY.length },
    {
      id: UI_ELEMENT_CATEGORIES.NAV,
      label: 'Sidebar & Nav',
      icon: Menu,
      count: UI_VISIBILITY_REGISTRY.filter(i => i.category === UI_ELEMENT_CATEGORIES.NAV).length
    },
    {
      id: UI_ELEMENT_CATEGORIES.SECTION,
      label: 'Cards & Sections',
      icon: Layers,
      count: UI_VISIBILITY_REGISTRY.filter(i => i.category === UI_ELEMENT_CATEGORIES.SECTION).length
    },
    {
      id: UI_ELEMENT_CATEGORIES.BTN,
      label: 'Buttons & Controls',
      icon: ToggleRight,
      count: UI_VISIBILITY_REGISTRY.filter(i => i.category === UI_ELEMENT_CATEGORIES.BTN).length
    }
  ];

  // Filtered Registry Items
  const filteredItems = useMemo(() => {
    return UI_VISIBILITY_REGISTRY.filter(item => {
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        item.label.toLowerCase().includes(q) ||
        item.key.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  // Overall Statistics
  const stats = useMemo(() => {
    let visibleCount = 0;
    let hiddenCount = 0;
    for (const item of UI_VISIBILITY_REGISTRY) {
      const isVis = typeof visibility[item.key] === 'boolean' ? visibility[item.key] : true;
      if (isVis) visibleCount++;
      else hiddenCount++;
    }
    return { visibleCount, hiddenCount, total: UI_VISIBILITY_REGISTRY.length };
  }, [visibility]);

  // Toggle single item
  const handleToggle = async (key) => {
    const currentVal = typeof visibility[key] === 'boolean' ? visibility[key] : true;
    const nextVal = !currentVal;

    setPendingKeys(prev => new Set(prev).add(key));
    try {
      await updateVisibility({ [key]: nextVal }, authToken);
      if (showToast) {
        showToast(`${nextVal ? '👁️ Shown' : '🚫 Hidden'}: ${key}`);
      }
    } catch (err) {
      if (showToast) {
        showToast(`Failed to update ${key}: ${err.message}`, 'error');
      }
    } finally {
      setPendingKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // Group Toggle (Show All or Hide All in current category/filtered list)
  const handleGroupToggle = async (targetState) => {
    if (filteredItems.length === 0) return;

    const updates = {};
    filteredItems.forEach(item => {
      updates[item.key] = targetState;
    });

    setIsUpdating(true);
    try {
      await updateVisibility(updates, authToken);
      if (showToast) {
        showToast(targetState ? `✅ Enabled ${filteredItems.length} elements` : `🚫 Disabled ${filteredItems.length} elements`);
      }
    } catch (err) {
      if (showToast) {
        showToast('Group toggle failed: ' + err.message, 'error');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  // Reset All to Visible
  const handleResetAll = async () => {
    if (!window.confirm('Reset ALL buttons, sections, cards, and navigation items to visible across the entire platform?')) {
      return;
    }

    setIsUpdating(true);
    try {
      await resetToDefaults(authToken);
      if (showToast) {
        showToast('🔄 All UI elements reset to visible (default state)!');
      }
    } catch (err) {
      if (showToast) {
        showToast('Reset failed: ' + err.message, 'error');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Workspace Header */}
      <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-neutral-900/90 via-neutral-900/60 to-amber-950/20 border border-neutral-800/80 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Global Feature & UI Visibility</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>UI Element Show / Hide Controls</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">
                {stats.visibleCount}/{stats.total} Active
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl">
              Toggle any button, card, section, or sidebar item across Desktop Web, Mobile Web, and Android APK.
              Changes persist in MongoDB and broadcast instantly via Socket.io without requiring client page reloads.
            </p>
          </div>

          {/* Quick Global Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => handleGroupToggle(true)}
              className="px-3 py-2 rounded-xl bg-neutral-800/90 hover:bg-neutral-700 text-neutral-200 border border-neutral-700/80 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
              title="Enable all elements in current filtered view"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              <span>Enable Group</span>
            </button>

            <button
              type="button"
              disabled={isUpdating}
              onClick={() => handleGroupToggle(false)}
              className="px-3 py-2 rounded-xl bg-neutral-800/90 hover:bg-neutral-700 text-neutral-200 border border-neutral-700/80 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
              title="Disable all elements in current filtered view"
            >
              <EyeOff className="w-3.5 h-3.5 text-rose-400" />
              <span>Disable Group</span>
            </button>

            <button
              type="button"
              disabled={isUpdating}
              onClick={handleResetAll}
              className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 disabled:opacity-50"
              title="Reset all elements to default visible state"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-amber-400 ${isUpdating ? 'animate-spin' : ''}`} />
              <span>Reset All to Visible</span>
            </button>
          </div>
        </div>

        {/* Telemetry Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4 mt-4 border-t border-neutral-800/80 text-xs">
          <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800 flex items-center justify-between">
            <span className="text-neutral-400">Total Registry Keys:</span>
            <span className="font-mono font-bold text-white">{stats.total}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800 flex items-center justify-between">
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Visible:
            </span>
            <span className="font-mono font-bold text-emerald-300">{stats.visibleCount}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800 flex items-center justify-between">
            <span className="text-rose-400 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> Hidden:
            </span>
            <span className="font-mono font-bold text-rose-300">{stats.hiddenCount}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800 flex items-center justify-between">
            <span className="text-neutral-400">Live Sync:</span>
            <span className="font-mono font-bold text-amber-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Socket.io
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {categories.map(cat => {
            const IconComp = cat.icon;
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer select-none ${
                  active
                    ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                    : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800'
                }`}
              >
                <IconComp className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  active ? 'bg-neutral-950/30 text-neutral-950' : 'bg-neutral-800 text-neutral-400'
                }`}>
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search elements or keys..."
            className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-neutral-900/90 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/60 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white text-xs"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Elements Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredItems.map(item => {
          const isVis = typeof visibility[item.key] === 'boolean' ? visibility[item.key] : true;
          const isPending = pendingKeys.has(item.key);

          return (
            <div
              key={item.key}
              className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-3 ${
                isVis
                  ? 'bg-neutral-900/70 border-neutral-800/90 hover:border-amber-500/30 shadow-md'
                  : 'bg-neutral-950/60 border-neutral-900 opacity-75 hover:opacity-100'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md border font-bold ${
                    item.category === UI_ELEMENT_CATEGORIES.NAV
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      : item.category === UI_ELEMENT_CATEGORIES.SECTION
                      ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {item.category === UI_ELEMENT_CATEGORIES.NAV ? 'Sidebar / Nav' : item.category === UI_ELEMENT_CATEGORIES.SECTION ? 'Card / Section' : 'Button / Control'}
                  </span>

                  <span className={`text-[10px] font-mono font-bold flex items-center gap-1 ${
                    isVis ? 'text-emerald-400' : 'text-neutral-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isVis ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`} />
                    {isVis ? 'VISIBLE' : 'HIDDEN'}
                  </span>
                </div>

                <h4 className="text-xs sm:text-sm font-bold text-white leading-tight">
                  {item.label}
                </h4>

                <p className="text-[11px] text-neutral-400 leading-snug line-clamp-2">
                  {item.description}
                </p>

                <div className="pt-1">
                  <code className="text-[10px] font-mono text-neutral-500 bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800">
                    {item.key}
                  </code>
                </div>
              </div>

              {/* Bottom Toggle Control */}
              <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between gap-2">
                <span className="text-[11px] text-neutral-400">
                  {isVis ? 'Active on all devices' : 'Suppressed globally'}
                </span>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleToggle(item.key)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                    isVis ? 'bg-emerald-500' : 'bg-neutral-700'
                  }`}
                  role="switch"
                  aria-checked={isVis}
                  aria-label={`Toggle visibility for ${item.label}`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      isVis ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="p-8 sm:p-12 text-center rounded-3xl border border-dashed border-neutral-800 text-neutral-500 space-y-2">
          <Filter className="w-8 h-8 mx-auto text-neutral-600" />
          <p className="font-bold text-neutral-400 text-sm">No UI elements match "{searchQuery}"</p>
          <p className="text-xs text-neutral-500">Try clearing the search query or selecting a different category tab.</p>
        </div>
      )}
    </div>
  );
}
