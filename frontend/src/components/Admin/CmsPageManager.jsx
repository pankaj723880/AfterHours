import React, { useState } from 'react';
import { Layout, Globe, Search, Save, Check, RefreshCw, Eye, AlertCircle, Sparkles } from 'lucide-react';

export default function CmsPageManager({ draft, onUpdateDraft, showToast }) {
  const pages = draft?.pages || [];
  const [selectedRoute, setSelectedRoute] = useState(pages[0]?.route || 'home');
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const activePage = pages.find(p => p.route === selectedRoute) || {
    route: selectedRoute,
    title: '',
    subtitle: '',
    seoTitle: '',
    seoDescription: '',
    bannerImage: '',
    badge: '',
    enabled: true
  };

  const filteredPages = pages.filter(p =>
    (p.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.route || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.subtitle || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFieldChange = (field, value) => {
    onUpdateDraft(prev => {
      const existingPages = [...(prev.pages || [])];
      const idx = existingPages.findIndex(p => p.route === selectedRoute);
      const updatedPage = {
        ...(existingPages[idx] || { route: selectedRoute, enabled: true }),
        [field]: value
      };

      if (idx >= 0) {
        existingPages[idx] = updatedPage;
      } else {
        existingPages.push(updatedPage);
      }

      return {
        ...prev,
        pages: existingPages
      };
    });
  };

  const handleToggleEnabled = (routeKey, currentVal) => {
    onUpdateDraft(prev => {
      const existingPages = [...(prev.pages || [])];
      const idx = existingPages.findIndex(p => p.route === routeKey);
      if (idx >= 0) {
        existingPages[idx] = { ...existingPages[idx], enabled: !currentVal };
      }
      return { ...prev, pages: existingPages };
    });
    showToast?.(`Page ${routeKey} ${!currentVal ? 'enabled' : 'disabled'} in draft`, 'info');
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layout className="w-5 h-5 text-amber-400" />
            Page & Route Manager
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Configure dynamic headings, subtitles, banners, badges, and SEO metadata for every user-facing page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-amber-400/90 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
            {pages.length} Pages Configured
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Page Selector List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter pages or routes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-900/80 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
            {filteredPages.map(page => {
              const isSelected = page.route === selectedRoute;
              return (
                <div
                  key={page.route}
                  onClick={() => setSelectedRoute(page.route)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${isSelected
                      ? 'bg-amber-500/15 border-amber-500/50 shadow-md'
                      : 'bg-neutral-900/40 border-neutral-800/80 hover:bg-neutral-900/80 hover:border-neutral-700'
                    }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold truncate ${isSelected ? 'text-amber-300' : 'text-neutral-200'}`}>
                        {page.title || page.route}
                      </span>
                      {page.badge && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-800 text-amber-400 font-mono shrink-0">
                          {page.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-neutral-500 mt-0.5">
                      /{page.route === 'home' ? '' : page.route}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleEnabled(page.route, page.enabled);
                    }}
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition ${page.enabled !== false
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-neutral-800 text-neutral-500 border border-neutral-700'
                      }`}
                  >
                    {page.enabled !== false ? 'Active' : 'Disabled'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Page Edit Form */}
        <div className="lg:col-span-8 p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div>
              <span className="text-xs uppercase font-mono tracking-wider text-amber-400">Editing Route</span>
              <h3 className="text-base font-bold text-white flex items-center gap-2 mt-0.5">
                /{activePage.route === 'home' ? '' : activePage.route}
                <span className="text-xs font-normal text-neutral-400">({activePage.title})</span>
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-neutral-300 font-medium">Page Visibility:</label>
              <input
                type="checkbox"
                checked={activePage.enabled !== false}
                onChange={(e) => handleFieldChange('enabled', e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Display Title / Heading</label>
              <input
                type="text"
                value={activePage.title || ''}
                onChange={(e) => handleFieldChange('title', e.target.value)}
                placeholder="Page main title..."
                className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">Pill Badge Text (Optional)</label>
              <input
                type="text"
                value={activePage.badge || ''}
                onChange={(e) => handleFieldChange('badge', e.target.value)}
                placeholder="e.g. Live FM, 3D Club, Retro..."
                className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-300">Subtitle / Tagline Description</label>
            <textarea
              rows={2}
              value={activePage.subtitle || ''}
              onChange={(e) => handleFieldChange('subtitle', e.target.value)}
              placeholder="Descriptive subtitle shown beneath the page header..."
              className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-300">Hero / Header Banner Image URL</label>
            <input
              type="text"
              value={activePage.bannerImage || ''}
              onChange={(e) => handleFieldChange('bannerImage', e.target.value)}
              placeholder="https://images.unsplash.com/... or /hero-cinematic.png"
              className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
            />
            {activePage.bannerImage && (
              <div className="mt-2 h-24 rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950">
                <img src={activePage.bannerImage} alt="Banner Preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          {/* SEO Metadata Box */}
          <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800/80 space-y-3">
            <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              SEO & Social Sharing Metadata
            </h4>

            <div className="space-y-1.5">
              <label className="text-[11px] text-neutral-400">Meta Title</label>
              <input
                type="text"
                value={activePage.seoTitle || ''}
                onChange={(e) => handleFieldChange('seoTitle', e.target.value)}
                placeholder="Browser tab title & search engine snippet..."
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-neutral-400">Meta Description</label>
              <textarea
                rows={2}
                value={activePage.seoDescription || ''}
                onChange={(e) => handleFieldChange('seoDescription', e.target.value)}
                placeholder="Concise summary for search engines and link previews..."
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50 resize-none"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Changes are saved immediately to your active draft. Click <strong>Publish Changes</strong> in the top bar to apply them to the live website.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

