import React, { useState } from 'react';
import { 
  Monitor, 
  Smartphone, 
  Layers, 
  Sliders, 
  Bell, 
  Image as ImageIcon, 
  Sparkles, 
  Check, 
  Save, 
  UploadCloud, 
  RefreshCw, 
  AlertCircle,
  Eye,
  CheckCircle2,
  Copy,
  Layout,
  ExternalLink
} from 'lucide-react';
import { normalizeCmsConfig } from '../../services/cmsClient';

const TARGET_PLATFORMS = [
  {
    id: 'desktop',
    name: 'Website (Desktop)',
    shortName: 'Desktop',
    desc: 'Controls desktop website layout, navigation bar, hero displays, and widescreen parameters.',
    icon: Monitor,
    badge: 'Desktop Web',
    color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/40 text-blue-400'
  },
  {
    id: 'mobile_web',
    name: 'Mobile Website',
    shortName: 'Mobile Web',
    desc: 'Controls responsive mobile browser presentation, touch swipe cards, and mobile bottom bar.',
    icon: Smartphone,
    badge: 'Mobile Browser',
    color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/40 text-emerald-400'
  },
  {
    id: 'android_app',
    name: 'Android Application',
    shortName: 'Android App',
    desc: 'Controls Bubblewrap TWA & Standalone APK configurations, offline download controls, and native status clearances.',
    icon: Smartphone,
    badge: 'Bubblewrap TWA',
    color: 'from-amber-500/20 to-orange-500/20 border-amber-500/40 text-amber-400'
  }
];

export default function PlatformManager({
  draft,
  onUpdateDraft,
  showToast,
  onSaveDraft,
  onPublishLive,
  isSavingDraft = false,
  isPublishingLive = false,
  onOpenMediaPicker,
  onPreviewPlatform
}) {
  const [selectedPlatform, setSelectedPlatform] = useState('desktop');
  const [activeCategory, setActiveCategory] = useState('branding');

  const safeDraft = normalizeCmsConfig(draft);
  const platforms = safeDraft.platforms || { desktop: {}, mobile_web: {}, android_app: {} };
  const currentOverrides = platforms[selectedPlatform] || {};

  // Check if a platform currently has any active overrides
  const hasOverrides = (platformId) => {
    const p = platforms[platformId];
    return p && typeof p === 'object' && Object.keys(p).length > 0;
  };

  const getEffectiveField = (section, field, fallback) => {
    if (currentOverrides[section] && currentOverrides[section][field] !== undefined) {
      return { value: currentOverrides[section][field], isOverridden: true };
    }
    const globalVal = safeDraft[section]?.[field];
    return { value: globalVal !== undefined ? globalVal : fallback, isOverridden: false };
  };

  const handleUpdateOverride = (section, field, value) => {
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const prevPlatforms = { ...(base.platforms || { desktop: {}, mobile_web: {}, android_app: {} }) };
      const currentPlatformObj = { ...(prevPlatforms[selectedPlatform] || {}) };
      const currentSectionObj = { ...(currentPlatformObj[section] || {}) };

      currentSectionObj[field] = value;
      currentPlatformObj[section] = currentSectionObj;
      prevPlatforms[selectedPlatform] = currentPlatformObj;

      return {
        ...base,
        platforms: prevPlatforms
      };
    });
  };

  const handleClearOverride = (section, field) => {
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const prevPlatforms = { ...(base.platforms || { desktop: {}, mobile_web: {}, android_app: {} }) };
      const currentPlatformObj = { ...(prevPlatforms[selectedPlatform] || {}) };
      if (!currentPlatformObj[section]) return base;

      const currentSectionObj = { ...currentPlatformObj[section] };
      delete currentSectionObj[field];

      if (Object.keys(currentSectionObj).length === 0) {
        delete currentPlatformObj[section];
      } else {
        currentPlatformObj[section] = currentSectionObj;
      }

      if (Object.keys(currentPlatformObj).length === 0) {
        delete prevPlatforms[selectedPlatform];
      } else {
        prevPlatforms[selectedPlatform] = currentPlatformObj;
      }

      return {
        ...base,
        platforms: prevPlatforms
      };
    });
    showToast?.(`Reset to global shared default`, 'info');
  };

  const handleResetPlatformOverrides = () => {
    if (!window.confirm(`Are you sure you want to remove all platform-specific overrides for ${selectedPlatformObj?.name}? It will inherit 100% of the shared global website settings.`)) {
      return;
    }

    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const prevPlatforms = { ...(base.platforms || {}) };
      delete prevPlatforms[selectedPlatform];
      return {
        ...base,
        platforms: prevPlatforms
      };
    });
    showToast?.(`Cleared overrides for ${selectedPlatformObj?.name}`, 'success');
  };

  const handleCopyFromGlobal = (section) => {
    onUpdateDraft(prev => {
      const base = normalizeCmsConfig(prev || draft);
      const prevPlatforms = { ...(base.platforms || { desktop: {}, mobile_web: {}, android_app: {} }) };
      const currentPlatformObj = { ...(prevPlatforms[selectedPlatform] || {}) };

      currentPlatformObj[section] = JSON.parse(JSON.stringify(base[section] || {}));
      prevPlatforms[selectedPlatform] = currentPlatformObj;

      return {
        ...base,
        platforms: prevPlatforms
      };
    });
    showToast?.(`Copied global ${section} into ${selectedPlatformObj?.name}`, 'success');
  };

  const selectedPlatformObj = TARGET_PLATFORMS.find(p => p.id === selectedPlatform) || TARGET_PLATFORMS[0];
  const PlatformIcon = selectedPlatformObj.icon;

  const categories = [
    { id: 'branding', label: 'Branding & Identity', icon: Layout },
    { id: 'announcement', label: 'Announcement Bar', icon: Bell },
    { id: 'banner', label: 'Promotional Banner', icon: ImageIcon },
    { id: 'features', label: 'Feature Controls', icon: Sliders },
    { id: 'sections', label: 'Home Display Limits', icon: Layers }
  ];

  return (
    <div className="space-y-6">
      {/* Platform Selector Banner Header */}
      <div className="rounded-2xl bg-neutral-900/70 border border-neutral-800 p-4 sm:p-6 backdrop-blur-md relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Multi-Platform Target Architecture</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              Three Independent Presentation Targets
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl">
              Configure independent branding, promotional banners, announcements, card limits, and feature toggles for Desktop Web, Mobile Browser, and the Android TWA app without affecting the others.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {onPreviewPlatform && (
              <button
                type="button"
                onClick={() => onPreviewPlatform(selectedPlatform)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition cursor-pointer"
                title="Preview this platform target"
              >
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span>Preview Mode</span>
              </button>
            )}

            {onSaveDraft && (
              <button
                type="button"
                disabled={isSavingDraft}
                onClick={onSaveDraft}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-semibold border border-neutral-700 transition cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingDraft ? 'Saving...' : 'Save Draft'}</span>
              </button>
            )}

            {onPublishLive && (
              <button
                type="button"
                disabled={isPublishingLive}
                onClick={() => onPublishLive(`Published platform overrides for ${selectedPlatformObj.name}`)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer disabled:opacity-50"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{isPublishingLive ? 'Publishing...' : 'Publish Live'}</span>
              </button>
            )}
          </div>
        </div>

        {/* The 3 Independent Platform Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
          {TARGET_PLATFORMS.map((target) => {
            const Icon = target.icon;
            const isSelected = selectedPlatform === target.id;
            const hasCustom = hasOverrides(target.id);

            return (
              <button
                key={target.id}
                type="button"
                onClick={() => setSelectedPlatform(target.id)}
                className={`flex flex-col text-left p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? 'bg-neutral-800/90 border-amber-500 ring-2 ring-amber-500/30 shadow-lg shadow-amber-500/10'
                    : 'bg-neutral-950/60 border-neutral-800/80 hover:bg-neutral-850 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className={`p-2 rounded-lg bg-neutral-900 border border-neutral-700/60 ${isSelected ? 'text-amber-400' : 'text-neutral-400'}`}>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    hasCustom
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}>
                    {hasCustom ? 'Overrides Active' : 'Inherits Global'}
                  </span>
                </div>

                <span className="text-sm font-bold text-white mb-0.5">{target.name}</span>
                <span className="text-[11px] text-neutral-400 leading-tight line-clamp-2">{target.desc}</span>

                {isSelected && (
                  <div className="absolute top-2 right-2 flex items-center justify-center w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Target Workspace Body */}
      <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 p-4 sm:p-6 backdrop-blur-md space-y-6">
        {/* Workspace Active Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-neutral-800 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <PlatformIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Editing: {selectedPlatformObj.name}
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-zinc-300 text-[10px] font-mono font-bold uppercase">
                  Target Isolated
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Changes saved here will <strong className="text-amber-300">only affect {selectedPlatformObj.shortName}</strong> users. All other platforms remain independent.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopyFromGlobal(activeCategory)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold border border-neutral-700 transition cursor-pointer"
              title="Copy current global shared settings into this platform override"
            >
              <Copy className="w-3.5 h-3.5 text-amber-400" />
              <span>Clone from Global</span>
            </button>

            {hasOverrides(selectedPlatform) && (
              <button
                type="button"
                onClick={handleResetPlatformOverrides}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-500/30 transition cursor-pointer"
                title="Remove all overrides for this platform"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset to Global</span>
              </button>
            )}
          </div>
        </div>

        {/* Subcategory Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 border-b border-neutral-800/60">
          {categories.map((cat) => {
            const CatIcon = cat.icon;
            const isActive = activeCategory === cat.id;
            const isCatOverridden = Boolean(currentOverrides[cat.id] && Object.keys(currentOverrides[cat.id]).length > 0);

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                    : 'bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/60'
                }`}
              >
                <CatIcon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
                {isCatOverridden && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-neutral-950' : 'bg-amber-400'}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Category Form Content */}
        <div className="space-y-5">
          {/* 1. BRANDING & IDENTITY OVERRIDES */}
          {activeCategory === 'branding' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layout className="w-4 h-4 text-amber-400" />
                    <span>Platform Branding & Headings</span>
                  </h4>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Customize site name, tagline, or logo specifically when rendered on {selectedPlatformObj.name}.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Site Name */}
                {(() => {
                  const { value, isOverridden } = getEffectiveField('branding', 'siteName', 'Loopra');
                  return (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                        <label>Application / Brand Name</label>
                        {isOverridden ? (
                          <button
                            type="button"
                            onClick={() => handleClearOverride('branding', 'siteName')}
                            className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                          >
                            Reset to Global
                          </button>
                        ) : (
                          <span className="text-[10px] text-neutral-500">Using Global Value</span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => handleUpdateOverride('branding', 'siteName', e.target.value)}
                        placeholder="Loopra"
                        className={`w-full bg-black/40 border rounded-xl px-3.5 py-2.5 text-sm text-neutral-100 outline-none transition ${
                          isOverridden ? 'border-amber-500/60 ring-1 ring-amber-500/20' : 'border-neutral-700 focus:border-amber-500/40'
                        }`}
                      />
                    </div>
                  );
                })()}

                {/* Tagline */}
                {(() => {
                  const { value, isOverridden } = getEffectiveField('branding', 'tagline', '');
                  return (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                        <label>Platform Subtitle / Tagline</label>
                        {isOverridden ? (
                          <button
                            type="button"
                            onClick={() => handleClearOverride('branding', 'tagline')}
                            className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                          >
                            Reset to Global
                          </button>
                        ) : (
                          <span className="text-[10px] text-neutral-500">Using Global Value</span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => handleUpdateOverride('branding', 'tagline', e.target.value)}
                        placeholder="Stream retro bollywood and curated music"
                        className={`w-full bg-black/40 border rounded-xl px-3.5 py-2.5 text-sm text-neutral-100 outline-none transition ${
                          isOverridden ? 'border-amber-500/60 ring-1 ring-amber-500/20' : 'border-neutral-700 focus:border-amber-500/40'
                        }`}
                      />
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* 2. ANNOUNCEMENT BAR OVERRIDES */}
          {activeCategory === 'announcement' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-400" />
                    <span>Targeted Announcement Bar</span>
                  </h4>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Display an announcement exclusively to {selectedPlatformObj.name} users (e.g. "Install our Android APK" or "Update App").
                  </p>
                </div>
              </div>

              {/* Enabled toggle */}
              {(() => {
                const { value: enabled, isOverridden } = getEffectiveField('announcement', 'enabled', false);
                return (
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-black/40 border border-neutral-800">
                    <div>
                      <span className="text-xs font-bold text-white">Display Announcement Bar</span>
                      <p className="text-[11px] text-neutral-400">Controls visibility for {selectedPlatformObj.shortName}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {isOverridden && (
                        <button
                          type="button"
                          onClick={() => handleClearOverride('announcement', 'enabled')}
                          className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                      <input
                        type="checkbox"
                        checked={Boolean(enabled)}
                        onChange={(e) => handleUpdateOverride('announcement', 'enabled', e.target.checked)}
                        className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Message */}
              {(() => {
                const { value, isOverridden } = getEffectiveField('announcement', 'message', '');
                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                      <label>Announcement Message</label>
                      {isOverridden ? (
                        <button
                          type="button"
                          onClick={() => handleClearOverride('announcement', 'message')}
                          className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                        >
                          Reset to Global
                        </button>
                      ) : (
                        <span className="text-[10px] text-neutral-500">Using Global Value</span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={value || ''}
                      onChange={(e) => handleUpdateOverride('announcement', 'message', e.target.value)}
                      placeholder="Special announcement message for this platform..."
                      className={`w-full bg-black/40 border rounded-xl px-3.5 py-2.5 text-sm text-neutral-100 outline-none transition ${
                        isOverridden ? 'border-amber-500/60 ring-1 ring-amber-500/20' : 'border-neutral-700 focus:border-amber-500/40'
                      }`}
                    />
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Button Text */}
                {(() => {
                  const { value, isOverridden } = getEffectiveField('announcement', 'linkText', '');
                  return (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                        <label>Action Button Label</label>
                        {isOverridden && (
                          <button
                            type="button"
                            onClick={() => handleClearOverride('announcement', 'linkText')}
                            className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => handleUpdateOverride('announcement', 'linkText', e.target.value)}
                        placeholder="e.g. Download Now"
                        className={`w-full bg-black/40 border rounded-xl px-3.5 py-2.5 text-sm text-neutral-100 outline-none transition ${
                          isOverridden ? 'border-amber-500/60 ring-1 ring-amber-500/20' : 'border-neutral-700 focus:border-amber-500/40'
                        }`}
                      />
                    </div>
                  );
                })()}

                {/* Button Destination */}
                {(() => {
                  const { value, isOverridden } = getEffectiveField('announcement', 'linkUrl', '');
                  return (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                        <label>Target Destination URL</label>
                        {isOverridden && (
                          <button
                            type="button"
                            onClick={() => handleClearOverride('announcement', 'linkUrl')}
                            className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => handleUpdateOverride('announcement', 'linkUrl', e.target.value)}
                        placeholder="e.g. /download or https://..."
                        className={`w-full bg-black/40 border rounded-xl px-3.5 py-2.5 text-sm text-neutral-100 outline-none transition ${
                          isOverridden ? 'border-amber-500/60 ring-1 ring-amber-500/20' : 'border-neutral-700 focus:border-amber-500/40'
                        }`}
                      />
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* 3. PROMOTIONAL HERO BANNER OVERRIDES */}
          {activeCategory === 'banner' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-amber-400" />
                    <span>Targeted Promotional Hero Banner</span>
                  </h4>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Customize hero banner images, headings, and CTA destinations specifically for {selectedPlatformObj.name}.
                  </p>
                </div>
              </div>

              {/* Enabled toggle */}
              {(() => {
                const { value: enabled, isOverridden } = getEffectiveField('banner', 'enabled', false);
                return (
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-black/40 border border-neutral-800">
                    <div>
                      <span className="text-xs font-bold text-white">Display Hero Banner</span>
                      <p className="text-[11px] text-neutral-400">Controls hero banner render on {selectedPlatformObj.shortName}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {isOverridden && (
                        <button
                          type="button"
                          onClick={() => handleClearOverride('banner', 'enabled')}
                          className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                      <input
                        type="checkbox"
                        checked={Boolean(enabled)}
                        onChange={(e) => handleUpdateOverride('banner', 'enabled', e.target.checked)}
                        className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Banner Title */}
                {(() => {
                  const { value, isOverridden } = getEffectiveField('banner', 'title', '');
                  return (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                        <label>Banner Heading</label>
                        {isOverridden && (
                          <button
                            type="button"
                            onClick={() => handleClearOverride('banner', 'title')}
                            className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => handleUpdateOverride('banner', 'title', e.target.value)}
                        placeholder="Nostalgic Radio Stations Now Live"
                        className={`w-full bg-black/40 border rounded-xl px-3.5 py-2.5 text-sm text-neutral-100 outline-none transition ${
                          isOverridden ? 'border-amber-500/60 ring-1 ring-amber-500/20' : 'border-neutral-700 focus:border-amber-500/40'
                        }`}
                      />
                    </div>
                  );
                })()}

                {/* Banner CTA Text */}
                {(() => {
                  const { value, isOverridden } = getEffectiveField('banner', 'actionText', '');
                  return (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                        <label>Action Button Text</label>
                        {isOverridden && (
                          <button
                            type="button"
                            onClick={() => handleClearOverride('banner', 'actionText')}
                            className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => handleUpdateOverride('banner', 'actionText', e.target.value)}
                        placeholder="Tune In Now"
                        className={`w-full bg-black/40 border rounded-xl px-3.5 py-2.5 text-sm text-neutral-100 outline-none transition ${
                          isOverridden ? 'border-amber-500/60 ring-1 ring-amber-500/20' : 'border-neutral-700 focus:border-amber-500/40'
                        }`}
                      />
                    </div>
                  );
                })()}
              </div>

              {/* Banner Subtitle */}
              {(() => {
                const { value, isOverridden } = getEffectiveField('banner', 'subtitle', '');
                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                      <label>Banner Subtitle / Description</label>
                      {isOverridden && (
                        <button
                          type="button"
                          onClick={() => handleClearOverride('banner', 'subtitle')}
                          className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={2}
                      value={value || ''}
                      onChange={(e) => handleUpdateOverride('banner', 'subtitle', e.target.value)}
                      placeholder="Listen to 90s Saloon FM, Highway Truck Melodies, and Theka Session nonstop."
                      className={`w-full bg-black/40 border rounded-xl px-3.5 py-2 text-sm text-neutral-100 outline-none transition ${
                        isOverridden ? 'border-amber-500/60 ring-1 ring-amber-500/20' : 'border-neutral-700 focus:border-amber-500/40'
                      }`}
                    />
                  </div>
                );
              })()}

              {/* Banner Image URL */}
              {(() => {
                const { value, isOverridden } = getEffectiveField('banner', 'imageUrl', '');
                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                      <label>Background Image URL</label>
                      {isOverridden && (
                        <button
                          type="button"
                          onClick={() => handleClearOverride('banner', 'imageUrl')}
                          className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => handleUpdateOverride('banner', 'imageUrl', e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className={`flex-1 bg-black/40 border rounded-xl px-3.5 py-2.5 text-sm text-neutral-100 outline-none transition ${
                          isOverridden ? 'border-amber-500/60 ring-1 ring-amber-500/20' : 'border-neutral-700 focus:border-amber-500/40'
                        }`}
                      />
                      {onOpenMediaPicker && (
                        <button
                          type="button"
                          onClick={() => onOpenMediaPicker((url) => handleUpdateOverride('banner', 'imageUrl', url))}
                          className="px-3 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition cursor-pointer shrink-0"
                        >
                          Select Image
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* 4. FEATURE CONTROLS OVERRIDES */}
          {activeCategory === 'features' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <span>Targeted Feature Controls</span>
                  </h4>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Enable or disable specific features (e.g. offline audio downloads, DJ Club WebGL) exclusively for {selectedPlatformObj.name}.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: 'offlineDownloadsEnabled', name: 'Offline Song Downloads', desc: 'Allow caching tracks for offline playback.' },
                  { key: 'djClubEnabled', name: '3D DJ Club', desc: 'Dual vinyl turntable WebGL mixer.' },
                  { key: 'discoverSwipeEnabled', name: 'Discover Swipe Deck', desc: 'Mobile-first music card deck.' },
                  { key: 'moodAiEnabled', name: 'Mood AI Assistant', desc: 'AI-generated emotion playlists.' },
                  { key: 'voiceAgentEnabled', name: 'Loopra Voice Companion', desc: 'Voice-controlled song playback.' },
                  { key: 'timeMachineEnabled', name: 'Time Machine Retro Radio', desc: 'Decade retro bollywood station.' }
                ].map((feat) => {
                  const { value: enabled, isOverridden } = getEffectiveField('featureControls', feat.key, true);

                  return (
                    <div
                      key={feat.key}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition ${
                        isOverridden ? 'bg-amber-500/5 border-amber-500/40' : 'bg-black/40 border-neutral-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white truncate">{feat.name}</span>
                          {isOverridden && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-mono">Custom</span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-1">{feat.desc}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isOverridden && (
                          <button
                            type="button"
                            onClick={() => handleClearOverride('featureControls', feat.key)}
                            className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                          >
                            Reset
                          </button>
                        )}
                        <input
                          type="checkbox"
                          checked={Boolean(enabled)}
                          onChange={(e) => handleUpdateOverride('featureControls', feat.key, e.target.checked)}
                          className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. HOMEPAGE DISPLAY LIMITS OVERRIDES */}
          {activeCategory === 'sections' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span>Homepage Display Limits</span>
                  </h4>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Tune how many items appear per section on {selectedPlatformObj.name} (e.g. fewer cards on mobile devices to prevent excessive scrolling).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(safeDraft.sections || []).map((sec) => {
                  const platformSections = currentOverrides.sections || [];
                  const existingOverride = platformSections.find(s => s.id === sec.id);
                  const isOverridden = existingOverride !== undefined && existingOverride.displayLimit !== undefined;
                  const displayLimit = isOverridden ? existingOverride.displayLimit : (sec.displayLimit || 12);

                  const handleSectionLimitChange = (newLimit) => {
                    const nextLimit = Math.max(1, parseInt(newLimit, 10) || 12);
                    onUpdateDraft(prev => {
                      const base = normalizeCmsConfig(prev || draft);
                      const prevPlatforms = { ...(base.platforms || { desktop: {}, mobile_web: {}, android_app: {} }) };
                      const currentPlatformObj = { ...(prevPlatforms[selectedPlatform] || {}) };
                      const currentSecList = [...(currentPlatformObj.sections || [])];

                      const idx = currentSecList.findIndex(s => s.id === sec.id);
                      if (idx >= 0) {
                        currentSecList[idx] = { ...currentSecList[idx], displayLimit: nextLimit };
                      } else {
                        currentSecList.push({ id: sec.id, displayLimit: nextLimit });
                      }

                      currentPlatformObj.sections = currentSecList;
                      prevPlatforms[selectedPlatform] = currentPlatformObj;

                      return {
                        ...base,
                        platforms: prevPlatforms
                      };
                    });
                  };

                  const handleResetSectionLimit = () => {
                    onUpdateDraft(prev => {
                      const base = normalizeCmsConfig(prev || draft);
                      const prevPlatforms = { ...(base.platforms || {}) };
                      const currentPlatformObj = { ...(prevPlatforms[selectedPlatform] || {}) };
                      if (!currentPlatformObj.sections) return base;

                      currentPlatformObj.sections = currentPlatformObj.sections.filter(s => s.id !== sec.id);
                      if (currentPlatformObj.sections.length === 0) {
                        delete currentPlatformObj.sections;
                      }
                      prevPlatforms[selectedPlatform] = currentPlatformObj;

                      return {
                        ...base,
                        platforms: prevPlatforms
                      };
                    });
                  };

                  return (
                    <div
                      key={sec.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                        isOverridden ? 'bg-amber-500/5 border-amber-500/40' : 'bg-black/40 border-neutral-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white truncate">{sec.title || sec.id}</span>
                          {isOverridden && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-mono">Custom</span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-400 mt-0.5 truncate">{sec.subtitle || 'Homepage Section'}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isOverridden && (
                          <button
                            type="button"
                            onClick={handleResetSectionLimit}
                            className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                          >
                            Reset
                          </button>
                        )}
                        <input
                          type="number"
                          min="1"
                          max="48"
                          value={displayLimit}
                          onChange={(e) => handleSectionLimitChange(e.target.value)}
                          className="w-16 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-center text-xs text-white font-mono"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
